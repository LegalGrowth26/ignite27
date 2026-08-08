import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pickStrandedLogo, saveRequirementsRow } from "./save-requirements";

interface Captured {
  updatePayload?: Record<string, unknown>;
  updateFilter?: { column: string; value: string };
  insertPayload?: Record<string, unknown>;
}

function stubClient(opts: { existingRow: boolean; captured: Captured }): SupabaseClient {
  return {
    from(table: string) {
      if (table !== "exhibitor_requirements") throw new Error(`unexpected table ${table}`);
      return {
        update: (payload: Record<string, unknown>) => {
          opts.captured.updatePayload = payload;
          return {
            eq: (column: string, value: string) => {
              opts.captured.updateFilter = { column, value };
              return {
                select: async () => ({
                  data: opts.existingRow ? [{ id: "req-1" }] : [],
                  error: null,
                }),
              };
            },
          };
        },
        insert: async (payload: Record<string, unknown>) => {
          opts.captured.insertPayload = payload;
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const fields = {
  needs_power: true,
  needs_table_chairs: false,
  signage_name: "Analytical Engines",
  website_url: "https://analyticalengines.example.com/",
};

describe("saveRequirementsRow", () => {
  // The regression that broke production: booking_id in an UPDATE SET
  // list trips the column-level grants (only content columns are
  // updatable by authenticated). The update payload must never carry it.
  it("update path: booking_id appears in the filter, NEVER the payload", async () => {
    const captured: Captured = {};
    const result = await saveRequirementsRow(
      stubClient({ existingRow: true, captured }),
      "booking-1",
      fields,
    );
    expect(result.error).toBeNull();
    expect(captured.updatePayload).toBeDefined();
    expect(Object.keys(captured.updatePayload!)).not.toContain("booking_id");
    expect(captured.updateFilter).toEqual({ column: "booking_id", value: "booking-1" });
    expect(captured.insertPayload).toBeUndefined();
  });

  it("inserts (with booking_id) when no row exists yet", async () => {
    const captured: Captured = {};
    const result = await saveRequirementsRow(
      stubClient({ existingRow: false, captured }),
      "booking-1",
      fields,
    );
    expect(result.error).toBeNull();
    expect(captured.insertPayload).toMatchObject({
      booking_id: "booking-1",
      signage_name: "Analytical Engines",
    });
  });

  it("includes logo_path only when provided", async () => {
    const captured: Captured = {};
    await saveRequirementsRow(stubClient({ existingRow: true, captured }), "booking-1", {
      ...fields,
      logo_path: "booking-1/logo.png",
    });
    expect(captured.updatePayload).toMatchObject({ logo_path: "booking-1/logo.png" });

    const captured2: Captured = {};
    await saveRequirementsRow(stubClient({ existingRow: true, captured: captured2 }), "booking-1", fields);
    expect(Object.keys(captured2.updatePayload!)).not.toContain("logo_path");
  });
});

describe("pickStrandedLogo", () => {
  it("adopts a stranded logo file left by the old save bug", () => {
    expect(pickStrandedLogo([{ name: "logo.png" }])).toBe("logo.png");
  });

  it("picks the newest when several extensions were tried", () => {
    expect(
      pickStrandedLogo([
        { name: "logo.png", created_at: "2026-08-07T10:00:00Z" },
        { name: "logo.webp", created_at: "2026-08-07T11:00:00Z" },
      ]),
    ).toBe("logo.webp");
  });

  it("ignores files that are not logos and handles empty listings", () => {
    expect(pickStrandedLogo([{ name: ".emptyFolderPlaceholder" }])).toBeNull();
    expect(pickStrandedLogo([])).toBeNull();
  });
});
