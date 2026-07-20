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

  const ticket = intent.ticketType === "vip" ? current.delegate.vip : current.delegate.regular;
  // VIP includes lunch already; no separate lunch line.
  // Regular with the lunch add-on gets a separate line item.
  const includeLunchLine = intent.ticketType === "regular" && intent.lunchIncluded;
  const lunch = includeLunchLine
    ? current.delegate.lunchAddOn
    : { exVatPence: 0, vatPence: 0, incVatPence: 0 };

  return {
    period: current.period,
    ticketExVatPence: ticket.exVatPence,
    ticketVatPence: ticket.vatPence,
    ticketIncVatPence: ticket.incVatPence,
    lunchExVatPence: lunch.exVatPence,
    lunchVatPence: lunch.vatPence,
    lunchIncVatPence: lunch.incVatPence,
    grossExVatPence: ticket.exVatPence + lunch.exVatPence,
    grossVatPence: ticket.vatPence + lunch.vatPence,
    grossIncVatPence: ticket.incVatPence + lunch.incVatPence,
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
  // Pricing v2: line items are ex-VAT and tax_behavior is "exclusive". With
  // automatic_tax enabled, Stripe Tax adds 20% UK VAT on top and shows it as
  // a separate line on the receipt. The customer-charged total is unchanged
  // versus the previous inclusive presentation (e.g. a £25+VAT delegate
  // ticket still charges £30 in total), but tax reporting and any future
  // discount codes apply cleanly to the ex-VAT base — the discount reduces
  // the ex-VAT amount and VAT is recomputed on the discounted total.
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.ticketExVatPence,
        tax_behavior: "exclusive",
        product_data: {
          name: ticketProductName(intent),
          description: ticketProductDescription(intent),
        },
      },
    },
  ];

  if (pricing.lunchExVatPence > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pricing.lunchExVatPence,
        tax_behavior: "exclusive",
        product_data: {
          name: "Lunch at Ignite 27",
          description: "Hot lunch on the day, dietary options catered for.",
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

  // pricingNow decides which pricing period applies. It can be shifted by the
  // BOOKING_TEST_OVERRIDE_DATE env var so we can exercise the flow before the
  // launch period opens. Anything Stripe reads (expires_at) or we persist as
  // a real-world audit event (terms acceptance) must use real wall-clock
  // time: Stripe validates expires_at against its own clock, and
  // termsAcceptedAt is the legal record of when the user ticked the box.
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
