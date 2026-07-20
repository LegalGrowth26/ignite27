// Discount arithmetic sanity check.
//
// With tax_behavior "exclusive" and Stripe Tax enabled, Stripe applies
// a percent-off coupon to the ex-VAT base and recomputes 20% UK VAT on
// the discounted total. These tests document the exact expected values
// for a couple of representative codes so we notice if that assumption
// ever drifts (e.g. if Stripe changes tax rounding, or we mistakenly
// pass inc-VAT to unit_amount).
//
// These are unit tests on our own priceFromExVat, not on Stripe.

import { describe, expect, it } from "vitest";
import { getDelegatePrice, priceFromExVat } from "./prices";

function apply20PctOff(exVatPence: number): number {
  return Math.round(exVatPence * 0.8);
}

describe("VAT applies to the discounted ex-VAT total (exclusive tax_behavior)", () => {
  it("20% off a standard delegate: £35 -> £28 ex-VAT / £5.60 VAT / £33.60 total", () => {
    const base = getDelegatePrice("standard");
    expect(base.exVatPence).toBe(3500);

    const discountedEx = apply20PctOff(base.exVatPence);
    expect(discountedEx).toBe(2800);

    const discounted = priceFromExVat(discountedEx);
    expect(discounted.exVatPence).toBe(2800);
    expect(discounted.vatPence).toBe(560);
    expect(discounted.incVatPence).toBe(3360);
  });

  it("50% off a launch VIP: £69 -> £34.50 ex-VAT / £6.90 VAT / £41.40 total", () => {
    // Half-price test to catch any inc/ex mix-up. £69 -> £34.50 -> +20% VAT
    // = £41.40, not £41.40 something else.
    const discountedEx = Math.round(6900 * 0.5);
    expect(discountedEx).toBe(3450);
    const discounted = priceFromExVat(discountedEx);
    expect(discounted.exVatPence).toBe(3450);
    expect(discounted.vatPence).toBe(690);
    expect(discounted.incVatPence).toBe(4140);
  });

  it("100% off (comp): everything goes to zero", () => {
    const zero = priceFromExVat(0);
    expect(zero.exVatPence).toBe(0);
    expect(zero.vatPence).toBe(0);
    expect(zero.incVatPence).toBe(0);
  });
});
