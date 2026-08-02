import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getActivePeriod,
} from "./engine";
import {
  BOOKINGS_CLOSE_AT,
  BOOKINGS_OPEN_AT,
  PRICING_TIMEZONE,
} from "./periods";

const uk = (iso: string) => fromZonedTime(iso, PRICING_TIMEZONE);

describe("getActivePeriod — pre-open guard", () => {
  it("throws BookingsNotOpenError days before launch", () => {
    expect(() => getActivePeriod(uk("2026-06-29T00:00:00"))).toThrow(
      BookingsNotOpenError,
    );
  });

  it("throws BookingsNotOpenError one second before launch opens", () => {
    const before = new Date(BOOKINGS_OPEN_AT.getTime() - 1000);
    expect(() => getActivePeriod(before)).toThrow(BookingsNotOpenError);
  });

  it("opens exactly at the launch instant (inclusive lower bound)", () => {
    expect(getActivePeriod(BOOKINGS_OPEN_AT)).toBe("launch");
  });
});

describe("getActivePeriod — launch period", () => {
  it("returns launch just after open (1 Aug 2026 09:00 UK)", () => {
    expect(getActivePeriod(uk("2026-08-01T09:00:01"))).toBe("launch");
  });

  it("returns launch inside the window (2 Aug 2026 10:00 UK)", () => {
    expect(getActivePeriod(uk("2026-08-02T10:00:00"))).toBe("launch");
  });

  it("returns launch late in the extended week (6 Aug 2026 12:00 UK)", () => {
    // The original 72-hour window ended 4 Aug 09:00; the extension
    // (organiser decision, July 2026) runs launch through 8 Aug.
    expect(getActivePeriod(uk("2026-08-06T12:00:00"))).toBe("launch");
  });

  it("returns launch one second before it closes (8 Aug 2026 23:59:59 UK)", () => {
    expect(getActivePeriod(uk("2026-08-08T23:59:59"))).toBe("launch");
  });
});

describe("getActivePeriod — standard period", () => {
  it("returns standard exactly at the launch → standard transition", () => {
    // Half-open [opens, closes): 9 Aug 00:00 belongs to standard, not launch.
    expect(getActivePeriod(uk("2026-08-09T00:00:00"))).toBe("standard");
  });

  it("returns standard in early autumn", () => {
    expect(getActivePeriod(uk("2026-09-15T12:00:00"))).toBe("standard");
  });

  it("BST/GMT spot-check: last day of BST (Sun 25 Oct 2026) is still standard", () => {
    // 25 Oct 2026 was the day the UK clocks went back. The engine must
    // still map a UK-local 12:00 that day to standard regardless of DST.
    expect(getActivePeriod(uk("2026-10-25T12:00:00"))).toBe("standard");
  });

  it("returns standard on Christmas Day 2026", () => {
    expect(getActivePeriod(uk("2026-12-25T12:00:00"))).toBe("standard");
  });

  it("returns standard one second before New Year 2027", () => {
    expect(getActivePeriod(uk("2026-12-31T23:59:59"))).toBe("standard");
  });
});

describe("getActivePeriod — late period", () => {
  it("returns late exactly at the standard → late transition", () => {
    // Half-open: 1 Jan 2027 00:00 belongs to late.
    expect(getActivePeriod(uk("2027-01-01T00:00:00"))).toBe("late");
  });

  it("returns late in early January", () => {
    expect(getActivePeriod(uk("2027-01-10T12:00:00"))).toBe("late");
  });

  it("returns late one second before bookings close (18 Jan 2027 16:59:59 UK)", () => {
    expect(getActivePeriod(uk("2027-01-18T16:59:59"))).toBe("late");
  });
});

describe("getActivePeriod — post-close guard", () => {
  it("throws BookingsClosedError exactly at the close instant", () => {
    // Half-open close: 18 Jan 17:00 already counts as closed.
    expect(() => getActivePeriod(BOOKINGS_CLOSE_AT)).toThrow(
      BookingsClosedError,
    );
  });

  it("throws BookingsClosedError one minute after close (18 Jan 17:01 UK)", () => {
    expect(() => getActivePeriod(uk("2027-01-18T17:01:00"))).toThrow(
      BookingsClosedError,
    );
  });

  it("throws BookingsClosedError on event day (21 Jan 2027) — no event-day sales in v2", () => {
    expect(() => getActivePeriod(uk("2027-01-21T09:00:00"))).toThrow(
      BookingsClosedError,
    );
  });

  it("throws BookingsClosedError long after the event", () => {
    expect(() => getActivePeriod(uk("2027-06-01T00:00:00"))).toThrow(
      BookingsClosedError,
    );
  });
});
