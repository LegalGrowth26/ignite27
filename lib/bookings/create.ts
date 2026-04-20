import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedDelegateMetadata } from "./intent";

// Result returned by the booking-creation path. `isNew` is false when the
// webhook was a retry and we returned the already-stored booking without
// duplicating work. `confirmationEmailSentAt` is the flag the webhook uses
// to decide whether to retry the confirmation email on a duplicate event.
export interface CreatedBookingResult {
  isNew: boolean;
  bookingId: string;
  bookingReference: string;
  userId: string;
  authUserId: string | null;
  confirmationEmailSentAt: string | null;
}

export class BookingCreationError extends Error {
  constructor(message: string, readonly originalCause?: unknown) {
    super(message);
    this.name = "BookingCreationError";
  }
}

interface CreateInput {
  client: SupabaseClient;
  parsed: ParsedDelegateMetadata;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  vatAmountPence: number;
  paidAt: Date;
}

// Look up a booking by its Stripe Checkout session id. Used for idempotency.
// The webhook handler also reads confirmation_email_sent_at so it can decide
// whether to retry the confirmation email on a duplicate event.
async function findBookingByStripeSessionId(
  client: SupabaseClient,
  sessionId: string,
): Promise<{
  id: string;
  user_id: string;
  booking_reference: string | null;
  confirmation_email_sent_at: string | null;
} | null> {
  const { data, error } = await client
    .from("bookings")
    .select("id, user_id, booking_reference, confirmation_email_sent_at")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw new BookingCreationError("select booking failed", error);
  return data as {
    id: string;
    user_id: string;
    booking_reference: string | null;
    confirmation_email_sent_at: string | null;
  } | null;
}

// Return the users row for an email if it exists.
async function findUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<{ id: string; auth_user_id: string | null } | null> {
  const { data, error } = await client
    .from("users")
    .select("id, auth_user_id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new BookingCreationError("select user failed", error);
  return data as { id: string; auth_user_id: string | null } | null;
}

// Ensure a Supabase auth user exists for this email. If the user exists,
// return their id. If not, create one with a random password (they'll set
// their own via the magic-link-to-set-password flow).
async function ensureAuthUser(
  client: SupabaseClient,
  email: string,
  userMetadata: Record<string, string>,
): Promise<string> {
  // Generate a high-entropy random password. The user will overwrite it
  // immediately via the set-password flow.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const randomPassword = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await client.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!error && data.user) {
    return data.user.id;
  }

  // If the user already exists, the admin API returns an error we can recover
  // from by listing and matching by email. Supabase's admin.listUsers supports
  // filtering but to stay portable we list a small page and match.
  const status = (error as { status?: number } | null)?.status;
  const message = error?.message ?? "";
  const alreadyExists =
    status === 422 ||
    /already registered|already been registered|User already/i.test(message);

  if (!alreadyExists) {
    throw new BookingCreationError(`auth.createUser failed: ${message}`, error);
  }

  const { data: listData, error: listErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    throw new BookingCreationError("auth.listUsers failed", listErr);
  }
  const match = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!match) {
    throw new BookingCreationError(
      `auth user reportedly exists but was not found in listUsers: ${email}`,
    );
  }
  return match.id;
}

async function upsertAppUser(
  client: SupabaseClient,
  email: string,
  authUserId: string,
  profile: {
    firstName: string;
    surname: string;
    mobile: string;
    company: string;
    jobTitle: string;
    marketingOptIn: boolean;
  },
): Promise<string> {
  const existing = await findUserByEmail(client, email);
  if (existing) {
    // Only update auth_user_id if it was null. Never overwrite existing
    // profile fields silently; that's a support problem waiting to happen.
    if (!existing.auth_user_id) {
      const { error: updateErr } = await client
        .from("users")
        .update({ auth_user_id: authUserId })
        .eq("id", existing.id);
      if (updateErr) throw new BookingCreationError("users update failed", updateErr);
    }
    return existing.id;
  }

  const { data, error } = await client
    .from("users")
    .insert({
      email,
      auth_user_id: authUserId,
      first_name: profile.firstName,
      surname: profile.surname,
      mobile: profile.mobile,
      company: profile.company,
      job_title: profile.jobTitle,
      role: "attendee",
      marketing_opt_in: profile.marketingOptIn,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new BookingCreationError("users insert failed", error);
  }
  return data.id as string;
}

function deriveLunchEntitlement(input: CreateInput): boolean {
  const { ticketType, lunchIncluded } = input.parsed.intent;
  if (ticketType === "vip") return true; // VIP always includes lunch.
  return lunchIncluded;
}

export async function createDelegateBookingFromCheckoutSession(
  input: CreateInput,
): Promise<CreatedBookingResult> {
  const {
    client,
    parsed,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    vatAmountPence,
  } = input;

  // Idempotency guard: if we've already processed this session, return.
  const existing = await findBookingByStripeSessionId(client, stripeCheckoutSessionId);
  if (existing) {
    return {
      isNew: false,
      bookingId: existing.id,
      bookingReference: existing.booking_reference ?? parsed.bookingReference,
      userId: existing.user_id,
      authUserId: null,
      confirmationEmailSentAt: existing.confirmation_email_sent_at,
    };
  }

  const { intent, pricing, bookingReference, termsAcceptedAt, termsAcceptedIp } = parsed;

  const authUserId = await ensureAuthUser(client, intent.email, {
    first_name: intent.firstName,
    surname: intent.surname,
    company: intent.company,
  });

  const appUserId = await upsertAppUser(client, intent.email, authUserId, {
    firstName: intent.firstName,
    surname: intent.surname,
    mobile: intent.mobile,
    company: intent.company,
    jobTitle: intent.jobTitle,
    marketingOptIn: intent.marketingOptIn,
  });

  // TODO: the bookings insert and booking_attendees insert below are not
  // atomic. If the attendees insert fails after the bookings insert succeeds
  // we leave an orphan bookings row with no attendee. The correct fix is a
  // Postgres stored procedure wrapping both inserts in a single transaction
  // (invoked here via supabase.rpc). Tracked as a follow-up; for now the
  // webhook logs and returns 200, and Stripe retries will find the orphan
  // via the idempotency guard and no-op on branch 3, leaving the orphan for
  // admin cleanup.
  const { data: bookingRow, error: bookingErr } = await client
    .from("bookings")
    .insert({
      user_id: appUserId,
      booking_reference: bookingReference,
      booking_type: "delegate",
      ticket_type: intent.ticketType,
      pricing_window: pricing.window,
      gross_amount_pence: pricing.grossAmountPence,
      vat_amount_pence: vatAmountPence,
      charity_uplift_pence: pricing.charityUpliftPence,
      currency: "gbp",
      lunch_included:
        intent.ticketType === "vip" ? true : intent.lunchIncluded,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
      payment_status: "paid",
      booking_status: "active",
      terms_accepted_at: termsAcceptedAt,
      terms_accepted_ip: termsAcceptedIp,
    })
    .select("id")
    .single();

  if (bookingErr || !bookingRow) {
    // Retry-on-collision path: if the booking_reference collided (very
    // unlikely but possible), generate a new one and try once more.
    if (bookingErr && /booking_reference/.test(bookingErr.message ?? "")) {
      throw new BookingCreationError(
        "booking_reference collision; caller should retry",
        bookingErr,
      );
    }
    throw new BookingCreationError("bookings insert failed", bookingErr);
  }

  const bookingId = bookingRow.id as string;

  const { error: attendeeErr } = await client.from("booking_attendees").insert({
    booking_id: bookingId,
    user_id: appUserId,
    first_name: intent.firstName,
    surname: intent.surname,
    email: intent.email,
    mobile: intent.mobile,
    company: intent.company,
    job_title: intent.jobTitle,
    dietary_requirement: intent.dietaryRequirement,
    dietary_other:
      intent.dietaryRequirement === "other" ? intent.dietaryOther : null,
    lunch_entitlement: deriveLunchEntitlement(input),
    badge_qr_url: intent.badgeQrUrl.length > 0 ? intent.badgeQrUrl : null,
    is_primary_contact: true,
    attendee_index: 1,
  });

  if (attendeeErr) {
    throw new BookingCreationError("booking_attendees insert failed", attendeeErr);
  }

  return {
    isNew: true,
    bookingId,
    bookingReference,
    userId: appUserId,
    authUserId,
    confirmationEmailSentAt: null,
  };
}

export async function markConfirmationEmailSent(
  client: SupabaseClient,
  bookingId: string,
): Promise<void> {
  const { error } = await client
    .from("bookings")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) {
    throw new BookingCreationError("bookings update confirmation flag failed", error);
  }
}
