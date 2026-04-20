import type Stripe from "stripe";
import {
  generateBookingReference,
} from "@/lib/bookings/reference";
import {
  intentToMetadata,
  type DelegateBookingIntent,
  type DelegatePricingSnapshot,
} from "@/lib/bookings/intent";
import { env } from "@/lib/env";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
} from "@/lib/pricing";
import { getStripe } from "./client";

export interface CreateDelegateCheckoutSessionInput {
  intent: DelegateBookingIntent;
  termsAcceptedIp: string;
  // The instant used for pricing-window selection only. May be shifted by
  // BOOKING_TEST_OVERRIDE_DATE (see lib/bookings/test-override.ts). This
  // function internally uses real wall-clock time for any timestamp that
  // Stripe or a future audit reads, so callers can safely pass an
  // override-shifted value here.
  pricingNow: Date;
}

export interface DelegateCheckoutSessionResult {
  url: string;
  sessionId: string;
  bookingReference: string;
  pricing: DelegatePricingSnapshot;
}

export class BookingsNotOpenForCheckoutError extends Error {
  constructor() {
    super("bookings not yet open");
    this.name = "BookingsNotOpenForCheckoutError";
  }
}

export class BookingsClosedForCheckoutError extends Error {
  constructor() {
    super("bookings closed");
    this.name = "BookingsClosedForCheckoutError";
  }
}

export function computeDelegatePricing(
  intent: DelegateBookingIntent,
  now: Date,
): DelegatePricingSnapshot {
  const current = getCurrentPricing(now);
  const ticketPricePence =
    intent.ticketType === "vip" ? current.delegate.vip : current.delegate.regular;
  // VIP includes lunch already; no separate lunch line.
  // Regular with the lunch add-on gets a separate £15 line.
  const lunchPricePence =
    intent.ticketType === "regular" && intent.lunchIncluded
      ? current.delegate.lunchAddOn
      : 0;
  const charityUpliftPence = current.charityUplift;
  const grossAmountPence = ticketPricePence + lunchPricePence + charityUpliftPence;

  return {
    window: current.window,
    ticketPricePence,
    lunchPricePence,
    charityUpliftPence,
    grossAmountPence,
  };
}

function ticketProductName(intent: DelegateBookingIntent): string {
  if (intent.ticketType === "vip") return "Ignite 27 VIP ticket";
  return "Ignite 27 delegate ticket";
}

function ticketProductDescription(intent: DelegateBookingIntent): string {
  if (intent.ticketType === "vip") {
    return "Full-day access, lunch included, premium badge.";
  }
  return "Full-day access. Add lunch separately if you picked it.";
}

function buildLineItems(
  intent: DelegateBookingIntent,
  pricing: DelegatePricingSnapshot,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.ticketPricePence,
        tax_behavior: "inclusive",
        product_data: {
          name: ticketProductName(intent),
          description: ticketProductDescription(intent),
        },
      },
    },
  ];

  if (pricing.lunchPricePence > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.lunchPricePence,
        tax_behavior: "inclusive",
        product_data: {
          name: "Lunch at Ignite 27",
          description: "Hot lunch on the day, dietary options catered for.",
        },
      },
    });
  }

  if (pricing.charityUpliftPence > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.charityUpliftPence,
        tax_behavior: "inclusive",
        product_data: {
          name: "Lincoln City Foundation donation",
          description: "£5 charity uplift for event-day bookings.",
        },
      },
    });
  }

  return items;
}

export async function createDelegateCheckoutSession(
  input: CreateDelegateCheckoutSessionInput,
): Promise<DelegateCheckoutSessionResult> {
  const { intent, termsAcceptedIp, pricingNow } = input;

  // pricingNow decides which pricing window applies. It can be shifted by the
  // BOOKING_TEST_OVERRIDE_DATE env var so we can exercise the flow before
  // Window 1 opens. Anything Stripe reads (expires_at) or we persist as a
  // real-world audit event (terms acceptance) must use real wall-clock time:
  // Stripe validates expires_at against its own clock, and termsAcceptedAt is
  // the legal record of when the user ticked the box.
  const realNow = new Date();

  let pricing: DelegatePricingSnapshot;
  try {
    pricing = computeDelegatePricing(intent, pricingNow);
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
  const metadataObject = intentToMetadata(
    intent,
    pricing,
    bookingReference,
    termsAcceptedAt,
    termsAcceptedIp,
  );
  // Stripe's MetadataParam is Record<string, string>; our typed shape is a
  // superset but TS needs an index signature. Spread into a plain record.
  const metadata: Record<string, string> = { ...metadataObject };

  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const successUrl = `${siteUrl}/attend/book/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}/attend/book/cancel`;

  const stripe = getStripe();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    currency: "gbp",
    line_items: buildLineItems(intent, pricing),
    customer_email: intent.email,
    client_reference_id: bookingReference,
    metadata,
    payment_intent_data: {
      statement_descriptor_suffix: "IGNITE 27",
      metadata,
    },
    automatic_tax: { enabled: true },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: false,
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
