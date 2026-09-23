import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { createDelegateBookingFromCheckoutSession } from "@/lib/bookings/create";
import { createExhibitorBookingFromCheckoutSession } from "@/lib/bookings/exhibitor-create";
import { countCompletedExhibitorBookings } from "@/lib/bookings/exhibitor-count";
import { createGroupBookingsFromCheckoutSession } from "@/lib/bookings/group-create";
import { GroupPayloadParseError, groupLead } from "@/lib/bookings/group-intent";
import { sendGroupConfirmationEmail } from "@/lib/bookings/send-group-confirmation";
import { metadataToParsed, MetadataParseError } from "@/lib/bookings/intent";
import {
  metadataToParsedExhibitor,
  ExhibitorMetadataParseError,
} from "@/lib/bookings/exhibitor-intent";
import { env } from "@/lib/env";
import { sendPartnerPaymentConfirmationEmail } from "@/lib/partners/send-payment";
import { crmTagsForBooking, pushContactToCrmSafe } from "@/lib/crm/ghl";
import { ensureExhibitorProfileSafe } from "@/lib/exhibitors/create-profile";
import { REF_METADATA_KEY } from "@/lib/ambassadors/attribution";
import { resolveAmbassadorIdForSlug } from "@/lib/ambassadors/resolve";
import { sendDelegateConfirmationEmail } from "@/lib/bookings/send-confirmation";
import { sendExhibitorConfirmationEmail } from "@/lib/bookings/send-exhibitor-confirmation";
import { EXHIBITOR_STAND_CAP } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("missing stripe-signature header", { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.warn("[stripe-webhook] signature verification failed:", message);
    return new NextResponse(`signature verification failed: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        return NextResponse.json({ received: true, type: event.type });
      case "checkout.session.expired":
        console.info("[stripe-webhook] checkout.session.expired", event.id);
        return NextResponse.json({ received: true, type: event.type });
      default:
        console.info("[stripe-webhook] ignored event", event.type, event.id);
        return NextResponse.json({ received: true, type: event.type, ignored: true });
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    if (
      err instanceof MetadataParseError ||
      err instanceof ExhibitorMetadataParseError ||
      err instanceof GroupPayloadParseError
    ) {
      // Malformed metadata means we can't ever process this session. Return
      // 200 so Stripe stops retrying; the admin will see an unsent
      // confirmation and can investigate.
      return NextResponse.json(
        { received: true, error: err.message, permanent: true },
        { status: 200 },
      );
    }
    return new NextResponse("internal server error", { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const eventSession = event.data.object as Stripe.Checkout.Session;
  if (eventSession.mode !== "payment") {
    console.info("[stripe-webhook] skipping non-payment session", eventSession.id);
    return;
  }
  // Accept both "paid" (money changed hands) and "no_payment_required"
  // (a 100%-off promotion code, a comp booking). Stripe fires
  // checkout.session.completed for both; the booking is real in both
  // cases and should get a confirmation email and account access.
  if (
    eventSession.payment_status !== "paid" &&
    eventSession.payment_status !== "no_payment_required"
  ) {
    console.info(
      "[stripe-webhook] skipping session with payment_status",
      eventSession.payment_status,
      eventSession.id,
    );
    return;
  }

  const metadata = eventSession.metadata ?? {};
  if (metadata.booking_type === "partner_payment") {
    await handlePartnerPaymentCompleted(eventSession, event);
    return;
  }
  if (metadata.booking_type === "exhibitor") {
    await handleExhibitorSessionCompleted(eventSession, event);
    return;
  }
  if (metadata.booking_type === "group_delegate") {
    await handleGroupSessionCompleted(eventSession);
    return;
  }
  if (metadata.booking_type !== "delegate") {
    console.info(
      "[stripe-webhook] unrecognised booking_type, skipping",
      metadata.booking_type,
      eventSession.id,
    );
    return;
  }

  const parsed = metadataToParsed(metadata);

  // Re-retrieve the session with the discount / promotion-code fields
  // expanded so we can persist which code was used (if any). The event
  // payload omits these expansions by default.
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["total_details.breakdown.discounts", "discounts.promotion_code"],
  });

  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // Stripe reports amount_total (gross) and total_details.amount_tax (VAT).
  // On test without Stripe Tax enabled, amount_tax may be 0 or absent; we
  // persist whatever Stripe reports. This is what we show on the receipt.
  const vatAmountPence = session.total_details?.amount_tax ?? 0;
  const grossPaidPence = session.amount_total ?? 0;
  const promo = extractPromoDetails(session);
  const paymentStatus: "paid" | "comp" =
    session.payment_status === "no_payment_required" ? "comp" : "paid";

  const supabase = createSupabaseServiceClient();

  // Ambassador attribution: last-touch ref slug carried in the session
  // metadata, resolved to an ACTIVE ambassador now. Unknown/inactive
  // slugs (or none) degrade to null silently.
  const ambassadorId = await resolveAmbassadorIdForSlug(
    supabase,
    metadata[REF_METADATA_KEY],
  );

  const result = await createDelegateBookingFromCheckoutSession({
    client: supabase,
    parsed,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    vatAmountPence,
    paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000),
    promo,
    paymentStatus,
    ambassadorId,
  });

  // TomCRM sync. Runs on every delivery (not just isNew) so a crash
  // between booking creation and this line is healed by Stripe's retry;
  // both CRM calls are idempotent so re-delivery cannot duplicate a
  // contact or stack a tag. Failures log loudly and change nothing.
  await pushContactToCrmSafe(
    {
      email: parsed.intent.email,
      firstName: parsed.intent.firstName,
      lastName: parsed.intent.surname,
      phone: parsed.intent.mobile || null,
      tags: crmTagsForBooking("delegate", parsed.intent.ticketType, {
        ambassadorAttributed: Boolean(ambassadorId) && paymentStatus === "paid",
      }),
    },
    `delegate webhook ${result.bookingReference}`,
  );

  // Three-branch idempotency + retry logic. See SPEC.md "Stripe webhook
  // idempotency and retry".
  //
  // 1. Fresh booking: created above, attempt email.
  // 2. Existing booking with confirmation_email_sent_at NULL: skip the DB
  //    write (done previously), attempt email. This recovers a first
  //    attempt that succeeded at the DB but failed at Resend; Stripe
  //    retries (up to 3 days) drive us through this branch until the
  //    email dispatches.
  // 3. Existing booking with confirmation_email_sent_at set: no-op.
  //
  // Concurrent-webhook note: Stripe very rarely delivers the same event
  // twice in quick succession. Both deliveries could see the flag NULL
  // and both could dispatch the email, giving the customer two identical
  // emails. We accept this: a visible, self-correcting failure mode is
  // preferable to marking the flag before the Resend call returns (which
  // would risk silently marking-sent-but-not-actually-sent on a mid-send
  // crash). Double-sends are expected to be extremely rare; if we see
  // them in practice, a follow-up PR can add a Postgres advisory lock.

  if (result.isNew) {
    await trySendConfirmation(result, parsed, vatAmountPence, grossPaidPence, "new booking");
    return;
  }

  if (result.confirmationEmailSentAt === null) {
    console.info(
      "[stripe-webhook] retrying confirmation email for existing booking",
      session.id,
      result.bookingId,
    );
    await trySendConfirmation(result, parsed, vatAmountPence, grossPaidPence, "retry");
    return;
  }

  console.info(
    "[stripe-webhook] duplicate webhook, email already sent",
    session.id,
    result.bookingId,
    result.confirmationEmailSentAt,
  );
}

// Partner payment: no booking is created. The request row flips to
// paid with the Stripe references, the partner's derived state
// (unpaid / part-paid / paid in full) follows from the ledger, and
// our confirmation email goes out with the 3-branch idempotency the
// booking paths use. A SECOND session paying an already-paid request
// is real double-charged money: it is logged loudly for a manual
// refund and nothing else changes.
async function handlePartnerPaymentCompleted(
  eventSession: Stripe.Checkout.Session,
  event: Stripe.Event,
): Promise<void> {
  const metadata = eventSession.metadata ?? {};
  const requestId = metadata.partner_payment_request_id;
  if (!requestId) {
    throw new MetadataParseError("partner payment session missing request id");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("partner_payment_requests")
    .select(
      `id, partner_id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at,
       stripe_checkout_session_id, confirmation_email_sent_at,
       partners ( id, company_name, contact_name, contact_email, tier, agreed_price_pence )`,
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`partner payment request lookup failed: ${error.message}`);
  if (!data) {
    // Unknown id can never succeed on retry; 200 via MetadataParseError.
    throw new MetadataParseError(`partner payment request not found: ${requestId}`);
  }
  type RequestRow = {
    id: string;
    partner_id: string;
    amount_ex_vat_pence: number;
    status: string;
    expires_at: string;
    sent_at: string | null;
    paid_at: string | null;
    stripe_checkout_session_id: string | null;
    confirmation_email_sent_at: string | null;
    partners: {
      id: string;
      company_name: string;
      contact_name: string;
      contact_email: string;
      tier: "headline" | "speakers_den" | "partner";
      agreed_price_pence: number;
    } | null;
  };
  const request = data as unknown as RequestRow;
  if (!request.partners) {
    throw new MetadataParseError(`partner missing for payment request ${requestId}`);
  }

  const vatAmountPence = eventSession.total_details?.amount_tax ?? 0;
  const grossPaidPence = eventSession.amount_total ?? 0;

  if (request.status === "paid") {
    if (request.stripe_checkout_session_id !== eventSession.id) {
      // Two sessions both paid (e.g. two tabs racing). Money was taken
      // twice; make it loud for a manual refund in the dashboard.
      console.error(
        "[stripe-webhook] PARTNER DOUBLE PAYMENT:",
        JSON.stringify({
          request_id: request.id,
          partner_id: request.partner_id,
          first_session: request.stripe_checkout_session_id,
          second_session: eventSession.id,
          gross_paid_pence: grossPaidPence,
        }),
      );
      return;
    }
    // Same session redelivered: retry the confirmation email if it
    // never dispatched, otherwise a clean no-op.
    if (request.confirmation_email_sent_at === null) {
      try {
        await sendPartnerPaymentConfirmationEmail({
          service: supabase,
          requestId: request.id,
          partner: request.partners,
          grossPaidPence,
          vatAmountPence,
        });
      } catch (err) {
        console.error(
          "[stripe-webhook] partner confirmation retry failed (continuing)",
          request.id,
          err,
        );
      }
    }
    return;
  }

  const stripePaymentIntentId =
    typeof eventSession.payment_intent === "string"
      ? eventSession.payment_intent
      : eventSession.payment_intent?.id ?? null;

  // Flip only from a non-paid state; the filter makes redelivery races
  // collapse to a single winner.
  const { data: updated, error: updateErr } = await supabase
    .from("partner_payment_requests")
    .update({
      status: "paid",
      paid_at: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      stripe_checkout_session_id: eventSession.id,
      stripe_payment_intent_id: stripePaymentIntentId,
      vat_amount_pence: vatAmountPence,
      gross_paid_pence: grossPaidPence,
    })
    .eq("id", request.id)
    .neq("status", "paid")
    .select("id");
  if (updateErr) throw new Error(`partner payment update failed: ${updateErr.message}`);
  if (!updated || (updated as unknown[]).length === 0) {
    console.info("[stripe-webhook] partner payment already recorded", request.id);
    return;
  }

  console.info(
    "[stripe-webhook] partner payment received",
    JSON.stringify({
      request_id: request.id,
      partner_id: request.partner_id,
      gross_paid_pence: grossPaidPence,
    }),
  );

  try {
    await sendPartnerPaymentConfirmationEmail({
      service: supabase,
      requestId: request.id,
      partner: request.partners,
      grossPaidPence,
      vatAmountPence,
    });
  } catch (err) {
    // Same policy as bookings: log, return 200; Stripe's retries
    // re-enter the confirmation branch above until it dispatches.
    console.error(
      "[stripe-webhook] partner confirmation email failed (continuing)",
      request.id,
      err,
    );
  }
}

// Group delegate bookings: metadata carries only the intent id (the
// full 2-10 ticket intent lives in pending_group_intents). One booking
// per ticket is created idempotently, ONE confirmation email goes to
// the lead, and every named attendee is pushed to the CRM.
async function handleGroupSessionCompleted(
  eventSession: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = eventSession.metadata ?? {};
  const groupIntentId = metadata.group_intent_id;
  if (!groupIntentId) {
    throw new MetadataParseError("group session missing group_intent_id");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["total_details.breakdown.discounts", "discounts.promotion_code"],
  });

  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const vatAmountPence = session.total_details?.amount_tax ?? 0;
  const grossPaidPence = session.amount_total ?? 0;
  const paymentStatus: "paid" | "comp" =
    session.payment_status === "no_payment_required" ? "comp" : "paid";

  const supabase = createSupabaseServiceClient();
  const ambassadorId = await resolveAmbassadorIdForSlug(
    supabase,
    metadata[REF_METADATA_KEY],
  );

  const result = await createGroupBookingsFromCheckoutSession({
    client: supabase,
    groupIntentId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    paymentStatus,
    ambassadorId,
  });

  // CRM: every NAMED attendee, each under their own ticket's tag. TBC
  // placeholders are skipped (their seat has no person yet). Same
  // idempotency and failure isolation as the single paths.
  const { intent } = result.payload;
  const lead = groupLead(intent);
  for (const t of intent.tickets) {
    if (t.tbc) continue;
    await pushContactToCrmSafe(
      {
        email: t.email,
        firstName: t.firstName,
        lastName: t.surname,
        phone: t.email === lead.email ? intent.leadMobile || null : null,
        tags: crmTagsForBooking("delegate", t.ticketType, {
          ambassadorAttributed: Boolean(ambassadorId) && paymentStatus === "paid",
        }),
      },
      `group webhook ${result.leadBookingReference}`,
    );
  }

  const trySend = async (pathLabel: string) => {
    try {
      await sendGroupConfirmationEmail({
        leadBookingId: result.leadBookingId,
        bookingReferences: result.bookingReferences,
        payload: result.payload,
        grossPaidPence,
        vatAmountPence,
      });
    } catch (err) {
      console.error(
        `[stripe-webhook] group confirmation email failed on ${pathLabel} (continuing)`,
        result.leadBookingId,
        err,
      );
    }
  };

  if (result.isNew) {
    await trySend("new booking");
    return;
  }
  if (result.confirmationEmailSentAt === null) {
    console.info(
      "[stripe-webhook] retrying group confirmation email",
      session.id,
      result.leadBookingId,
    );
    await trySend("retry");
    return;
  }
  console.info(
    "[stripe-webhook] duplicate group webhook, email already sent",
    session.id,
    result.leadBookingId,
  );
}

// Exhibitor twin of the delegate path above: same session re-retrieve,
// same promo/comp handling, same 3-branch idempotency for the email.
async function handleExhibitorSessionCompleted(
  eventSession: Stripe.Checkout.Session,
  event: Stripe.Event,
): Promise<void> {
  const parsed = metadataToParsedExhibitor(eventSession.metadata ?? {});

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["total_details.breakdown.discounts", "discounts.promotion_code"],
  });

  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const vatAmountPence = session.total_details?.amount_tax ?? 0;
  const grossPaidPence = session.amount_total ?? 0;
  const promo = extractPromoDetails(session);
  const paymentStatus: "paid" | "comp" =
    session.payment_status === "no_payment_required" ? "comp" : "paid";

  const supabase = createSupabaseServiceClient();

  const ambassadorId = await resolveAmbassadorIdForSlug(
    supabase,
    (eventSession.metadata ?? {})[REF_METADATA_KEY],
  );

  const result = await createExhibitorBookingFromCheckoutSession({
    client: supabase,
    parsed,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    vatAmountPence,
    paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000),
    promo,
    paymentStatus,
    ambassadorId,
  });

  // Exhibitor profile page: paid (or comp) booking = page exists, no
  // approval step. Idempotent, and a failure here never affects the
  // booking or the email.
  await ensureExhibitorProfileSafe(
    supabase,
    {
      bookingId: result.bookingId,
      companyName: parsed.intent.company,
      fallbackName: null,
      contactEmail: parsed.intent.contactEmail,
      logoPath: null,
      websiteUrl: parsed.intent.website || null,
    },
    `exhibitor webhook ${result.bookingReference}`,
  );

  // TomCRM sync: the MAIN CONTACT is the CRM record for an exhibitor
  // booking. Same idempotency/failure-isolation notes as the delegate
  // path.
  await pushContactToCrmSafe(
    {
      email: parsed.intent.contactEmail,
      firstName: parsed.intent.contactFirstName,
      lastName: parsed.intent.contactSurname,
      phone: parsed.intent.contactMobile || null,
      tags: crmTagsForBooking("exhibitor", "exhibitor", {
        ambassadorAttributed: Boolean(ambassadorId) && paymentStatus === "paid",
      }),
    },
    `exhibitor webhook ${result.bookingReference}`,
  );

  // The cap is enforced at page render and at checkout creation, but a
  // race (two checkouts open at stand 50) can still pay past it. Money
  // has been taken so the booking is stored regardless; this makes the
  // oversell loud so the organisers can refund one booking manually.
  if (result.isNew) {
    try {
      const sold = await countCompletedExhibitorBookings(supabase);
      if (sold > EXHIBITOR_STAND_CAP) {
        console.error(
          `[stripe-webhook] STAND CAP EXCEEDED: ${sold}/${EXHIBITOR_STAND_CAP} paid exhibitor bookings; latest`,
          result.bookingReference,
        );
      }
    } catch (err) {
      console.error("[stripe-webhook] stand-cap check failed (continuing)", err);
    }
  }

  if (result.isNew) {
    await trySendExhibitorConfirmation(result, parsed, vatAmountPence, grossPaidPence, "new booking");
    return;
  }

  if (result.confirmationEmailSentAt === null) {
    console.info(
      "[stripe-webhook] retrying exhibitor confirmation email",
      session.id,
      result.bookingId,
    );
    await trySendExhibitorConfirmation(result, parsed, vatAmountPence, grossPaidPence, "retry");
    return;
  }

  console.info(
    "[stripe-webhook] duplicate exhibitor webhook, email already sent",
    session.id,
    result.bookingId,
    result.confirmationEmailSentAt,
  );
}

async function trySendExhibitorConfirmation(
  result: { bookingId: string; bookingReference: string },
  parsed: Parameters<typeof sendExhibitorConfirmationEmail>[0]["parsed"],
  vatAmountPence: number,
  grossPaidPence: number,
  pathLabel: "new booking" | "retry",
): Promise<void> {
  try {
    await sendExhibitorConfirmationEmail({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      parsed,
      vatAmountPence,
      grossPaidPence,
    });
  } catch (err) {
    // Same policy as the delegate path: log, return 200, let Stripe's
    // scheduled retries re-drive the email via the sent-flag branch.
    console.error(
      `[stripe-webhook] exhibitor confirmation email failed on ${pathLabel} (continuing)`,
      result.bookingId,
      err,
    );
  }
}

// Pull the (single) redeemed promotion code off a completed session.
// Stripe returns discounts as an array on the session; a Checkout
// Session only ever carries one because customers can enter one code.
// We prefer total_details.breakdown.discounts[].amount for the total
// discount because that reflects post-tax reconciliation; fall back to
// deriving from amount_subtotal - amount_total if the breakdown is
// absent (should not happen in practice with automatic_tax enabled).
function extractPromoDetails(
  session: Stripe.Checkout.Session,
): { code: string; promotionCodeId: string; discountPence: number } | null {
  const discount = session.discounts?.[0];
  if (!discount) return null;

  const promotionCode = discount.promotion_code;
  // discount.promotion_code is a string id when not expanded, a
  // Stripe.PromotionCode when expanded, or null.
  if (!promotionCode) return null;

  const codeString =
    typeof promotionCode === "string" ? null : promotionCode.code;
  const codeId = typeof promotionCode === "string" ? promotionCode : promotionCode.id;
  if (!codeString || !codeId) return null;

  const breakdownDiscounts = session.total_details?.breakdown?.discounts ?? [];
  const totalDiscountPence = breakdownDiscounts.reduce(
    (sum, d) => sum + (d.amount ?? 0),
    0,
  );
  const discountPence =
    totalDiscountPence > 0
      ? totalDiscountPence
      : Math.max(0, (session.amount_subtotal ?? 0) - (session.amount_total ?? 0));

  return { code: codeString, promotionCodeId: codeId, discountPence };
}

async function trySendConfirmation(
  result: {
    bookingId: string;
    bookingReference: string;
  },
  parsed: Parameters<typeof sendDelegateConfirmationEmail>[0]["parsed"],
  vatAmountPence: number,
  grossPaidPence: number,
  pathLabel: "new booking" | "retry",
): Promise<void> {
  try {
    await sendDelegateConfirmationEmail({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      parsed,
      vatAmountPence,
      grossPaidPence,
    });
  } catch (err) {
    // Logged but swallowed. The webhook still returns 200 so Stripe does
    // not retry-storm on a transient email outage. confirmation_email_sent_at
    // stays NULL and Stripe's next scheduled retry (up to 3 days) will
    // re-enter branch 2 of the idempotency logic above.
    console.error(
      `[stripe-webhook] confirmation email failed on ${pathLabel} (continuing)`,
      result.bookingId,
      err,
    );
  }
}
