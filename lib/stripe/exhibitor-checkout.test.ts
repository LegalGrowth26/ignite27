import { describe, expect, it } from "vitest";
import { BookingsClosedError, BookingsNotOpenError } from "@/lib/pricing";
import {
  buildExhibitorLineItems,
  computeExhibitorPricing,
} from "./exhibitor-checkout";

// Instants safely inside each pricing window (UK local).
const LAUNCH = new Date("2026-08-05T12:00:00+01:00");
const STANDARD = new Date("2026-10-01T12:00:00+01:00");
const LATE = new Date("2027-01-10T12:00:00Z");
const PRE_OPEN = new Date("2026-07-01T12:00:00+01:00");
const CLOSED = new Date("2027-01-20T12:00:00Z");

describe("computeExhibitorPricing", () => {
  it("launch: £189 + VAT (£226.80)", () => {
    const p = computeExhibitorPricing(LAUNCH);
    expect(p.period).toBe("launch");
    expect(p.standExVatPence).toBe(18900);
    expect(p.standVatPence).toBe(3780);
    expect(p.standIncVatPence).toBe(22680);
    expect(p.grossIncVatPence).toBe(22680);
  });

  it("standard: £249 + VAT (£298.80)", () => {
    const p = computeExhibitorPricing(STANDARD);
    expect(p.period).toBe("standard");
    expect(p.standExVatPence).toBe(24900);
    expect(p.standVatPence).toBe(4980);
    expect(p.standIncVatPence).toBe(29880);
  });

  it("late period: exhibitors keep the standard £249, no late uplift", () => {
    const p = computeExhibitorPricing(LATE);
    expect(p.period).toBe("late");
    expect(p.standExVatPence).toBe(24900);
  });

  it("gross always equals the stand while it is the only line item", () => {
    for (const now of [LAUNCH, STANDARD, LATE]) {
      const p = computeExhibitorPricing(now);
      expect(p.grossExVatPence).toBe(p.standExVatPence);
      expect(p.grossVatPence).toBe(p.standVatPence);
      expect(p.grossIncVatPence).toBe(p.standIncVatPence);
    }
  });

  it("throws the pricing-engine errors outside the booking window", () => {
    expect(() => computeExhibitorPricing(PRE_OPEN)).toThrow(BookingsNotOpenError);
    expect(() => computeExhibitorPricing(CLOSED)).toThrow(BookingsClosedError);
  });
});

describe("buildExhibitorLineItems", () => {
  it("one ex-VAT line item with exclusive tax behaviour", () => {
    const items = buildExhibitorLineItems(computeExhibitorPricing(LAUNCH));
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.quantity).toBe(1);
    expect(item.price_data?.currency).toBe("gbp");
    // Ex-VAT amount goes to Stripe; Stripe Tax adds the 20% on top.
    expect(item.price_data?.unit_amount).toBe(18900);
    expect(item.price_data?.tax_behavior).toBe("exclusive");
    expect(item.price_data?.product_data?.name).toBe("IGNITE! 27 exhibitor stand");
  });
});
