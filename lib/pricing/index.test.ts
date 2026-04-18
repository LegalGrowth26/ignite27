import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  ExhibitorBookingsClosedOnEventDayError,
  getActiveWindow,
  getCurrentPricing,
  getExhibitorPrice,
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
    expect(getCurrentPricing(uk("2027-01-21T10:00:00"))).toEqual({
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
    expect(() => getCurrentPricing(uk("2027-01-22T00:00:00"))).toThrow(BookingsClosedError);
  });
});

describe("acceptance scenarios — user-specified instants", () => {
  it("case 1: 24 Dec 2026 23:59 UK is window_3 with regular = £59", () => {
    const p = getCurrentPricing(uk("2026-12-24T23:59:00"));
    expect(p.window).toBe("window_3");
    expect(p.delegate.regular).toBe(5900);
  });

  it("case 2: 25 Dec 2026 00:00 UK is christmas_drop with regular = £49 and exhibitor = £250", () => {
    const p = getCurrentPricing(uk("2026-12-25T00:00:00"));
    expect(p.window).toBe("christmas_drop");
    expect(p.delegate.regular).toBe(4900);
    expect(p.exhibitor).toBe(25000);
  });

  it("case 3: 25 Dec 2026 23:59 UK is still christmas_drop", () => {
    const p = getCurrentPricing(uk("2026-12-25T23:59:00"));
    expect(p.window).toBe("christmas_drop");
  });

  it("case 4: 26 Dec 2026 00:00 UK is window_3 again with regular = £59", () => {
    const p = getCurrentPricing(uk("2026-12-26T00:00:00"));
    expect(p.window).toBe("window_3");
    expect(p.delegate.regular).toBe(5900);
  });

  it("case 5: 21 Jan 2027 12:00 UK is event_day, regular + uplift = £74, exhibitor throws", () => {
    const instant = uk("2027-01-21T12:00:00");
    const p = getCurrentPricing(instant);
    expect(p.window).toBe("event_day");
    expect(p.delegate.regular).toBe(6900);
    expect(p.charityUplift).toBe(500);
    expect(p.delegate.regular + p.charityUplift).toBe(7400);
    expect(p.exhibitor).toBeNull();
    expect(() => getExhibitorPrice("event_day")).toThrow(
      ExhibitorBookingsClosedOnEventDayError,
    );
  });

  it("case 6: 22 Jan 2027 00:00 UK throws BookingsClosedError", () => {
    expect(() => getActiveWindow(uk("2027-01-22T00:00:00"))).toThrow(BookingsClosedError);
  });
});
