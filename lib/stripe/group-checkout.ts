import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REF_METADATA_KEY } from "@/lib/ambassadors/attribution";
import {
  groupLead,
  type AppliedDiscountRecord,
  type GroupBookingIntent,
  type GroupIntentPayload,
} from "@/lib/bookings/group-intent";
import { env } from "@/lib/env";
import { BookingsClosedError, BookingsNotOpenError } from "@/lib/pricing";
import {
  computeCouponDiscountPence,
  computeGroupPricing,
  groupDiscountPercent,
  pickAppliedDiscount,
  type DiscountableLine,
} from "@/lib/pricing/group";
import {
  BookingsClosedForCheckoutError,
  BookingsNotOpenForCheckoutError,
} from "./checkout";
import { getStripe } from "./client";
import { ensureStripeProducts, STRIPE_PRODUCT_IDS } from "./products";

// Group checkout session creation. The big differences from the single
// flow:
//   - the intent lives in pending_group_intents (metadata 50-key cap),
//   - discounts are OURS to decide: allow_promotion_codes and
//     pre-applied discounts are mutually exclusive in Stripe, so the
//     group form collects the code itself, we value it against the
//     group tier, and exactly one of them rides on the session.

// Deterministic group coupons, self-provisioned per mode exactly like
// the fixed products: percent off, restricted to the two TICKET
// products so the lunch line can never be discounted.
const GROUP_COUPON_IDS: Record<number, string> = {
  10: "ignite27_group10",
  25: "ignite27_group25",
};

const ensuredCoupons = new Set<string>();

function isMissingResource(err: unknown): boolean {
  return (err as { code?: string })?.code === "resource_missing";
}

function isAlreadyExists(err: unknown): boolean {
  return (err as { code?: string })?.code === "resource_already_exists";
}

export async function ensureGroupCoupon(
  stripe: Stripe,
  percent: 10 | 25,
): Promise<string> {
  const id = GROUP_COUPON_IDS[percent]!;
  if (ensuredCoupons.has(id)) return id;

  try {
    await stripe.coupons.retrieve(id);
    ensuredCoupons.add(id);
    return id;
  } catch (err) {
    if (!isMissingResource(err)) throw err;
  }

  try {
    await stripe.coupons.create({
      id,
      name: `IGNITE! 27 group discount (${percent}% off tickets)`,
      percent_off: percent,
      duration: "once",
      applies_to: {
        products: [STRIPE_PRODUCT_IDS.delegate, STRIPE_PRODUCT_IDS.vip],
      },
      metadata: { source: "ignite27-site", ignite27_group_percent: String(percent) },
    });
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
  ensuredCoupons.add(id);
  return id;
}

// Test seam.
export function resetEnsuredGroupCouponsForTests(): void {
  ensuredCoupons.clear();
}

export class InvalidGroupDiscountCodeError extends Error {
  constructor() {
    super("discount code not valid");
    this.name = "InvalidGroupDiscountCodeError";
  }
}

// Value a dashboard promotion code against the group's lines. Unknown
// or inactive codes throw InvalidGroupDiscountCodeError so the form
// can say so instead of silently charging full price.
export async function resolvePromoCodeValue(
  stripe: Stripe,
  code: string,
  lines: readonly DiscountableLine[],
): Promise<{ code: string; promotionCodeId: string; discountPence: number }> {
  const { data } = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.coupon.applies_to"],
  });
  const promo = data[0];
  if (!promo || !promo.coupon?.valid) {
    throw new InvalidGroupDiscountCodeError();
  }
  const coupon = promo.coupon;
  const discountPence = computeCouponDiscountPence(
    {
      percentOff: coupon.percent_off ?? null,
      amountOffPence: coupon.amount_off ?? null,
      appliesToProducts: coupon.applies_to?.products ?? null,
    },
    lines,
  );
  return { code: promo.code, promotionCodeId: promo.id, discountPence };
}

export interface CreateGroupCheckoutInput {
  intent: GroupBookingIntent;
  termsAcceptedIp: string;
  refSlug?: string | null;
  pricingNow: Date;
  // Service client used ONLY to store the intent row.
  serviceClient: SupabaseClient;
}

export interface GroupCheckoutResult {
  url: string;
  sessionId: string;
  applied: AppliedDiscountRecord;
}

export async function createGroupCheckoutSession(
  input: CreateGroupCheckoutInput,
): Promise<GroupCheckoutResult> {
  const { intent, termsAcceptedIp, pricingNow, serviceClient } = input;
  const realNow = new Date();

  // Pricing snapshot at FULL prices first: the discount decision below
  // determines whether the per-ticket allocation carries the group
  // discount or the code rides on the session instead.
  let fullPricing;
  try {
    fullPricing = computeGroupPricing(
      intent.tickets.map((t) => ({
        ticketType: t.ticketType,
        lunchIncluded: t.lunchIncluded,
      })),
      pricingNow,
      false,
    );
  } catch (err) {
    if (err instanceof BookingsNotOpenError) throw new BookingsNotOpenForCheckoutError();
    if (err instanceof BookingsClosedError) throw new BookingsClosedForCheckoutError();
    throw err;
  }

  const stripe = getStripe();
  await ensureStripeProducts(stripe, ["delegate", "vip", "lunch"]);

  // The lines a code could touch, aggregated by product.
  const regularCount = intent.tickets.filter((t) => t.ticketType === "regular").length;
  const vipCount = intent.tickets.filter((t) => t.ticketType === "vip").length;
  const lunchCount = intent.tickets.filter(
    (t) => t.ticketType === "regular" && t.lunchIncluded,
  ).length;
  const regularUnit =
    regularCount > 0
      ? fullPricing.tickets.find((t) => t.ticketType === "regular")!.ticketExVatPence
      : 0;
  const vipUnit =
    vipCount > 0
      ? fullPricing.tickets.find((t) => t.ticketType === "vip")!.ticketExVatPence
      : 0;
  const lunchUnit =
    lunchCount > 0
      ? fullPricing.tickets.find((t) => t.lunchExVatPence > 0)!.lunchExVatPence
      : 0;

  const discountableLines: DiscountableLine[] = [
    { productId: STRIPE_PRODUCT_IDS.delegate, exVatPence: regularUnit * regularCount },
    { productId: STRIPE_PRODUCT_IDS.vip, exVatPence: vipUnit * vipCount },
    { productId: STRIPE_PRODUCT_IDS.lunch, exVatPence: lunchUnit * lunchCount },
  ].filter((l) => l.exVatPence > 0);

  // Value the typed code (if any) and pick the single larger discount.
  const codeValue = intent.discountCode
    ? await resolvePromoCodeValue(stripe, intent.discountCode, discountableLines)
    : null;
  const decision = pickAppliedDiscount(
    {
      percent: fullPricing.groupDiscountPercent,
      discountPence: fullPricing.groupDiscountPence,
    },
    codeValue,
  );

  const applied: AppliedDiscountRecord = {
    kind: decision.kind,
    percent: fullPricing.groupDiscountPercent,
    discountPence: decision.kind === "none" ? 0 : decision.discountPence,
    code: decision.kind === "code" ? decision.code : null,
    promotionCodeId: decision.kind === "code" ? decision.promotionCodeId : null,
  };

  // Final pricing snapshot: per-ticket discount shares only when the
  // GROUP discount is the one applied (a code's exact value is
  // reconciled from Stripe's totals in the webhook, like singles).
  const pricing = computeGroupPricing(
    intent.tickets.map((t) => ({
      ticketType: t.ticketType,
      lunchIncluded: t.lunchIncluded,
    })),
    pricingNow,
    decision.kind === "group",
  );

  // Store the full intent server-side; the session carries only the id.
  const payload: GroupIntentPayload = {
    version: 1,
    intent,
    pricing,
    applied,
    termsAcceptedAt: realNow.toISOString(),
    termsAcceptedIp,
    marketingOptIn: intent.marketingOptIn,
  };
  const { data: intentRow, error: intentErr } = await serviceClient
    .from("pending_group_intents")
    .insert({ payload })
    .select("id")
    .single();
  if (intentErr || !intentRow) {
    throw new Error(`pending_group_intents insert failed: ${intentErr?.message}`);
  }
  const intentId = (intentRow as { id: string }).id;

  const lead = groupLead(intent);
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  if (regularCount > 0) {
    lineItems.push({
      quantity: regularCount,
      price_data: {
        currency: "gbp",
        unit_amount: regularUnit,
        tax_behavior: "exclusive",
        product: STRIPE_PRODUCT_IDS.delegate,
      },
    });
  }
  if (vipCount > 0) {
    lineItems.push({
      quantity: vipCount,
      price_data: {
        currency: "gbp",
        unit_amount: vipUnit,
        tax_behavior: "exclusive",
        product: STRIPE_PRODUCT_IDS.vip,
      },
    });
  }
  if (lunchCount > 0) {
    lineItems.push({
      quantity: lunchCount,
      price_data: {
        currency: "gbp",
        unit_amount: lunchUnit,
        tax_behavior: "exclusive",
        product: STRIPE_PRODUCT_IDS.lunch,
      },
    });
  }

  // Exactly one discount rides on the session; allow_promotion_codes
  // is deliberately ABSENT (mutually exclusive with discounts, and the
  // no-stacking rule is ours to enforce).
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (decision.kind === "group") {
    const couponId = await ensureGroupCoupon(
      stripe,
      pricing.groupDiscountPercent as 10 | 25,
    );
    discounts = [{ coupon: couponId }];
  } else if (decision.kind === "code") {
    discounts = [{ promotion_code: decision.promotionCodeId }];
  }

  const metadata: Record<string, string> = {
    booking_type: "group_delegate",
    group_intent_id: intentId,
    group_size: String(intent.tickets.length),
    applied_discount_kind: applied.kind,
    applied_discount_pence: String(applied.discountPence),
    group_discount_percent: String(applied.percent),
    lead_email: lead.email,
    terms_accepted_at: payload.termsAcceptedAt,
    terms_accepted_ip: termsAcceptedIp,
  };
  if (input.refSlug) metadata[REF_METADATA_KEY] = input.refSlug;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    currency: "gbp",
    line_items: lineItems,
    customer_email: lead.email,
    client_reference_id: intentId,
    metadata,
    payment_intent_data: {
      statement_descriptor_suffix: "IGNITE 27",
      metadata,
    },
    automatic_tax: { enabled: true },
    ...(discounts ? { discounts } : {}),
    success_url: `${siteUrl}/attend/book/group/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/attend/book/group?status=cancelled`,
    expires_at: Math.floor(realNow.getTime() / 1000) + 30 * 60,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id, applied };
}
