import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BookingCreationError,
  ensureAuthUser,
  findBookingByStripeSessionId,
  upsertAppUser,
  type CreatedBookingResult,
  type PromoCodeDetails,
} from "./create";
import type { ParsedExhibitorMetadata } from "./exhibitor-intent";

interface CreateExhibitorInput {
  client: SupabaseClient;
  parsed: ParsedExhibitorMetadata;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  vatAmountPence: number;
  paidAt: Date;
  promo?: PromoCodeDetails | null;
  paymentStatus?: "paid" | "comp";
}

// Mirrors createDelegateBookingFromCheckoutSession: same idempotency
// guard, same user provisioning (the account belongs to the main
// contact), then one bookings row plus TWO booking_attendees rows.
// Same non-atomicity caveat as the delegate path (see the TODO there):
// a failure between inserts leaves an orphan bookings row for admin
// cleanup; Stripe retries no-op via the idempotency guard.
export async function createExhibitorBookingFromCheckoutSession(
  input: CreateExhibitorInput,
): Promise<CreatedBookingResult> {
  const {
    client,
    parsed,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    vatAmountPence,
    promo,
    paymentStatus = "paid",
  } = input;

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
  const contactEmail = intent.contactEmail.toLowerCase();

  const authUserId = await ensureAuthUser(client, contactEmail, {
    first_name: intent.contactFirstName,
    surname: intent.contactSurname,
    company: intent.company,
  });

  // The main contact owns the booking. Their job title is only known if
  // they are also one of the two attendees; otherwise it stays blank on
  // the profile (never on the badge, badges come from attendee rows).
  const contactAsAttendee = intent.attendees.find(
    (a) => a.email.toLowerCase() === contactEmail,
  );
  const appUserId = await upsertAppUser(client, contactEmail, authUserId, {
    firstName: intent.contactFirstName,
    surname: intent.contactSurname,
    mobile: intent.contactMobile,
    company: intent.company,
    jobTitle: contactAsAttendee?.jobTitle ?? "",
    marketingOptIn: intent.marketingOptIn,
  });

  const { data: bookingRow, error: bookingErr } = await client
    .from("bookings")
    .insert({
      user_id: appUserId,
      booking_reference: bookingReference,
      booking_type: "exhibitor",
      ticket_type: "exhibitor",
      pricing_period: pricing.period,
      gross_amount_pence: pricing.grossIncVatPence,
      vat_amount_pence: vatAmountPence,
      currency: "gbp",
      // The exhibitor package always includes 2 lunches.
      lunch_included: true,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
      payment_status: paymentStatus,
      booking_status: "active",
      promo_code: promo?.code ?? null,
      promo_code_id: promo?.promotionCodeId ?? null,
      discount_pence: promo?.discountPence ?? null,
      terms_accepted_at: termsAcceptedAt,
      terms_accepted_ip: termsAcceptedIp,
    })
    .select("id")
    .single();

  if (bookingErr || !bookingRow) {
    if (bookingErr && /booking_reference/.test(bookingErr.message ?? "")) {
      throw new BookingCreationError(
        "booking_reference collision; caller should retry",
        bookingErr,
      );
    }
    throw new BookingCreationError("bookings insert failed", bookingErr);
  }

  const bookingId = bookingRow.id as string;

  const attendeeRows = intent.attendees.map((a, i) => ({
    booking_id: bookingId,
    // Link the app user only where the attendee IS the main contact;
    // the second attendee gets an account when/if they book themselves.
    user_id: a.email.toLowerCase() === contactEmail ? appUserId : null,
    first_name: a.firstName,
    surname: a.surname,
    email: a.email,
    mobile: a.mobile.length > 0 ? a.mobile : null,
    company: intent.company,
    job_title: a.jobTitle,
    dietary_requirement: a.dietaryRequirement,
    dietary_other: a.dietaryRequirement === "other" ? a.dietaryOther : null,
    // Both exhibitor attendees always get lunch.
    lunch_entitlement: true,
    // Badge QR is a VIP-only perk; exhibitor badges carry none.
    badge_qr_url: null,
    is_primary_contact: a.email.toLowerCase() === contactEmail,
    attendee_index: i + 1,
  }));

  const { error: attendeeErr } = await client
    .from("booking_attendees")
    .insert(attendeeRows);

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
