import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  PRICING_TIMEZONE,
  getCurrentPricing,
} from ".";

const uk = (iso: string) => fromZonedTime(iso, PRICING_TIMEZONE);

describe("getCurrentPricing — snapshot in launch period", () => {
  const p = getCurrentPricing(uk("2026-08-02T10:00:00"));

  it("labels the period 'launch'", () => {
    expect(p.period).toBe("launch");
  });

  it("delegate.regular is £25 + VAT", () => {
    expect(p.delegate.regular.exVatPence).toBe(2500);
    expect(p.delegate.regular.vatPence).toBe(500);
    expect(p.delegate.regular.incVatPence).toBe(3000);
  });

  it("delegate.vip is £69 + VAT", () => {
    expect(p.delegate.vip.exVatPence).toBe(6900);
    expect(p.delegate.vip.incVatPence).toBe(8280);
  });

  it("delegate.lunchAddOn is £15 inc-VAT flat", () => {
    expect(p.delegate.lunchAddOn.incVatPence).toBe(1500);
    expect(p.delegate.lunchAddOn.exVatPence).toBe(1250);
    expect(p.delegate.lunchAddOn.vatPence).toBe(250);
  });

  it("exhibitor is £189 + VAT", () => {
    expect(p.exhibitor.exVatPence).toBe(18900);
    expect(p.exhibitor.incVatPence).toBe(22680);
  });
});

describe("getCurrentPricing — snapshot in standard period", () => {
  const p = getCurrentPricing(uk("2026-10-01T12:00:00"));

  it("labels the period 'standard'", () => {
    expect(p.period).toBe("standard");
  });

  it("delegate.regular is £35 + VAT", () => {
    expect(p.delegate.regular.incVatPence).toBe(4200);
  });

  it("delegate.vip is £85 + VAT", () => {
    expect(p.delegate.vip.incVatPence).toBe(10200);
  });

  it("exhibitor is £249 + VAT", () => {
    expect(p.exhibitor.incVatPence).toBe(29880);
  });
});

describe("getCurrentPricing — snapshot in late period", () => {
  const p = getCurrentPricing(uk("2027-01-10T12:00:00"));

  it("labels the period 'late'", () => {
    expect(p.period).toBe("late");
  });

  it("delegate.regular is £45 + VAT", () => {
    expect(p.delegate.regular.incVatPence).toBe(5400);
  });

  it("delegate.vip is £99 + VAT", () => {
    expect(p.delegate.vip.incVatPence).toBe(11880);
  });

  it("exhibitor holds at £249 + VAT (no late uplift)", () => {
    expect(p.exhibitor.incVatPence).toBe(29880);
  });

  it("lunch add-on is still £15 inc-VAT flat", () => {
    expect(p.delegate.lunchAddOn.incVatPence).toBe(1500);
  });
});

describe("getCurrentPricing — outside the booking window", () => {
  it("throws BookingsNotOpenError before launch (29 Jun 2026)", () => {
    expect(() => getCurrentPricing(uk("2026-06-29T00:00:00"))).toThrow(
      BookingsNotOpenError,
    );
  });

  it("throws BookingsClosedError after 18 Jan 2027 17:00 UK", () => {
    expect(() => getCurrentPricing(uk("2027-01-18T17:00:00"))).toThrow(
      BookingsClosedError,
    );
  });

  it("throws BookingsClosedError on event day (21 Jan 2027)", () => {
    expect(() => getCurrentPricing(uk("2027-01-21T09:00:00"))).toThrow(
      BookingsClosedError,
    );
  });
});
