import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
  LUNCH_ADDON_PENCE,
  PRICING_TIMEZONE,
} from "./index";

const uk = (iso: string) => fromZonedTime(iso, PRICING_TIMEZONE);

describe("getCurrentPricing — per window snapshots", () => {
  it("window_1", () => {
    expect(getCurrentPricing(uk("2026-06-30T09:00:00"))).toEqual({
      window: "window_1",
      delegate: { regular: 3900, vip: 9900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: 20000,
      charityUplift: 0,
    });
  });

  it("window_2", () => {
    expect(getCurrentPricing(uk("2026-07-10T12:00:00"))).toEqual({
      window: "window_2",
      delegate: { regular: 4900, vip: 11900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: 25000,
      charityUplift: 0,
    });
  });

  it("window_3", () => {
    expect(getCurrentPricing(uk("2026-09-01T12:00:00"))).toEqual({
      window: "window_3",
      delegate: { regular: 5900, vip: 13900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: 32500,
      charityUplift: 0,
    });
  });

  it("christmas_drop reverts delegate and exhibitor prices to Window 2", () => {
    expect(getCurrentPricing(uk("2026-12-25T12:00:00"))).toEqual({
      window: "christmas_drop",
      delegate: { regular: 4900, vip: 11900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: 25000,
      charityUplift: 0,
    });
  });

  it("window_4", () => {
    expect(getCurrentPricing(uk("2027-01-15T12:00:00"))).toEqual({
      window: "window_4",
      delegate: { regular: 6900, vip: 15900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: 40000,
      charityUplift: 0,
    });
  });

  it("event_day: exhibitor is null, charity uplift is £5", () => {
    expect(getCurrentPricing(uk("2027-01-31T10:00:00"))).toEqual({
      window: "event_day",
      delegate: { regular: 6900, vip: 15900, lunchAddOn: LUNCH_ADDON_PENCE },
      exhibitor: null,
      charityUplift: 500,
    });
  });
});

describe("getCurrentPricing — guard-rail errors propagate from getActiveWindow", () => {
  it("throws before bookings open", () => {
    expect(() => getCurrentPricing(uk("2026-06-30T08:59:00"))).toThrow(BookingsNotOpenError);
  });

  it("throws after event day ends", () => {
    expect(() => getCurrentPricing(uk("2027-02-01T00:00:00"))).toThrow(BookingsClosedError);
  });
});
