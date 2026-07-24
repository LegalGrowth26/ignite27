import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { createDelegateBookingFromCheckoutSession } from "@/lib/bookings/create";
import { metadataToParsed, MetadataParseError } from "@/lib/bookings/intent";
import { env } from "@/lib/env";
import { sendDelegateConfirmationEmail } from "@/lib/bookings/send-confirmation";
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
    if (err instanceof MetadataParseError) {
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
  if (metadata.booking_type !== "delegate") {
    console.info("[stripe-webhook] non-delegate booking, skipping", eventSession.id);
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

  const result = await createDelegateBookingFromCheckoutSession({
    client: supabase,
    parsed,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    vatAmountPence,
    paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000),
    promo,
    paymentStatus,
  });

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
