import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCouponParams, buildPromotionCodeParams } from "@/lib/admin/stripe-codes";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeProducts } from "@/lib/stripe/products";

// Pure and unit-tested: a personal code string from a slug and the
// ambassador's own percentage (STEPHINE15, DANINCE20). Same shape the
// host codes have always used; hostDiscountCode delegates here.
export function percentCodeFromSlug(slug: string, percent: number): string {
  const base = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 18);
  return `${base || "CODE"}${percent}`;
}

// Shared personal-discount-code provisioning for provisioned
// ambassadors (workshop hosts, partner contacts): a percent-off code
// applying to ATTENDEE TICKETS ONLY (delegate + VIP; never stands,
// never lunch: a 20% code must not discount a £249 stand), no cap,
// no expiry. Idempotent
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
        appliesTo: "attendee_tickets",
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


// Manual-ambassador provisioning: ensure the Stripe code for an
// ambassadors row that has a percentage, and record it on the row.
// Used by the admin create form, the resend-invite heal, and the
// one-off backfill; a Stripe hiccup returns null and the next resend
// or backfill run retries.
export async function ensureAmbassadorPromoCode(
  service: SupabaseClient,
  ambassador: {
    id: string;
    slug: string;
    discount_percent: number | null;
    promo_code: string | null;
  },
): Promise<string | null> {
  if (!ambassador.discount_percent) return null;
  if (ambassador.promo_code) return ambassador.promo_code;

  const code = percentCodeFromSlug(ambassador.slug, ambassador.discount_percent);
  const ready = await ensurePercentCode(
    code,
    ambassador.discount_percent,
    `ambassador personal code (${ambassador.slug})`,
    "ambassador-admin",
  );
  if (!ready) return null;

  const { error } = await service
    .from("ambassadors")
    .update({ promo_code: code })
    .eq("id", ambassador.id);
  if (error) {
    console.error("[ensure-code] promo_code record failed:", error.message);
    return null;
  }
  return code;
}
