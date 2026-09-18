import type Stripe from "stripe";
import { generateBookingReference } from "@/lib/bookings/reference";
import {
  exhibitorIntentToMetadata,
  type ExhibitorBookingIntent,
  type ExhibitorPricingSnapshot,
} from "@/lib/bookings/exhibitor-intent";
import { env } from "@/lib/env";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
} from "@/lib/pricing";
import {
  BookingsClosedForCheckoutError,
  BookingsNotOpenForCheckoutError,
} from "./checkout";
import { getStripe } from "./client";
import { ensureStripeProducts, STRIPE_PRODUCT_IDS } from "./products";

export interface CreateExhibitorCheckoutSessionInput {
  intent: ExhibitorBookingIntent;
  termsAcceptedIp: string;
  // Pricing-window selection only; may be shifted by
  // BOOKING_TEST_OVERRIDE_DATE. Real wall-clock time is used for
  // anything Stripe validates or we persist as an audit record, same as
  // the delegate flow.
  pricingNow: Date;
}

export interface ExhibitorCheckoutSessionResult {
  url: string;
  sessionId: string;
  bookingReference: string;
  pricing: ExhibitorPricingSnapshot;
}

// Thrown by the booking action when the stand cap is already reached.
// Defined here with the other checkout refusal errors so the action
// maps all three the same way.
export class StandsSoldOutError extends Error {
  constructor() {
    super("exhibitor stands sold out");
    this.name = "StandsSoldOutError";
  }
}

export function computeExhibitorPricing(now: Date): ExhibitorPricingSnapshot {
  const current = getCurrentPricing(now);
  const stand = current.exhibitor;
  return {
    period: current.period,
    standExVatPence: stand.exVatPence,
    standVatPence: stand.vatPence,
    standIncVatPence: stand.incVatPence,
    // One line item today, so gross = stand. Kept as separate fields so
    // add-ons (extra lunches, power) can join later without reshaping
    // metadata or the email/DB writers.
    grossExVatPence: stand.exVatPence,
    grossVatPence: stand.vatPence,
    grossIncVatPence: stand.incVatPence,
  };
}

export function buildExhibitorLineItems(
  pricing: ExhibitorPricingSnapshot,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  // Ex-VAT with tax_behavior "exclusive", identical to the delegate
  // flow: Stripe Tax adds 20% UK VAT on top and itemises it on the
  // receipt, and discount codes apply to the ex-VAT base. References
  // the FIXED exhibitor product (ad-hoc period price via price_data)
  // so coupon applies_to restrictions can target stands.
  return [
    {
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.standExVatPence,
        tax_behavior: "exclusive",
        product: STRIPE_PRODUCT_IDS.exhibitor,
      },
    },
  ];
}

export async function createExhibitorCheckoutSession(
  input: CreateExhibitorCheckoutSessionInput,
): Promise<ExhibitorCheckoutSessionResult> {
  const { intent, termsAcceptedIp, pricingNow } = input;
  const realNow = new Date();

  let pricing: ExhibitorPricingSnapshot;
  try {
    pricing = computeExhibitorPricing(pricingNow);
  } catch (err) {
    if (err instanceof BookingsNotOpenError) {
      throw new BookingsNotOpenForCheckoutError();
    }
    if (err instanceof BookingsClosedError) {
      throw new BookingsClosedForCheckoutError();
    }
    throw err;
  }

  const bookingReference = generateBookingReference();
  const termsAcceptedAt = realNow.toISOString();
  const metadata = exhibitorIntentToMetadata(
    intent,
    pricing,
    bookingReference,
    termsAcceptedAt,
    termsAcceptedIp,
  );

  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const successUrl = `${siteUrl}/exhibit/book/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}/exhibit/book/cancel`;

  const stripe = getStripe();
  // Self-provision the fixed exhibitor product in this mode (no-op
  // after the first call per process).
  await ensureStripeProducts(stripe, ["exhibitor"]);
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    currency: "gbp",
    line_items: buildExhibitorLineItems(pricing),
    customer_email: intent.contactEmail,
    client_reference_id: bookingReference,
    metadata,
    payment_intent_data: {
      statement_descriptor_suffix: "IGNITE 27",
      metadata,
    },
    automatic_tax: { enabled: true },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    expires_at: Math.floor(realNow.getTime() / 1000) + 30 * 60,
  };
  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return {
    url: session.url,
    sessionId: session.id,
    bookingReference,
    pricing,
  };
}
