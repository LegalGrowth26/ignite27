import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getActiveWindow,
} from "./engine";
import { PRICING_TIMEZONE } from "./windows";

// Helper: build a UTC Date from a UK-local wall-clock ISO string.
const uk = (iso: string) => fromZonedTime(iso, PRICING_TIMEZONE);

describe("getActiveWindow — bookings-open boundary", () => {
  it("throws before 30 Jun 2026 09:00 UK", () => {
    expect(() => getActiveWindow(uk("2026-06-30T08:59:00"))).toThrow(BookingsNotOpenError);
    expect(() => getActiveWindow(uk("2026-06-29T23:59:59"))).toThrow(BookingsNotOpenError);
    expect(() => getActiveWindow(uk("2020-01-01T00:00:00"))).toThrow(BookingsNotOpenError);
  });

  it("returns window_1 at exactly 30 Jun 2026 09:00 UK", () => {
    expect(getActiveWindow(uk("2026-06-30T09:00:00"))).toBe("window_1");
  });

  it("returns window_1 one minute after open", () => {
    expect(getActiveWindow(uk("2026-06-30T09:01:00"))).toBe("window_1");
  });
});

describe("getActiveWindow — window_1 -> window_2 boundary (2 Jul 2026 09:00 UK)", () => {
  it("minute before is window_1", () => {
    expect(getActiveWindow(uk("2026-07-02T08:59:00"))).toBe("window_1");
  });

  it("exact boundary is window_2", () => {
    expect(getActiveWindow(uk("2026-07-02T09:00:00"))).toBe("window_2");
  });

  it("minute after is window_2", () => {
    expect(getActiveWindow(uk("2026-07-02T09:01:00"))).toBe("window_2");
  });
});

describe("getActiveWindow — window_2 -> window_3 boundary (20 Jul 2026 00:00 UK)", () => {
  it("23:59 on 19 Jul is window_2", () => {
    expect(getActiveWindow(uk("2026-07-19T23:59:00"))).toBe("window_2");
  });

  it("00:00 on 20 Jul is window_3", () => {
    expect(getActiveWindow(uk("2026-07-20T00:00:00"))).toBe("window_3");
  });

  it("00:01 on 20 Jul is window_3", () => {
    expect(getActiveWindow(uk("2026-07-20T00:01:00"))).toBe("window_3");
  });
});

describe("getActiveWindow — window_3 -> window_4 boundary (1 Jan 2027 00:00 UK)", () => {
  it("23:59 on 31 Dec 2026 is window_3", () => {
    expect(getActiveWindow(uk("2026-12-31T23:59:00"))).toBe("window_3");
  });

  it("00:00 on 1 Jan 2027 is window_4", () => {
    expect(getActiveWindow(uk("2027-01-01T00:00:00"))).toBe("window_4");
  });

  it("00:01 on 1 Jan 2027 is window_4", () => {
    expect(getActiveWindow(uk("2027-01-01T00:01:00"))).toBe("window_4");
  });
});

describe("getActiveWindow — window_4 -> event_day boundary (21 Jan 2027 00:00 UK)", () => {
  it("23:59 on 20 Jan is window_4", () => {
    expect(getActiveWindow(uk("2027-01-20T23:59:00"))).toBe("window_4");
  });

  it("00:00 on 21 Jan is event_day", () => {
    expect(getActiveWindow(uk("2027-01-21T00:00:00"))).toBe("event_day");
  });

  it("09:30 on event day is event_day", () => {
    expect(getActiveWindow(uk("2027-01-21T09:30:00"))).toBe("event_day");
  });

  it("23:59 on 21 Jan is event_day", () => {
    expect(getActiveWindow(uk("2027-01-21T23:59:00"))).toBe("event_day");
  });
});

describe("getActiveWindow — bookings-closed boundary (22 Jan 2027 00:00 UK)", () => {
  it("00:00 on 22 Jan 2027 throws", () => {
    expect(() => getActiveWindow(uk("2027-01-22T00:00:00"))).toThrow(BookingsClosedError);
  });

  it("00:01 on 22 Jan 2027 throws", () => {
    expect(() => getActiveWindow(uk("2027-01-22T00:01:00"))).toThrow(BookingsClosedError);
  });

  it("far future throws", () => {
    expect(() => getActiveWindow(uk("2030-01-01T00:00:00"))).toThrow(BookingsClosedError);
  });
});

describe("getActiveWindow — Christmas drop overlay", () => {
  it("23:59 on 24 Dec 2026 is window_3 (drop has not started)", () => {
    expect(getActiveWindow(uk("2026-12-24T23:59:00"))).toBe("window_3");
  });

  it("00:00 on 25 Dec 2026 is christmas_drop", () => {
    expect(getActiveWindow(uk("2026-12-25T00:00:00"))).toBe("christmas_drop");
  });

  it("12:00 on 25 Dec 2026 is christmas_drop", () => {
    expect(getActiveWindow(uk("2026-12-25T12:00:00"))).toBe("christmas_drop");
  });

  it("23:59 on 25 Dec 2026 is christmas_drop", () => {
    expect(getActiveWindow(uk("2026-12-25T23:59:00"))).toBe("christmas_drop");
  });

  it("00:00 on 26 Dec 2026 falls back to window_3", () => {
    expect(getActiveWindow(uk("2026-12-26T00:00:00"))).toBe("window_3");
  });
});

describe("getActiveWindow — BST/GMT transition on 25 Oct 2026", () => {
  // 25 Oct 2026: at 02:00 BST clocks go back to 01:00 GMT.
  // All instants fall within Window 3. Use UTC literals so there is no
  // ambiguity around the repeated 01:00 UK-local hour.

  it("22:00 UTC on 24 Oct 2026 (23:00 BST) is window_3", () => {
    expect(getActiveWindow(new Date("2026-10-24T22:00:00Z"))).toBe("window_3");
  });

  it("00:30 UTC on 25 Oct 2026 (01:30 BST, pre-fallback) is window_3", () => {
    expect(getActiveWindow(new Date("2026-10-25T00:30:00Z"))).toBe("window_3");
  });

  it("01:30 UTC on 25 Oct 2026 (01:30 GMT, post-fallback) is window_3", () => {
    expect(getActiveWindow(new Date("2026-10-25T01:30:00Z"))).toBe("window_3");
  });

  it("12:00 UTC on 25 Oct 2026 (12:00 GMT) is window_3", () => {
    expect(getActiveWindow(new Date("2026-10-25T12:00:00Z"))).toBe("window_3");
  });

  it("window_1 boundary is in BST: 08:00 UTC = 09:00 BST on 30 Jun 2026", () => {
    expect(getActiveWindow(new Date("2026-06-30T08:00:00Z"))).toBe("window_1");
    expect(() => getActiveWindow(new Date("2026-06-30T07:59:00Z"))).toThrow(BookingsNotOpenError);
  });

  it("window_4 boundary is in GMT: 00:00 UTC = 00:00 GMT on 1 Jan 2027", () => {
    expect(getActiveWindow(new Date("2027-01-01T00:00:00Z"))).toBe("window_4");
    expect(getActiveWindow(new Date("2026-12-31T23:59:00Z"))).toBe("window_3");
  });
});
