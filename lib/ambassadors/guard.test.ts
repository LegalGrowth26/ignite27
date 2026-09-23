import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAmbassadorContext, type AmbassadorRow } from "./guard";

const activeAmbassador: AmbassadorRow = {
  id: "amb-1",
  slug: "stephine",
  display_name: "Stephine Robinson",
  company: "Women in Tech",
  ambassador_type: "speaker",
  comp_allowance: 5,
  discount_percent: null,
  promo_code: null,
  comp_claim_token: "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  link_clicks: 12,
  deactivated_at: null,
};

function stubClient(opts: {
  authUser?: { id: string } | null;
  userRow?: { id: string; role: string } | null;
  ambassadorRow?: AmbassadorRow | null;
}): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.authUser ?? null },
        error: null,
      }),
    },
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.userRow ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "ambassadors") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.ambassadorRow ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe("resolveAmbassadorContext", () => {
  let warnSpy: MockInstance;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns the context for an active ambassador", async () => {
    const ctx = await resolveAmbassadorContext(
      stubClient({
        authUser: { id: "au1" },
        userRow: { id: "u1", role: "ambassador" },
        ambassadorRow: activeAmbassador,
      }),
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.appUserId).toBe("u1");
    expect(ctx?.ambassador.slug).toBe("stephine");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("denies with no session", async () => {
    expect(await resolveAmbassadorContext(stubClient({ authUser: null }))).toBeNull();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("no-session");
  });

  it("allows a DUAL-ROLE super admin who has their own active ambassadors row", async () => {
    const ctx = await resolveAmbassadorContext(
      stubClient({
        authUser: { id: "au-admin" },
        userRow: { id: "u-admin", role: "super_admin" },
        ambassadorRow: activeAmbassador,
      }),
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.appUserId).toBe("u-admin");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("denies a super admin WITHOUT an ambassadors row (admin view routes via /admin)", async () => {
    expect(
      await resolveAmbassadorContext(
        stubClient({
          authUser: { id: "au-admin" },
          userRow: { id: "u-admin", role: "super_admin" },
          ambassadorRow: null,
        }),
      ),
    ).toBeNull();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("no-ambassador-row");
  });

  it("denies attendees and scanner staff (role-mismatch)", async () => {
    for (const role of ["attendee", "scanner_staff"]) {
      warnSpy.mockClear();
      expect(
        await resolveAmbassadorContext(
          stubClient({
            authUser: { id: "au1" },
            userRow: { id: "u1", role },
            ambassadorRow: activeAmbassador,
          }),
        ),
      ).toBeNull();
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain("role-mismatch");
    }
  });

  it("denies an ambassador role with no ambassadors row", async () => {
    expect(
      await resolveAmbassadorContext(
        stubClient({
          authUser: { id: "au1" },
          userRow: { id: "u1", role: "ambassador" },
          ambassadorRow: null,
        }),
      ),
    ).toBeNull();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("no-ambassador-row");
  });

  it("denies a DEACTIVATED ambassador, keeping their data intact", async () => {
    expect(
      await resolveAmbassadorContext(
        stubClient({
          authUser: { id: "au1" },
          userRow: { id: "u1", role: "ambassador" },
          ambassadorRow: { ...activeAmbassador, deactivated_at: "2026-09-01T00:00:00Z" },
        }),
      ),
    ).toBeNull();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("deactivated");
  });
});
