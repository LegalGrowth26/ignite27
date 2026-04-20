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
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment") {
    console.info("[stripe-webhook] skipping non-payment session", session.id);
    return;
  }
  if (session.payment_status !== "paid") {
    console.info(
      "[stripe-webhook] skipping session with payment_status",
      session.payment_status,
      session.id,
    );
    return;
  }

  const metadata = session.metadata ?? {};
  if (metadata.booking_type !== "delegate") {
    console.info("[stripe-webhook] non-delegate booking, skipping", session.id);
    return;
  }

  const parsed = metadataToParsed(metadata);

  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // Stripe reports amount_total (gross) and total_details.amount_tax (VAT).
  // On test without Stripe Tax enabled, amount_tax may be 0 or absent; we
  // persist whatever Stripe reports. This is what we show on the receipt.
  const vatAmountPence = session.total_details?.amount_tax ?? 0;

  const supabase = createSupabaseServiceClient();

  const result = await createDelegateBookingFromCheckoutSession({
    client: supabase,
    parsed,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId,
    vatAmountPence,
    paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000),
  });

  if (!result.isNew) {
    console.info(
      "[stripe-webhook] duplicate webhook, booking already exists",
      session.id,
      result.bookingId,
    );
    return;
  }

  // Email send failures are logged but never fail the webhook.
  // The confirmation_email_sent_at flag stays null so admin can resend.
  try {
    await sendDelegateConfirmationEmail({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      parsed,
      vatAmountPence,
    });
  } catch (err) {
    console.error(
      "[stripe-webhook] confirmation email failed (continuing)",
      result.bookingId,
      err,
    );
  }
}
