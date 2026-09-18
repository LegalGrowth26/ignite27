import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  buildCompInput,
  buildCouponParams,
  buildPromotionCodeParams,
  codeStatusLabel,
  toAdminCodeRow,
  restrictionLabelFromProducts,
  validateCreateCodeInput,
  type AdminCodeRow,
  type CodeRestriction,
  type CreateCodeInput,
} from "./stripe-codes";

const base: CreateCodeInput = {
  code: "STEPHINE20",
  kind: "percent",
  percentOff: 20,
  expiresAt: null,
  maxRedemptions: null,
  note: null,
};

describe("validateCreateCodeInput", () => {
  it("accepts a well-formed percent code", () => {
    expect(validateCreateCodeInput(base)).toEqual([]);
  });

  it("rejects malformed codes (too short, lowercase, spaces)", () => {
    for (const code of ["AB", "bad code", "lower20", "x".repeat(31)]) {
      expect(validateCreateCodeInput({ ...base, code }).length).toBeGreaterThan(0);
    }
  });

  it("rejects percent outside 1-100", () => {
    expect(validateCreateCodeInput({ ...base, percentOff: 0 }).length).toBeGreaterThan(0);
    expect(validateCreateCodeInput({ ...base, percentOff: 101 }).length).toBeGreaterThan(0);
  });

  it("requires a positive amount for fixed codes", () => {
    expect(
      validateCreateCodeInput({ ...base, kind: "fixed", percentOff: undefined, amountOffPence: 0 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateCreateCodeInput({ ...base, kind: "fixed", percentOff: undefined, amountOffPence: 1000 }),
    ).toEqual([]);
  });

  it("rejects expiry in the past and zero max redemptions", () => {
    expect(
      validateCreateCodeInput({ ...base, expiresAt: new Date(Date.now() - 1000) }).length,
    ).toBeGreaterThan(0);
    expect(validateCreateCodeInput({ ...base, maxRedemptions: 0 }).length).toBeGreaterThan(0);
  });
});

describe("buildCouponParams", () => {
  it("builds a once-duration percent coupon", () => {
    expect(buildCouponParams(base)).toEqual({
      duration: "once",
      name: "STEPHINE20",
      percent_off: 20,
    });
  });

  it("builds a gbp fixed-amount coupon", () => {
    expect(
      buildCouponParams({ ...base, kind: "fixed", percentOff: undefined, amountOffPence: 1000 }),
    ).toEqual({ duration: "once", name: "STEPHINE20", amount_off: 1000, currency: "gbp" });
  });
});

describe("buildPromotionCodeParams", () => {
  it("carries code, expiry, max redemptions, and audit metadata", () => {
    const expires = new Date("2026-12-01T23:59:59Z");
    const params = buildPromotionCodeParams(
      "coupon_1",
      { ...base, expiresAt: expires, maxRedemptions: 50, note: "newsletter" },
      "actor-1",
    );
    expect(params.coupon).toBe("coupon_1");
    expect(params.code).toBe("STEPHINE20");
    expect(params.expires_at).toBe(Math.floor(expires.getTime() / 1000));
    expect(params.max_redemptions).toBe(50);
    expect(params.metadata).toMatchObject({ source: "ignite27-admin", created_by: "actor-1", note: "newsletter" });
  });

  it("omits expiry and max redemptions when unset", () => {
    const params = buildPromotionCodeParams("coupon_1", base, "actor-1");
    expect(params.expires_at).toBeUndefined();
    expect(params.max_redemptions).toBeUndefined();
  });
});

describe("buildCompInput", () => {
  it("is always 100% off, single use", () => {
    const input = buildCompInput("COMP-JANE-A1B2", "Jane Smith");
    expect(input.percentOff).toBe(100);
    expect(input.maxRedemptions).toBe(1);
    expect(input.note).toBe("Jane Smith");
    expect(validateCreateCodeInput(input)).toEqual([]);
  });
});

describe("toAdminCodeRow / codeStatusLabel", () => {
  const stripePc = {
    id: "promo_1",
    code: "COMP-JANE-A1B2",
    active: true,
    times_redeemed: 0,
    max_redemptions: 1,
    expires_at: null,
    metadata: { note: "Jane" },
    coupon: { percent_off: 100, amount_off: null },
  } as unknown as Stripe.PromotionCode;

  it("maps a Stripe promotion code and detects comps", () => {
    const row = toAdminCodeRow(stripePc);
    expect(row.isComp).toBe(true);
    expect(row.note).toBe("Jane");
    expect(codeStatusLabel(row, Date.now())).toBe("Active");
  });

  it("labels deactivated, expired, and fully-redeemed codes", () => {
    const now = Date.now();
    const rowBase = toAdminCodeRow(stripePc);
    expect(codeStatusLabel({ ...rowBase, active: false }, now)).toBe("Deactivated");
    expect(
      codeStatusLabel({ ...rowBase, expiresAt: Math.floor(now / 1000) - 60 } as AdminCodeRow, now),
    ).toBe("Expired");
    expect(codeStatusLabel({ ...rowBase, timesRedeemed: 1 }, now)).toBe("Fully redeemed");
  });
});

// -----------------------------------------------------------------------------
// Ticket-type restrictions (coupon applies_to against the fixed products).
// -----------------------------------------------------------------------------
describe("code restrictions", () => {
  it("maps every restriction option to the right applies_to products", () => {
    const cases: Array<[CodeRestriction, string[] | undefined]> = [
      ["everything", undefined],
      ["delegates_only", ["ignite27_delegate"]],
      ["vip_only", ["ignite27_vip"]],
      ["exhibitors_only", ["ignite27_exhibitor"]],
      [
        "everything_except_lunch",
        ["ignite27_delegate", "ignite27_vip", "ignite27_exhibitor"],
      ],
    ];
    for (const [appliesTo, expected] of cases) {
      const params = buildCouponParams({ ...base, appliesTo });
      if (expected === undefined) {
        expect(params.applies_to).toBeUndefined();
      } else {
        expect(params.applies_to).toEqual({ products: expected });
      }
    }
  });

  it("legacy input with NO appliesTo builds exactly the pre-restriction coupon shape", () => {
    // Existing unrestricted codes and any older callers must keep
    // working unchanged: no applies_to key at all.
    const params = buildCouponParams(base);
    expect("applies_to" in params).toBe(false);
    expect(params).toEqual({ duration: "once", name: "STEPHINE20", percent_off: 20 });
  });

  it("rejects an unknown appliesTo value", () => {
    const errors = validateCreateCodeInput({
      ...base,
      appliesTo: "platinum_only" as CodeRestriction,
    });
    expect(errors.some((e) => e.field === "appliesTo")).toBe(true);
  });

  it("comps stay unrestricted", () => {
    const comp = buildCompInput("COMP-JANE-AB12", "Jane");
    expect(comp.appliesTo).toBe("everything");
    expect("applies_to" in buildCouponParams(comp)).toBe(false);
  });

  it("restrictionLabelFromProducts round-trips every option and handles legacy/custom", () => {
    expect(restrictionLabelFromProducts(undefined)).toBe("Everything"); // legacy coupon, no applies_to
    expect(restrictionLabelFromProducts([])).toBe("Everything");
    expect(restrictionLabelFromProducts(["ignite27_delegate"])).toBe("Delegates only");
    expect(restrictionLabelFromProducts(["ignite27_vip"])).toBe("VIP only");
    expect(restrictionLabelFromProducts(["ignite27_exhibitor"])).toBe("Exhibitors only");
    // Order must not matter.
    expect(
      restrictionLabelFromProducts(["ignite27_vip", "ignite27_exhibitor", "ignite27_delegate"]),
    ).toBe("Everything except lunch");
    // Hand-edited sets in the Stripe dashboard render honestly.
    expect(restrictionLabelFromProducts(["prod_manually_made"])).toBe("Custom");
  });

  it("toAdminCodeRow surfaces the restriction label, Everything for legacy coupons", () => {
    const restricted = toAdminCodeRow({
      id: "promo_2",
      code: "VIPONLY10",
      active: true,
      coupon: {
        percent_off: 10,
        amount_off: null,
        applies_to: { products: ["ignite27_vip"] },
      },
      times_redeemed: 0,
      max_redemptions: null,
      expires_at: null,
      metadata: {},
    } as unknown as Stripe.PromotionCode);
    expect(restricted.restrictionLabel).toBe("VIP only");

    const legacy = toAdminCodeRow({
      id: "promo_1",
      code: "TOMS20",
      active: true,
      coupon: { percent_off: 20, amount_off: null },
      times_redeemed: 3,
      max_redemptions: null,
      expires_at: null,
      metadata: {},
    } as unknown as Stripe.PromotionCode);
    expect(legacy.restrictionLabel).toBe("Everything");
  });
});
