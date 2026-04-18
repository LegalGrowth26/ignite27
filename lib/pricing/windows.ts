import { fromZonedTime } from "date-fns-tz";

export type PricingWindow =
  | "window_1"
  | "window_2"
  | "window_3"
  | "christmas_drop"
  | "window_4"
  | "event_day";

export interface PricingWindowBoundary {
  window: PricingWindow;
  opensAt: Date;
  closesAt: Date;
}

export const PRICING_TIMEZONE = "Europe/London";

// Convert a UK-local wall-clock instant to the corresponding UTC Date.
// date-fns-tz handles BST/GMT automatically based on the date.
function ukLocal(iso: string): Date {
  return fromZonedTime(iso, PRICING_TIMEZONE);
}

// Ordered list used by getActiveWindow. Ranges are half-open [opensAt, closesAt).
// The one-minute gaps the SPEC shows between "23:59" close and "00:00" open are
// absorbed into the earlier window: closesAt is set to the next window's open.
export const PRICING_WINDOWS: readonly PricingWindowBoundary[] = [
  {
    window: "window_1",
    opensAt: ukLocal("2026-06-30T09:00:00"),
    closesAt: ukLocal("2026-07-02T09:00:00"),
  },
  {
    window: "window_2",
    opensAt: ukLocal("2026-07-02T09:00:00"),
    closesAt: ukLocal("2026-07-20T00:00:00"),
  },
  {
    window: "window_3",
    opensAt: ukLocal("2026-07-20T00:00:00"),
    closesAt: ukLocal("2027-01-01T00:00:00"),
  },
  {
    window: "window_4",
    opensAt: ukLocal("2027-01-01T00:00:00"),
    closesAt: ukLocal("2027-01-31T00:00:00"),
  },
  {
    window: "event_day",
    opensAt: ukLocal("2027-01-31T00:00:00"),
    closesAt: ukLocal("2027-02-01T00:00:00"),
  },
];

// Christmas drop is an overlay on top of Window 3 that silently reverts to
// Window 2 prices for the whole of 25 December 2026 UK-local.
export const CHRISTMAS_DROP: PricingWindowBoundary = {
  window: "christmas_drop",
  opensAt: ukLocal("2026-12-25T00:00:00"),
  closesAt: ukLocal("2026-12-26T00:00:00"),
};

export const BOOKINGS_OPEN_AT: Date = ukLocal("2026-06-30T09:00:00");
export const BOOKINGS_CLOSE_AT: Date = ukLocal("2027-02-01T00:00:00");
