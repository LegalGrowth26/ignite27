import type Stripe from "stripe";
import { STRIPE_PRODUCT_IDS } from "@/lib/stripe/products";

// Ticket-type restrictions for discount codes, mapped to the coupon's
// applies_to product list (the fixed Products in lib/stripe/products).
// "everything" omits applies_to entirely, which is also how every code
// created before restrictions existed behaves: legacy coupons carry no
// applies_to and keep applying to the whole order, unchanged.
export const CODE_RESTRICTIONS = {
  everything: { label: "Everything", products: null },
  delegates_only: {
    label: "Delegates only",
    products: [STRIPE_PRODUCT_IDS.delegate],
  },
  vip_only: { label: "VIP only", products: [STRIPE_PRODUCT_IDS.vip] },
  exhibitors_only: {
    label: "Exhibitors only",
    products: [STRIPE_PRODUCT_IDS.exhibitor],
  },
  everything_except_lunch: {
    label: "Everything except lunch",
    products: [
      STRIPE_PRODUCT_IDS.delegate,
      STRIPE_PRODUCT_IDS.vip,
      STRIPE_PRODUCT_IDS.exhibitor,
    ],
  },
} as const;

export type CodeRestriction = keyof typeof CODE_RESTRICTIONS;

export const CODE_RESTRICTION_KEYS = Object.keys(
  CODE_RESTRICTIONS,
) as readonly CodeRestriction[];

// Reverse mapping for the admin list: a coupon's applies_to product set
// back to a restriction label. Unknown sets (edited by hand in Stripe)
// render honestly as "Custom" rather than being shoehorned.
export function restrictionLabelFromProducts(
  productIds: readonly string[] | null | undefined,
): string {
  if (!productIds || productIds.length === 0) {
    return CODE_RESTRICTIONS.everything.label;
  }
  const sorted = [...productIds].sort().join(",");
  for (const key of CODE_RESTRICTION_KEYS) {
    const products = CODE_RESTRICTIONS[key].products;
    if (products && [...products].sort().join(",") === sorted) {
      return CODE_RESTRICTIONS[key].label;
    }
  }
  return "Custom";
}

// Discount-code management via the Stripe API, server-side only. The
// co-organiser must never need access to the (multi-business) Stripe
// dashboard, so create / list / deactivate all live in our admin UI.
//
// Pure param-builders are separated from the API calls so the shaping
// logic is unit-testable without Stripe.

export interface CreateCodeInput {
  code: string;
  kind: "percent" | "fixed";
  percentOff?: number;      // 1-100 when kind === "percent"
  amountOffPence?: number;  // > 0 when kind === "fixed" (ex-VAT pence, gbp)
  expiresAt?: Date | null;
  maxRedemptions?: number | null;
  note?: string | null;
  // Optional so pre-restriction callers keep working; absent means
  // "everything" (no applies_to on the coupon).
  appliesTo?: CodeRestriction;
}

export interface CodeValidationError {
  field: string;
  message: string;
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

export function validateCreateCodeInput(input: CreateCodeInput): CodeValidationError[] {
  const errors: CodeValidationError[] = [];
  if (!CODE_PATTERN.test(input.code)) {
    errors.push({
      field: "code",
      message: "Code must be 3-30 characters, A-Z, 0-9, or hyphens (e.g. STEPHINE20).",
    });
  }
  if (input.kind === "percent") {
    if (!input.percentOff || input.percentOff < 1 || input.percentOff > 100) {
      errors.push({ field: "percentOff", message: "Percent off must be between 1 and 100." });
    }
  } else {
    if (!input.amountOffPence || input.amountOffPence <= 0) {
      errors.push({ field: "amountOff", message: "Amount off must be more than £0." });
    }
  }
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    errors.push({ field: "expiresAt", message: "Expiry must be in the future." });
  }
  if (
    input.maxRedemptions !== null &&
    input.maxRedemptions !== undefined &&
    (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)
  ) {
    errors.push({ field: "maxRedemptions", message: "Max redemptions must be a whole number of at least 1." });
  }
  if (
    input.appliesTo !== undefined &&
    !CODE_RESTRICTION_KEYS.includes(input.appliesTo)
  ) {
    errors.push({ field: "appliesTo", message: "Pick who the code applies to." });
  }
  return errors;
}

export function buildCouponParams(input: CreateCodeInput): Stripe.CouponCreateParams {
  const base: Stripe.CouponCreateParams = {
    duration: "once",
    name: input.code,
  };
  // Restriction rides on the coupon's applies_to product list.
  // "everything" (or absent, for legacy callers) omits applies_to so
  // the coupon behaves exactly like every pre-restriction code.
  const restriction = CODE_RESTRICTIONS[input.appliesTo ?? "everything"];
  if (restriction.products) {
    base.applies_to = { products: [...restriction.products] };
  }
  if (input.kind === "percent") {
    return { ...base, percent_off: input.percentOff };
  }
  return { ...base, amount_off: input.amountOffPence, currency: "gbp" };
}

export function buildPromotionCodeParams(
  couponId: string,
  input: CreateCodeInput,
  createdByEmailHash: string,
): Stripe.PromotionCodeCreateParams {
  const params: Stripe.PromotionCodeCreateParams = {
    coupon: couponId,
    code: input.code,
    metadata: {
      source: "ignite27-admin",
      created_by: createdByEmailHash,
      note: input.note ?? "",
    },
  };
  if (input.expiresAt) {
    params.expires_at = Math.floor(input.expiresAt.getTime() / 1000);
  }
  if (input.maxRedemptions) {
    params.max_redemptions = input.maxRedemptions;
  }
  return params;
}

// One-click comp: 100% off, single use, optional note of who it's for.
// Comps stay unrestricted: they should cover whatever the guest books.
export function buildCompInput(code: string, note: string | null): CreateCodeInput {
  return {
    code,
    kind: "percent",
    percentOff: 100,
    maxRedemptions: 1,
    expiresAt: null,
    note,
    appliesTo: "everything",
  };
}

export interface AdminCodeRow {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOffPence: number | null;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: number | null; // unix seconds
  note: string;
  isComp: boolean;
  restrictionLabel: string; // "Everything" / "Delegates only" / ... / "Custom"
}

export function toAdminCodeRow(pc: Stripe.PromotionCode): AdminCodeRow {
  const coupon = pc.coupon as Stripe.Coupon;
  const percentOff = coupon.percent_off ?? null;
  return {
    id: pc.id,
    code: pc.code,
    active: pc.active,
    percentOff,
    amountOffPence: coupon.amount_off ?? null,
    timesRedeemed: pc.times_redeemed,
    maxRedemptions: pc.max_redemptions ?? null,
    expiresAt: pc.expires_at ?? null,
    note: (pc.metadata?.note as string | undefined) ?? "",
    isComp: percentOff === 100 && (pc.max_redemptions ?? 0) === 1,
    // Legacy coupons carry no applies_to and read as "Everything".
    restrictionLabel: restrictionLabelFromProducts(coupon.applies_to?.products),
  };
}

export function codeStatusLabel(row: AdminCodeRow, nowMs: number): string {
  if (!row.active) return "Deactivated";
  if (row.expiresAt !== null && row.expiresAt * 1000 <= nowMs) return "Expired";
  if (row.maxRedemptions !== null && row.timesRedeemed >= row.maxRedemptions) return "Fully redeemed";
  return "Active";
}
