import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  computeOverview,
  currentPeriodStatus,
  formatDuration,
  type OverviewBookingRow,
} from "@/lib/admin/overview";
import { formatPoundsFromPence } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin overview · IGNITE! 27",
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage() {
  const { client } = await requireSuperAdmin();

  const { data, error } = await client
    .from("bookings")
    .select("booking_type, ticket_type, gross_amount_pence, vat_amount_pence, payment_status, created_at");
  if (error) console.error("[admin/overview] bookings query error:", error);

  const now = new Date();
  const stats = computeOverview((data ?? []) as OverviewBookingRow[], now);
  const period = currentPeriodStatus(now);

  const tiles: ReadonlyArray<{ label: string; value: string; sub?: string }> = [
    { label: "Total bookings", value: String(stats.totalBookings) },
    {
      label: "Delegates / VIPs / Exhibitors",
      value: `${stats.delegates} / ${stats.vips} / ${stats.exhibitors}`,
    },
    {
      label: "Gross revenue",
      value: formatPoundsFromPence(stats.grossIncVatPence),
      sub: `${formatPoundsFromPence(stats.grossExVatPence)} ex-VAT`,
    },
    {
      label: "Stands sold",
      value: `${stats.standsSold} / ${stats.standCap}`,
    },
    { label: "Bookings, last 24h", value: String(stats.last24h) },
    { label: "Bookings, last 7 days", value: String(stats.last7d) },
    {
      label: "Pricing period",
      value: period.label,
      sub:
        period.msToNextBoundary !== null
          ? `${period.nextBoundaryLabel} in ${formatDuration(period.msToNextBoundary)}`
          : undefined,
    },
  ];

  return (
    <div>
      <h1 className="text-h1">Overview</h1>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-ignite-line bg-ignite-white p-5"
          >
            <dt className="text-eyebrow uppercase text-ignite-muted">{t.label}</dt>
            <dd className="mt-2 text-h2 text-ignite-ink">{t.value}</dd>
            {t.sub ? <dd className="mt-1 text-small text-ignite-muted">{t.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="mt-6 text-small text-ignite-muted">
        Counts and revenue include paid and comp bookings. Pending, failed,
        and refunded bookings are excluded.
      </p>
    </div>
  );
}
