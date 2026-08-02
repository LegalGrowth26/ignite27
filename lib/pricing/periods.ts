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
    // Launch week, extended per organiser decision (July 2026): runs
    // Sat 1 Aug 09:00 UK through Sat 8 Aug 23:59:59 UK. Half-open, so
    // the close instant (Sun 9 Aug 00:00 UK) belongs to standard.
    period: "launch",
    opensAt: ukLocal("2026-08-01T09:00:00"),
    closesAt: ukLocal("2026-08-09T00:00:00"),
  },
  {
    period: "standard",
    opensAt: ukLocal("2026-08-09T00:00:00"),
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
