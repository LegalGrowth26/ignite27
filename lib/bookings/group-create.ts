import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BookingCreationError,
  ensureAuthUser,
  findBookingByStripeSessionId,
  upsertAppUser,
} from "./create";
import {
  groupLead,
  parseGroupIntentPayload,
  tbcAttendeeFields,
  type GroupIntentPayload,
  type GroupTicketIntent,
} from "./group-intent";
import { generateBookingReference } from "./reference";
import { allocateProportionally } from "@/lib/pricing/group";
import { priceFromExVat } from "@/lib/pricing";

// One booking per ticket, from a paid group checkout session. The lead
// (ticket 1 / group_position 1) carries the Stripe session and
// payment-intent ids; that unique session id is the same idempotency
// anchor single bookings use. Member bookings are keyed by the unique
// (group_intent_id, group_position) index, so a webhook retry after a
// mid-create crash fills in only the missing positions.

export interface GroupCreationResult {
  isNew: boolean;
  leadBookingId: string;
  leadBookingReference: string;
  bookingReferences: string[];
  confirmationEmailSentAt: string | null;
  payload: GroupIntentPayload;
}

interface GroupCreateInput {
  client: SupabaseClient;
  groupIntentId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  paymentStatus: "paid" | "comp";
  ambassadorId: string | null;
}

export async function loadGroupIntentPayload(
  client: SupabaseClient,
  groupIntentId: string,
): Promise<GroupIntentPayload> {
  const { data, error } = await client
    .from("pending_group_intents")
    .select("payload")
    .eq("id", groupIntentId)
    .maybeSingle();
  if (error) throw new BookingCreationError("group intent select failed", error);
  if (!data) throw new BookingCreationError(`group intent not found: ${groupIntentId}`);
  return parseGroupIntentPayload((data as { payload: unknown }).payload);
}

// Per-ticket money. When the GROUP tier won, the payload's pricing rows
// already carry each ticket's discount share. When a CODE won, its
// valued amount is allocated across the ticket lines here the same way
// (proportional, penny-exact) so the per-booking amounts still sum to
// what was charged, give or take the VAT penny rounding inherent in
// splitting one receipt across rows (noted in the PR).
export function perTicketAmounts(payload: GroupIntentPayload): Array<{
  grossIncVatPence: number;
  vatPence: number;
  discountExVatPence: number;
}> {
  const { pricing, applied } = payload;
  if (applied.kind === "code") {
    const shares = allocateProportionally(
      applied.discountPence,
      pricing.tickets.map((t) => t.ticketExVatPence),
    );
    return pricing.tickets.map((t, i) => {
      const netEx = Math.max(0, t.ticketExVatPence - shares[i]!) + t.lunchExVatPence;
      const p = priceFromExVat(netEx);
      return {
        grossIncVatPence: p.incVatPence,
        vatPence: p.vatPence,
        discountExVatPence: shares[i]!,
      };
    });
  }
  return pricing.tickets.map((t) => {
    const p = priceFromExVat(t.netTicketExVatPence + t.lunchExVatPence);
    return {
      grossIncVatPence: p.incVatPence,
      vatPence: p.vatPence,
      discountExVatPence: t.discountExVatPence,
    };
  });
}

function lunchEntitlement(t: GroupTicketIntent): boolean {
  return t.ticketType === "vip" ? true : t.lunchIncluded;
}

async function resolveTicketUser(
  client: SupabaseClient,
  t: GroupTicketIntent,
  lead: GroupTicketIntent,
  leadUserIds: { appUserId: string },
  shared: { mobile: string; company: string; marketingOptIn: boolean },
): Promise<string> {
  if (t.tbc) return leadUserIds.appUserId;
  if (t.email === lead.email) return leadUserIds.appUserId;
  const authUserId = await ensureAuthUser(client, t.email, {
    first_name: t.firstName,
    surname: t.surname,
    company: shared.company,
  });
  return upsertAppUser(client, t.email, authUserId, {
    firstName: t.firstName,
    surname: t.surname,
    mobile: "",
    company: shared.company,
    jobTitle: t.jobTitle,
    marketingOptIn: false, // only the lead ticked (or did not tick) the box
  });
}

export async function createGroupBookingsFromCheckoutSession(
  input: GroupCreateInput,
): Promise<GroupCreationResult> {
  const {
    client,
    groupIntentId,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    paymentStatus,
    ambassadorId,
  } = input;

  const payload = await loadGroupIntentPayload(client, groupIntentId);
  const { intent, pricing, applied } = payload;
  const lead = groupLead(intent);
  const amounts = perTicketAmounts(payload);

  // Lead user always exists first: TBC tickets and duplicate-email
  // tickets hang off it.
  const leadAuthUserId = await ensureAuthUser(client, lead.email, {
    first_name: lead.firstName,
    surname: lead.surname,
    company: intent.company,
  });
  const leadAppUserId = await upsertAppUser(client, lead.email, leadAuthUserId, {
    firstName: lead.firstName,
    surname: lead.surname,
    mobile: intent.leadMobile,
    company: intent.company,
    jobTitle: lead.jobTitle,
    marketingOptIn: intent.marketingOptIn,
  });

  // Idempotency anchor: the lead booking's unique session id.
  const existing = await findBookingByStripeSessionId(client, stripeCheckoutSessionId);
  let leadBookingId: string;
  let leadBookingReference: string;
  let confirmationEmailSentAt: string | null;
  let isNew: boolean;

  if (existing) {
    leadBookingId = existing.id;
    leadBookingReference = existing.booking_reference ?? "I27-PENDING";
    confirmationEmailSentAt = existing.confirmation_email_sent_at;
    isNew = false;
  } else {
    leadBookingReference = generateBookingReference();
    const leadAmounts = amounts[0]!;
    const { data: leadRow, error: leadErr } = await client
      .from("bookings")
      .insert({
        user_id: leadAppUserId,
        booking_reference: leadBookingReference,
        booking_type: "delegate",
        ticket_type: lead.ticketType,
        pricing_period: pricing.period,
        gross_amount_pence: leadAmounts.grossIncVatPence,
        vat_amount_pence: leadAmounts.vatPence,
        currency: "gbp",
        lunch_included: lunchEntitlement(lead),
        stripe_checkout_session_id: stripeCheckoutSessionId,
        stripe_payment_intent_id: stripePaymentIntentId,
        payment_status: paymentStatus,
        booking_status: "active",
        promo_code: applied.kind === "code" ? applied.code : null,
        promo_code_id: applied.kind === "code" ? applied.promotionCodeId : null,
        discount_pence: leadAmounts.discountExVatPence || null,
        ambassador_id: ambassadorId,
        terms_accepted_at: payload.termsAcceptedAt,
        terms_accepted_ip: payload.termsAcceptedIp,
        group_intent_id: groupIntentId,
        group_position: 1,
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      // A concurrent delivery may have won the unique session id race.
      if (leadErr && /duplicate key|unique/.test(leadErr.message ?? "")) {
        const raced = await findBookingByStripeSessionId(client, stripeCheckoutSessionId);
        if (raced) {
          leadBookingId = raced.id;
          leadBookingReference = raced.booking_reference ?? leadBookingReference;
          confirmationEmailSentAt = raced.confirmation_email_sent_at;
          isNew = false;
          await ensureMemberBookings(input, payload, leadAppUserId, amounts);
          const refs = await listGroupReferences(client, groupIntentId);
          return {
            isNew,
            leadBookingId,
            leadBookingReference,
            bookingReferences: refs,
            confirmationEmailSentAt,
            payload,
          };
        }
      }
      throw new BookingCreationError("group lead booking insert failed", leadErr);
    }

    leadBookingId = leadRow.id as string;
    confirmationEmailSentAt = null;
    isNew = true;

    const { error: leadAttendeeErr } = await client.from("booking_attendees").insert({
      booking_id: leadBookingId,
      user_id: leadAppUserId,
      first_name: lead.firstName,
      surname: lead.surname,
      email: lead.email,
      mobile: intent.leadMobile,
      company: intent.company,
      job_title: lead.jobTitle,
      dietary_requirement: lead.dietaryRequirement,
      dietary_other: lead.dietaryRequirement === "other" ? lead.dietaryOther : null,
      lunch_entitlement: lunchEntitlement(lead),
      badge_qr_url: null,
      is_primary_contact: true,
      attendee_index: 1,
    });
    if (leadAttendeeErr) {
      throw new BookingCreationError("group lead attendee insert failed", leadAttendeeErr);
    }
  }

  await ensureMemberBookings(input, payload, leadAppUserId, amounts);
  const bookingReferences = await listGroupReferences(client, groupIntentId);

  return {
    isNew,
    leadBookingId,
    leadBookingReference,
    bookingReferences,
    confirmationEmailSentAt,
    payload,
  };
}

// Create any missing member bookings (positions 2..n). The partial
// unique index on (group_intent_id, group_position) makes this safe to
// run on every delivery: a position that exists inserts nothing.
async function ensureMemberBookings(
  input: GroupCreateInput,
  payload: GroupIntentPayload,
  leadAppUserId: string,
  amounts: ReturnType<typeof perTicketAmounts>,
): Promise<void> {
  const { client, groupIntentId, ambassadorId, paymentStatus } = input;
  const { intent, pricing, applied } = payload;
  const lead = groupLead(intent);

  const { data: existingRows, error: existingErr } = await client
    .from("bookings")
    .select("group_position")
    .eq("group_intent_id", groupIntentId);
  if (existingErr) {
    throw new BookingCreationError("group members select failed", existingErr);
  }
  const have = new Set(
    ((existingRows ?? []) as Array<{ group_position: number | null }>).map(
      (r) => r.group_position,
    ),
  );

  for (let index = 1; index < intent.tickets.length; index += 1) {
    const position = index + 1;
    if (have.has(position)) continue;
    const t = intent.tickets[index]!;
    const money = amounts[index]!;

    const appUserId = await resolveTicketUser(client, t, lead, { appUserId: leadAppUserId }, {
      mobile: intent.leadMobile,
      company: intent.company,
      marketingOptIn: intent.marketingOptIn,
    });

    const reference = generateBookingReference();
    const { data: row, error } = await client
      .from("bookings")
      .insert({
        user_id: appUserId,
        booking_reference: reference,
        booking_type: "delegate",
        ticket_type: t.ticketType,
        pricing_period: pricing.period,
        gross_amount_pence: money.grossIncVatPence,
        vat_amount_pence: money.vatPence,
        currency: "gbp",
        lunch_included: lunchEntitlement(t),
        stripe_checkout_session_id: null, // the lead's booking holds it
        stripe_payment_intent_id: null,
        payment_status: paymentStatus,
        booking_status: "active",
        promo_code: null, // code details live on the lead booking
        promo_code_id: null,
        discount_pence: money.discountExVatPence || null,
        ambassador_id: ambassadorId,
        terms_accepted_at: payload.termsAcceptedAt,
        terms_accepted_ip: payload.termsAcceptedIp,
        group_intent_id: groupIntentId,
        group_position: position,
      })
      .select("id")
      .single();

    if (error || !row) {
      // Unique (group_intent_id, group_position) violation: another
      // delivery created this position between our select and insert.
      if (error && /duplicate key|unique/.test(error.message ?? "")) continue;
      throw new BookingCreationError(
        `group member booking insert failed (position ${position})`,
        error,
      );
    }

    const attendee = t.tbc ? tbcAttendeeFields(lead.email) : t;
    const { error: attendeeErr } = await client.from("booking_attendees").insert({
      booking_id: row.id as string,
      user_id: appUserId,
      first_name: t.tbc ? attendee.firstName : t.firstName,
      surname: t.tbc ? attendee.surname : t.surname,
      email: attendee.email,
      mobile: null,
      company: intent.company,
      job_title: t.tbc ? null : t.jobTitle || null,
      dietary_requirement: t.tbc ? "none" : t.dietaryRequirement,
      dietary_other:
        !t.tbc && t.dietaryRequirement === "other" ? t.dietaryOther : null,
      lunch_entitlement: lunchEntitlement(t),
      badge_qr_url: null,
      is_primary_contact: true,
      attendee_index: 1,
    });
    if (attendeeErr) {
      throw new BookingCreationError(
        `group member attendee insert failed (position ${position})`,
        attendeeErr,
      );
    }
  }
}

async function listGroupReferences(
  client: SupabaseClient,
  groupIntentId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("bookings")
    .select("booking_reference, group_position")
    .eq("group_intent_id", groupIntentId)
    .order("group_position", { ascending: true });
  if (error) throw new BookingCreationError("group references select failed", error);
  return ((data ?? []) as Array<{ booking_reference: string | null }>).map(
    (r) => r.booking_reference ?? "I27-PENDING",
  );
}
