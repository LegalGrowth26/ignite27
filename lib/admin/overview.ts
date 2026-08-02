import { EXHIBITOR_STAND_CAP, PRICING_PERIODS, BOOKINGS_CLOSE_AT } from "@/lib/pricing";

// Pure aggregation over booking rows so it can be unit tested without a
// database. The admin overview fetches the minimal column set below via
// the (RLS-admin) user client and feeds it in here.
export interface OverviewBookingRow {
  booking_type: "delegate" | "exhibitor";
  ticket_type: "regular" | "vip" | "exhibitor";
  gross_amount_pence: number;
  vat_amount_pence: number;
  payment_status: string;
  created_at: string; // ISO
}

export interface OverviewStats {
  totalBookings: number;
  delegates: number;
  vips: number;
  exhibitors: number;
  grossIncVatPence: number;
  grossExVatPence: number;
  standsSold: number;
  standCap: number;
  last24h: number;
  last7d: number;
}

// Statuses that count as a completed sale. "comp" is a real booking with
// zero revenue; refunded/failed/pending are excluded from revenue and
// stand counts.
const COUNTED_STATUSES = new Set(["paid", "comp"]);

export function computeOverview(rows: readonly OverviewBookingRow[], now: Date): OverviewStats {
  const counted = rows.filter((r) => COUNTED_STATUSES.has(r.payment_status));
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  let delegates = 0;
  let vips = 0;
  let exhibitors = 0;
  let grossIncVatPence = 0;
  let vatPence = 0;
  let last24h = 0;
  let last7d = 0;

  for (const r of counted) {
    if (r.booking_type === "exhibitor") exhibitors += 1;
    else if (r.ticket_type === "vip") vips += 1;
    else delegates += 1;

    grossIncVatPence += r.gross_amount_pence;
    vatPence += r.vat_amount_pence;

    const created = new Date(r.created_at).getTime();
    if (created >= dayAgo) last24h += 1;
    if (created >= weekAgo) last7d += 1;
  }

  return {
    totalBookings: counted.length,
    delegates,
    vips,
    exhibitors,
    grossIncVatPence,
    grossExVatPence: grossIncVatPence - vatPence,
    standsSold: exhibitors,
    standCap: EXHIBITOR_STAND_CAP,
    last24h,
    last7d,
  };
}

export interface PeriodStatus {
  label: string;
  nextBoundaryLabel: string;
  msToNextBoundary: number | null;
}

// Current period + time to the next boundary, from the canonical
// PRICING_PERIODS. Pre-open counts down to launch; post-close reports
// closed with no boundary.
export function currentPeriodStatus(now: Date): PeriodStatus {
  const t = now.getTime();
  const launch = PRICING_PERIODS[0];
  if (!launch) throw new Error("PRICING_PERIODS is empty");
  if (t < launch.opensAt.getTime()) {
    return {
      label: "Pre-launch (bookings not open)",
      nextBoundaryLabel: "Launch opens",
      msToNextBoundary: launch.opensAt.getTime() - t,
    };
  }
  for (const p of PRICING_PERIODS) {
    if (t >= p.opensAt.getTime() && t < p.closesAt.getTime()) {
      const isLast = p.period === "late";
      return {
        label: `${p.period.charAt(0).toUpperCase()}${p.period.slice(1)} pricing`,
        nextBoundaryLabel: isLast ? "Bookings close" : "Next period starts",
        msToNextBoundary: p.closesAt.getTime() - t,
      };
    }
  }
  return {
    label: "Bookings closed",
    nextBoundaryLabel: "Closed",
    msToNextBoundary: t >= BOOKINGS_CLOSE_AT.getTime() ? null : BOOKINGS_CLOSE_AT.getTime() - t,
  };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
