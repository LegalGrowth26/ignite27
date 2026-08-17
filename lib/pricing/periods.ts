import { fromZonedTime } from "date-fns-tz";

export type PricingPeriod = "launch" | "standard" | "late";

export interface PricingPeriodBoundary {
  period: PricingPeriod;
  opensAt: Date;
  closesAt: Date;
}

export const PRICING_TIMEZONE = "Europe/London";

// Convert a UK-local wall-clock instant to the corresponding UTC Date.
// date-fns-tz handles BST/GMT automatically based on the date.
function ukLocal(iso: string): Date {
  return fromZonedTime(iso, PRICING_TIMEZONE);
}

// Ordered list used by getActivePeriod. Ranges are half-open
// [opensAt, closesAt). There are no gaps and no event-day sales; the
// close instant of each period equals the open instant of the next.
export const PRICING_PERIODS: readonly PricingPeriodBoundary[] = [
  {
    // Launch window, extended three times per organiser decision (the
    // third revision, Aug 2026): runs Sat 1 Aug 09:00 UK through Mon
    // 24 Aug 16:59:59 UK. NOTE the close is an INTRA-DAY 17:00 cutover,
    // not midnight. Half-open, so the close instant (Mon 24 Aug 17:00
    // UK, BST) belongs to standard.
    period: "launch",
    opensAt: ukLocal("2026-08-01T09:00:00"),
    closesAt: ukLocal("2026-08-24T17:00:00"),
  },
  {
    period: "standard",
    opensAt: ukLocal("2026-08-24T17:00:00"),
    closesAt: ukLocal("2027-01-01T00:00:00"),
  },
  {
    period: "late",
    opensAt: ukLocal("2027-01-01T00:00:00"),
    closesAt: ukLocal("2027-01-18T17:00:00"),
  },
];

export const BOOKINGS_OPEN_AT: Date = ukLocal("2026-08-01T09:00:00");
export const BOOKINGS_CLOSE_AT: Date = ukLocal("2027-01-18T17:00:00");
