import type Stripe from "stripe";

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
  return errors;
}

export function buildCouponParams(input: CreateCodeInput): Stripe.CouponCreateParams {
  const base: Stripe.CouponCreateParams = {
    duration: "once",
    name: input.code,
  };
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
export function buildCompInput(code: string, note: string | null): CreateCodeInput {
  return {
    code,
    kind: "percent",
    percentOff: 100,
    maxRedemptions: 1,
    expiresAt: null,
    note,
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
  };
}

export function codeStatusLabel(row: AdminCodeRow, nowMs: number): string {
  if (!row.active) return "Deactivated";
  if (row.expiresAt !== null && row.expiresAt * 1000 <= nowMs) return "Expired";
  if (row.maxRedemptions !== null && row.timesRedeemed >= row.maxRedemptions) return "Fully redeemed";
  return "Active";
}
