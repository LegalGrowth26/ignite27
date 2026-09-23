import { describe, expect, it } from "vitest";
import {
  canCancelWorkshopBooking,
  timesOverlap,
  workshopAccess,
} from "./access";

// Workshop priority access logic: every boundary, both tiers.
// The window instants are UK midnights in January (GMT), so UTC
// timestamps below ARE the UK wall-clock times.

describe("workshopAccess", () => {
  it("before 1 Jan: closed for everyone, with the right opening date each", () => {
    const now = new Date("2026-12-31T23:59:59Z");
    const vip = workshopAccess(now, true);
    const general = workshopAccess(now, false);
    expect(vip.open).toBe(false);
    expect(general.open).toBe(false);
    if (!vip.open) expect(vip.opensAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    if (!general.open) expect(general.opensAt.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });

  it("VIP window opens exactly at 1 Jan 2027 00:00 UK", () => {
    expect(workshopAccess(new Date("2026-12-31T23:59:59Z"), true).open).toBe(false);
    expect(workshopAccess(new Date("2027-01-01T00:00:00Z"), true).open).toBe(true);
  });

  it("VIP window does NOT open general access", () => {
    const now = new Date("2027-01-02T12:00:00Z");
    expect(workshopAccess(now, true).open).toBe(true);
    expect(workshopAccess(now, false).open).toBe(false);
  });

  it("general window opens exactly at 4 Jan 2027 00:00 UK, for everyone", () => {
    expect(workshopAccess(new Date("2027-01-03T23:59:59Z"), false).open).toBe(false);
    expect(workshopAccess(new Date("2027-01-04T00:00:00Z"), false).open).toBe(true);
    expect(workshopAccess(new Date("2027-01-04T00:00:00Z"), true).open).toBe(true);
  });
});

describe("canCancelWorkshopBooking", () => {
  it("allowed through the whole day before the event", () => {
    expect(canCancelWorkshopBooking(new Date("2027-01-20T23:59:59Z"))).toBe(true);
  });

  it("closed from 00:00 UK on event day", () => {
    expect(canCancelWorkshopBooking(new Date("2027-01-21T00:00:00Z"))).toBe(false);
    expect(canCancelWorkshopBooking(new Date("2027-01-21T09:00:00Z"))).toBe(false);
  });
});

describe("timesOverlap", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2027, 0, 21, h, m));

  it("detects a plain overlap", () => {
    expect(timesOverlap(at(10), at(11), at(10, 30), at(11, 30))).toBe(true);
  });

  it("detects containment both ways", () => {
    expect(timesOverlap(at(10), at(12), at(10, 30), at(11))).toBe(true);
    expect(timesOverlap(at(10, 30), at(11), at(10), at(12))).toBe(true);
  });

  it("back-to-back sessions do not clash", () => {
    expect(timesOverlap(at(13), at(14), at(14), at(15))).toBe(false);
    expect(timesOverlap(at(14), at(15), at(13), at(14))).toBe(false);
  });

  it("disjoint sessions do not clash", () => {
    expect(timesOverlap(at(9), at(10), at(14), at(15))).toBe(false);
  });
});

describe("resolveWorkshopHost", () => {
  it("links only PUBLISHED host profiles; unpublished or missing fall back", async () => {
    const { resolveWorkshopHost } = await import("./queries");
    expect(
      resolveWorkshopHost({ slug: "jane", display_name: "Jane Doe", published_at: "2026-09-01" }),
    ).toEqual({ slug: "jane", displayName: "Jane Doe" });
    expect(
      resolveWorkshopHost({ slug: "jane", display_name: "Jane Doe", published_at: null }),
    ).toBeNull();
    expect(resolveWorkshopHost(null)).toBeNull();
    expect(resolveWorkshopHost(undefined)).toBeNull();
  });
});
