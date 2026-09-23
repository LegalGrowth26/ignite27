import type Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { isValidRefSlug } from "./attribution";

// Share-link discount auto-apply: someone who arrives through an
// ambassador's ?ref= link gets that ambassador's personal code applied
// at checkout automatically, no code to type. Attribution is untouched
// (the ref slug still rides the session metadata); this only decides
// the session's discount parameters.

export interface AutoDiscountSource {
  promo_code: string | null;
  discount_percent: number | null;
  deactivated_at: string | null;
}

// Pure decision, tested per branch: only an ACTIVE ambassador with a
// personal code auto-applies. Everyone else books the plain way.
export function autoApplyCode(
  ambassador: AutoDiscountSource | null | undefined,
): string | null {
  if (!ambassador) return null;
  if (ambassador.deactivated_at) return null;
  if (!ambassador.promo_code) return null;
  if (!ambassador.discount_percent || ambassador.discount_percent <= 0) return null;
  return ambassador.promo_code;
}

// discounts and allow_promotion_codes are mutually exclusive on a
// Checkout Session (the group checkout already works within the same
// constraint). Auto-applied sessions therefore lose the type-a-code
// field; plain sessions keep it.
export type SessionDiscountParams =
  | { discounts: Array<{ promotion_code: string }> }
  | { allow_promotion_codes: true };

export function sessionDiscountParams(
  promotionCodeId: string | null,
): SessionDiscountParams {
  return promotionCodeId
    ? { discounts: [{ promotion_code: promotionCodeId }] }
    : { allow_promotion_codes: true };
}

// Slug -> active ambassador -> live Stripe promotion code id. Never
// throws: any failure (unknown slug, deactivated, code missing or
// switched off in Stripe, network) degrades to a plain checkout with
// the typed-code field, which is always safe. The service client is
// only created once a valid slug is in hand, so the common no-ref
// booking never touches the database here.
export async function resolveAutoApplyPromotionCodeId(
  stripe: Stripe,
  rawSlug: string | null | undefined,
): Promise<string | null> {
  try {
    if (!isValidRefSlug(rawSlug)) return null;
    const { data, error } = await createSupabaseServiceClient()
      .from("ambassadors")
      .select("promo_code, discount_percent, deactivated_at")
      .eq("slug", rawSlug)
      .maybeSingle();
    if (error || !data) return null;
    const code = autoApplyCode(data as AutoDiscountSource);
    if (!code) return null;
    const { data: codes } = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    return codes[0]?.id ?? null;
  } catch (err) {
    console.error(
      "[ambassador] auto-discount resolve failed (falling back to plain checkout):",
      err,
    );
    return null;
  }
}
