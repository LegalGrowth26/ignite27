import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { computeOverview, currentPeriodStatus, formatDuration, type OverviewBookingRow } from "./overview";
import { EXHIBITOR_STAND_CAP, PRICING_TIMEZONE } from "@/lib/pricing";

const uk = (iso: string) => fromZonedTime(iso, PRICING_TIMEZONE);

const NOW = new Date("2026-08-10T12:00:00Z");

function row(overrides: Partial<OverviewBookingRow>): OverviewBookingRow {
  return {
    booking_type: "delegate",
    ticket_type: "regular",
    gross_amount_pence: 4200,
    vat_amount_pence: 700,
    payment_status: "paid",
    created_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("computeOverview", () => {
  it("splits delegates, VIPs, and exhibitors", () => {
    const stats = computeOverview(
      [
        row({}),
        row({ ticket_type: "vip" }),
        row({ booking_type: "exhibitor", ticket_type: "exhibitor" }),
      ],
      NOW,
    );
    expect(stats.totalBookings).toBe(3);
    expect(stats.delegates).toBe(1);
    expect(stats.vips).toBe(1);
    expect(stats.exhibitors).toBe(1);
    expect(stats.standsSold).toBe(1);
    expect(stats.standCap).toBe(EXHIBITOR_STAND_CAP);
  });

  it("computes gross inc-VAT and ex-VAT from the VAT column", () => {
    const stats = computeOverview([row({}), row({})], NOW);
    expect(stats.grossIncVatPence).toBe(8400);
    expect(stats.grossExVatPence).toBe(7000);
  });

  it("includes comp bookings in counts with zero revenue impact", () => {
    const stats = computeOverview(
      [row({}), row({ payment_status: "comp", gross_amount_pence: 0, vat_amount_pence: 0 })],
      NOW,
    );
    expect(stats.totalBookings).toBe(2);
    expect(stats.grossIncVatPence).toBe(4200);
  });

  it("excludes pending, failed, and refunded bookings entirely", () => {
    const stats = computeOverview(
      [
        row({ payment_status: "pending" }),
        row({ payment_status: "failed" }),
        row({ payment_status: "refunded" }),
      ],
      NOW,
    );
    expect(stats.totalBookings).toBe(0);
    expect(stats.grossIncVatPence).toBe(0);
  });

  it("buckets bookings into last-24h and last-7d windows", () => {
    const stats = computeOverview(
      [
        row({ created_at: new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString() }), // 2h ago
        row({ created_at: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() }), // 3d ago
        row({ created_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() }), // 10d ago
      ],
      NOW,
    );
    expect(stats.last24h).toBe(1);
    expect(stats.last7d).toBe(2);
  });
});

describe("currentPeriodStatus", () => {
  it("reports pre-launch with a countdown to open", () => {
    const s = currentPeriodStatus(uk("2026-07-01T00:00:00"));
    expect(s.label).toContain("Pre-launch");
    expect(s.msToNextBoundary).toBeGreaterThan(0);
  });

  it("reports launch pricing inside launch week", () => {
    const s = currentPeriodStatus(uk("2026-08-05T12:00:00"));
    expect(s.label).toBe("Launch pricing");
  });

  it("reports closed after 18 Jan 2027 17:00", () => {
    const s = currentPeriodStatus(uk("2027-02-01T00:00:00"));
    expect(s.label).toBe("Bookings closed");
    expect(s.msToNextBoundary).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats days, hours, minutes appropriately", () => {
    expect(formatDuration(3 * 86_400_000 + 5 * 3_600_000)).toBe("3d 5h");
    expect(formatDuration(5 * 3_600_000 + 30 * 60_000)).toBe("5h 30m");
    expect(formatDuration(12 * 60_000)).toBe("12m");
  });
});
