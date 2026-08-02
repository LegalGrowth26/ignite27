import { describe, expect, it } from "vitest";
import { aggregatePromoUsage, type PromoBookingRow } from "./discounts";

function row(overrides: Partial<PromoBookingRow>): PromoBookingRow {
  return {
    promo_code: "STEPHINE20",
    discount_pence: 700,
    gross_amount_pence: 3360,
    payment_status: "paid",
    ...overrides,
  };
}

describe("aggregatePromoUsage", () => {
  it("groups by code with uses, discount, and revenue", () => {
    const usage = aggregatePromoUsage([row({}), row({}), row({ promo_code: "OTHER10", discount_pence: 420 })]);
    expect(usage).toHaveLength(2);
    const steph = usage.find((u) => u.code === "STEPHINE20");
    expect(steph?.uses).toBe(2);
    expect(steph?.totalDiscountPence).toBe(1400);
    expect(steph?.totalRevenuePence).toBe(6720);
  });

  it("counts comps separately and includes them in uses", () => {
    const usage = aggregatePromoUsage([
      row({ promo_code: "COMP-JS", payment_status: "comp", gross_amount_pence: 0, discount_pence: 3500 }),
    ]);
    expect(usage[0]?.uses).toBe(1);
    expect(usage[0]?.compCount).toBe(1);
    expect(usage[0]?.totalRevenuePence).toBe(0);
  });

  it("ignores rows without a code and non-completed statuses", () => {
    const usage = aggregatePromoUsage([
      row({ promo_code: null }),
      row({ payment_status: "pending" }),
      row({ payment_status: "refunded" }),
    ]);
    expect(usage).toHaveLength(0);
  });

  it("sorts by most-used first", () => {
    const usage = aggregatePromoUsage([
      row({ promo_code: "A" }),
      row({ promo_code: "B" }),
      row({ promo_code: "B" }),
    ]);
    expect(usage[0]?.code).toBe("B");
  });
});
