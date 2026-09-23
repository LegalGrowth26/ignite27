import { describe, expect, it } from "vitest";
import { autoApplyCode, sessionDiscountParams } from "./auto-discount";

describe("autoApplyCode", () => {
  const active = {
    promo_code: "DANINCE20",
    discount_percent: 20,
    deactivated_at: null,
  };

  it("applies for an active ambassador with a live code", () => {
    expect(autoApplyCode(active)).toBe("DANINCE20");
  });

  it("never applies for a deactivated ambassador", () => {
    expect(autoApplyCode({ ...active, deactivated_at: "2026-09-01" })).toBeNull();
  });

  it("never applies without a code or a percentage", () => {
    expect(autoApplyCode({ ...active, promo_code: null })).toBeNull();
    expect(autoApplyCode({ ...active, discount_percent: null })).toBeNull();
    expect(autoApplyCode({ ...active, discount_percent: 0 })).toBeNull();
    expect(autoApplyCode(null)).toBeNull();
  });
});

describe("sessionDiscountParams", () => {
  it("pre-applies the promotion code when resolved", () => {
    expect(sessionDiscountParams("promo_123")).toEqual({
      discounts: [{ promotion_code: "promo_123" }],
    });
  });

  it("falls back to the typed-code field otherwise", () => {
    // discounts and allow_promotion_codes are mutually exclusive in
    // Stripe; exactly one of the two must be present.
    expect(sessionDiscountParams(null)).toEqual({ allow_promotion_codes: true });
  });
});
