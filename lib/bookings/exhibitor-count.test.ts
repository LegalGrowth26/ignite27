import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXHIBITOR_STAND_CAP, exhibitorStandsRemaining, isExhibitorAvailable } from "@/lib/pricing";
import {
  countCompletedExhibitorBookings,
  ExhibitorCountError,
  STAND_COUNTED_STATUSES,
} from "./exhibitor-count";

function stubCountClient(opts: {
  count?: number | null;
  error?: boolean;
  capture?: { statuses?: string[]; bookingType?: string };
}): SupabaseClient {
  return {
    from(table: string) {
      if (table !== "bookings") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, value: string) => {
            if (opts.capture) opts.capture.bookingType = value;
            return {
              in: async (_c: string, statuses: string[]) => {
                if (opts.capture) opts.capture.statuses = statuses;
                return opts.error
                  ? { count: null, error: { message: "boom" } }
                  : { count: opts.count ?? 0, error: null };
              },
            };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("countCompletedExhibitorBookings", () => {
  it("counts exhibitor bookings with paid or comp status only", async () => {
    const capture: { statuses?: string[]; bookingType?: string } = {};
    const count = await countCompletedExhibitorBookings(
      stubCountClient({ count: 7, capture }),
    );
    expect(count).toBe(7);
    expect(capture.bookingType).toBe("exhibitor");
    // SPEC: only PAID bookings hold a stand; comp is a real stand with
    // zero revenue. Pending/refunded/abandoned never count.
    expect(capture.statuses).toEqual([...STAND_COUNTED_STATUSES]);
    expect(capture.statuses).not.toContain("pending");
    expect(capture.statuses).not.toContain("refunded");
  });

  it("treats a null count as zero", async () => {
    expect(await countCompletedExhibitorBookings(stubCountClient({ count: null }))).toBe(0);
  });

  it("throws a typed error on query failure", async () => {
    await expect(
      countCompletedExhibitorBookings(stubCountClient({ error: true })),
    ).rejects.toBeInstanceOf(ExhibitorCountError);
  });
});

describe("stand cap gating (count feeding the existing cap helpers)", () => {
  it("cap boundary: 49 sold leaves 1 stand and stays available", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP - 1)).toBe(1);
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP - 1)).toBe(true);
  });

  it("cap boundary: 50 sold is sold out", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP)).toBe(0);
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP)).toBe(false);
  });

  it("oversell (race past the cap) still reports zero remaining, never negative", () => {
    expect(exhibitorStandsRemaining(EXHIBITOR_STAND_CAP + 1)).toBe(0);
    expect(isExhibitorAvailable(EXHIBITOR_STAND_CAP + 1)).toBe(false);
  });
});
