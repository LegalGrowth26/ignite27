import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureExhibitorProfile } from "./create-profile";

interface StubState {
  existingProfile?: { slug: string };
  takenSlugs?: string[];
  insertError?: string;
  inserted?: Record<string, unknown>;
}

function stubClient(state: StubState): SupabaseClient {
  return {
    from(table: string) {
      if (table !== "exhibitor_profiles") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.existingProfile ?? null, error: null }),
          }),
          like: async () => ({
            data: (state.takenSlugs ?? []).map((slug) => ({ slug })),
            error: null,
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          state.inserted = row;
          return state.insertError ? { error: { message: state.insertError } } : { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const input = {
  bookingId: "b-1",
  companyName: "Impact Marketing",
  fallbackName: null,
  contactEmail: "hello@impact.example.com",
};

describe("ensureExhibitorProfile", () => {
  it("creates a published profile with a slug from the company name", async () => {
    const state: StubState = {};
    const result = await ensureExhibitorProfile(stubClient(state), input);
    expect(result).toEqual({ created: true, slug: "impact-marketing" });
    expect(state.inserted).toMatchObject({
      booking_id: "b-1",
      slug: "impact-marketing",
      display_name: "Impact Marketing",
      contact_email: "hello@impact.example.com",
    });
  });

  it("is idempotent: an existing profile short-circuits without inserting", async () => {
    const state: StubState = { existingProfile: { slug: "impact-marketing" } };
    const result = await ensureExhibitorProfile(stubClient(state), input);
    expect(result).toEqual({ created: false, slug: "impact-marketing" });
    expect(state.inserted).toBeUndefined();
  });

  it("suffixes on slug collision with another company", async () => {
    const state: StubState = { takenSlugs: ["impact-marketing"] };
    const result = await ensureExhibitorProfile(stubClient(state), input);
    expect(result.slug).toBe("impact-marketing-2");
  });

  it("treats a unique-violation race as already-created", async () => {
    const state: StubState = { insertError: 'duplicate key value violates unique constraint' };
    const result = await ensureExhibitorProfile(stubClient(state), input);
    expect(result.created).toBe(false);
  });

  it("falls back to the attendee-derived name for pre-backfill rows", async () => {
    const state: StubState = {};
    const result = await ensureExhibitorProfile(stubClient(state), {
      ...input,
      companyName: null,
      fallbackName: "Fallback Widgets Ltd",
    });
    expect(result.slug).toBe("fallback-widgets-ltd");
  });

  it("refuses to invent a page when no name exists anywhere", async () => {
    const state: StubState = {};
    const result = await ensureExhibitorProfile(stubClient(state), {
      ...input,
      companyName: null,
      fallbackName: "  ",
    });
    expect(result).toEqual({ created: false, slug: null });
    expect(state.inserted).toBeUndefined();
  });
});
