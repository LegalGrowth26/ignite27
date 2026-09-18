import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  computeCouponDiscountPence,
  computeGroupPricing,
  groupDiscountPercent,
  pickAppliedDiscount,
} from "./group";

// Standard period (2026-10-01): regular £35 ex VAT (3500), VIP £85 ex
// VAT (8500), lunch add-on £12.50 ex VAT (1250).
const NOW = new Date("2026-10-01T12:00:00Z");

const regular = { ticketType: "regular" as const, lunchIncluded: false };
const regularLunch = { ticketType: "regular" as const, lunchIncluded: true };
const vip = { ticketType: "vip" as const, lunchIncluded: false };

describe("groupDiscountPercent", () => {
  it("tiers: 2 -> 0%, 3-4 -> 10%, 5+ -> 25%", () => {
    expect(groupDiscountPercent(1)).toBe(0);
    expect(groupDiscountPercent(2)).toBe(0);
    expect(groupDiscountPercent(3)).toBe(10);
    expect(groupDiscountPercent(4)).toBe(10);
    expect(groupDiscountPercent(5)).toBe(25);
    expect(groupDiscountPercent(10)).toBe(25);
  });
});

describe("computeGroupPricing", () => {
  it("rejects groups outside 2-10", () => {
    expect(() => computeGroupPricing([regular], NOW)).toThrow();
    expect(() => computeGroupPricing(Array(11).fill(regular), NOW)).toThrow();
  });

  it("2 tickets: no group discount", () => {
    const p = computeGroupPricing([regular, regular], NOW);
    expect(p.groupDiscountPercent).toBe(0);
    expect(p.groupDiscountPence).toBe(0);
    expect(p.ticketsExVatPence).toBe(7000);
  });

  it("3 regular tickets: 10% off tickets, allocated equally", () => {
    const p = computeGroupPricing([regular, regular, regular], NOW);
    expect(p.groupDiscountPence).toBe(1050); // 10% of 10500
    expect(p.tickets.map((t) => t.discountExVatPence)).toEqual([350, 350, 350]);
    expect(p.tickets[0]!.netTicketExVatPence).toBe(3150);
    // £31.50 ex VAT -> £37.80 inc.
    expect(p.tickets[0]!.totalIncVatPence).toBe(3780);
  });

  it("5 tickets: 25%, and VIPs both count toward size and carry discount", () => {
    const p = computeGroupPricing([regular, regular, regular, regular, vip], NOW);
    // Tickets ex VAT: 4*3500 + 8500 = 22500; 25% = 5625.
    expect(p.groupDiscountPercent).toBe(25);
    expect(p.groupDiscountPence).toBe(5625);
    const total = p.tickets.reduce((s, t) => s + t.discountExVatPence, 0);
    expect(total).toBe(5625);
    // The VIP's share is proportional to its higher price.
    expect(p.tickets[4]!.discountExVatPence).toBeGreaterThan(
      p.tickets[0]!.discountExVatPence,
    );
  });

  it("lunch is never discounted and never counts toward the discount base", () => {
    const p = computeGroupPricing([regularLunch, regularLunch, regularLunch], NOW);
    expect(p.ticketsExVatPence).toBe(10500);
    expect(p.lunchesExVatPence).toBe(3750);
    expect(p.groupDiscountPence).toBe(1050); // 10% of tickets only
    for (const t of p.tickets) {
      expect(t.lunchExVatPence).toBe(1250);
      // Net ticket 3150 + lunch 1250 = 4400 ex -> 5280 inc.
      expect(t.totalIncVatPence).toBe(5280);
    }
  });

  it("applyGroupDiscount=false keeps full prices but still reports the tier", () => {
    const p = computeGroupPricing([regular, regular, regular], NOW, false);
    expect(p.groupDiscountPence).toBe(1050);
    expect(p.tickets.every((t) => t.discountExVatPence === 0)).toBe(true);
    expect(p.tickets[0]!.netTicketExVatPence).toBe(3500);
  });
});

describe("allocateProportionally", () => {
  it("sums exactly to the total when division is uneven", () => {
    const parts = allocateProportionally(100, [3500, 3500, 3500]);
    expect(parts.reduce((s, x) => s + x, 0)).toBe(100);
    // 33.33... each: two 33s and one 34, earliest index gets the spare.
    expect([...parts].sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it("zero total or zero weights allocate nothing", () => {
    expect(allocateProportionally(0, [1, 2])).toEqual([0, 0]);
    expect(allocateProportionally(100, [0, 0])).toEqual([0, 0]);
  });
});

describe("computeCouponDiscountPence", () => {
  const lines = [
    { productId: "ignite27_delegate", exVatPence: 10500 },
    { productId: "ignite27_lunch", exVatPence: 3750 },
  ];

  it("percent-off coupons apply to eligible lines only", () => {
    expect(
      computeCouponDiscountPence(
        { percentOff: 20, amountOffPence: null, appliesToProducts: ["ignite27_delegate"] },
        lines,
      ),
    ).toBe(2100);
  });

  it("unrestricted coupons apply to everything (lunch included, Stripe-side)", () => {
    expect(
      computeCouponDiscountPence(
        { percentOff: 10, amountOffPence: null, appliesToProducts: null },
        lines,
      ),
    ).toBe(1425);
  });

  it("amount-off coupons cap at the eligible subtotal", () => {
    expect(
      computeCouponDiscountPence(
        { percentOff: null, amountOffPence: 2000, appliesToProducts: ["ignite27_delegate"] },
        lines,
      ),
    ).toBe(2000);
    expect(
      computeCouponDiscountPence(
        { percentOff: null, amountOffPence: 99999, appliesToProducts: ["ignite27_delegate"] },
        lines,
      ),
    ).toBe(10500);
  });

  it("a coupon restricted to products not on the session is worth 0", () => {
    expect(
      computeCouponDiscountPence(
        { percentOff: 50, amountOffPence: null, appliesToProducts: ["ignite27_exhibitor"] },
        lines,
      ),
    ).toBe(0);
  });
});

describe("pickAppliedDiscount", () => {
  const code = { code: "SAVE20", promotionCodeId: "promo_1", discountPence: 2000 };

  it("larger discount wins", () => {
    expect(pickAppliedDiscount({ percent: 10, discountPence: 1050 }, code).kind).toBe("code");
    expect(
      pickAppliedDiscount({ percent: 25, discountPence: 5625 }, code).kind,
    ).toBe("group");
  });

  it("a dead tie goes to the code the customer typed", () => {
    expect(
      pickAppliedDiscount(
        { percent: 10, discountPence: 2000 },
        code,
      ).kind,
    ).toBe("code");
  });

  it("no code and no tier means none", () => {
    expect(pickAppliedDiscount({ percent: 0, discountPence: 0 }, null)).toEqual({
      kind: "none",
    });
  });
});
