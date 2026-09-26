import { buildCouponParams, buildPromotionCodeParams } from "@/lib/admin/stripe-codes";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeProducts } from "@/lib/stripe/products";

// Shared personal-discount-code provisioning for provisioned
// ambassadors (workshop hosts, partner contacts): a percent-off code
// applying to everything except lunch, no cap, no expiry. Idempotent
// by code string: an existing Stripe promotion code is reused, never
// duplicated. Returns false instead of throwing so callers treat a
// Stripe hiccup as a partial-perks state, not a failed invite.
export async function ensurePercentCode(
  code: string,
  percentOff: number,
  note: string,
  source: string,
): Promise<boolean> {
  const stripe = getStripe();
  try {
    const { data } = await stripe.promotionCodes.list({ code, limit: 1 });
    if (data[0]) return true;
    await ensureStripeProducts(stripe);
    const coupon = await stripe.coupons.create(
      buildCouponParams({
        code,
        kind: "percent",
        percentOff,
        appliesTo: "everything_except_lunch",
        note,
      }),
    );
    await stripe.promotionCodes.create(
      buildPromotionCodeParams(coupon.id, { code, kind: "percent", percentOff }, source),
    );
    return true;
  } catch (err) {
    console.error(`[ensure-code] provisioning failed for ${code}:`, err);
    return false;
  }
}
