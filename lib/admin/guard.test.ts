import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAdminContext } from "./guard";

// Minimal stub client: controls what auth.getUser and the users query
// return so every authz branch can be exercised without a database.
function stubClient(opts: {
  authUser?: { id: string } | null;
  authError?: boolean;
  userRow?: { id: string; role: string } | null;
  queryError?: boolean;
}): SupabaseClient {
  return {
    auth: {
      getUser: async () =>
        opts.authError
          ? { data: { user: null }, error: { message: "boom" } }
          : { data: { user: opts.authUser ?? null }, error: null },
    },
    from(table: string) {
      if (table !== "users") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              opts.queryError
                ? { data: null, error: { message: "query boom" } }
                : { data: opts.userRow ?? null, error: null },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("resolveAdminContext", () => {
  // Every denial must log a reason (the visitor only ever sees a 404,
  // so the log line is the sole diagnostic surface) without leaking
  // emails or tokens.
  let warnSpy: MockInstance;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  function loggedReason(): string {
    expect(warnSpy).toHaveBeenCalledTimes(1);
    return String(warnSpy.mock.calls[0]?.[0]);
  }

  it("returns null when there is no session", async () => {
    expect(await resolveAdminContext(stubClient({ authUser: null }))).toBeNull();
    expect(loggedReason()).toContain("no-session");
  });

  it("returns null when auth errors", async () => {
    expect(await resolveAdminContext(stubClient({ authError: true }))).toBeNull();
    expect(loggedReason()).toContain("no-session");
  });

  it("returns null when there is no app users row", async () => {
    expect(
      await resolveAdminContext(stubClient({ authUser: { id: "au1" }, userRow: null })),
    ).toBeNull();
    expect(loggedReason()).toContain("no-users-row");
  });

  it("returns null for attendee role", async () => {
    expect(
      await resolveAdminContext(
        stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "attendee" } }),
      ),
    ).toBeNull();
    expect(loggedReason()).toContain("role-mismatch");
    expect(String(warnSpy.mock.calls[0]?.[1])).toContain("attendee");
  });

  it("returns null for scanner_staff role", async () => {
    expect(
      await resolveAdminContext(
        stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "scanner_staff" } }),
      ),
    ).toBeNull();
    expect(loggedReason()).toContain("role-mismatch");
  });

  it("returns null when the users query errors", async () => {
    expect(
      await resolveAdminContext(stubClient({ authUser: { id: "au1" }, queryError: true })),
    ).toBeNull();
    expect(loggedReason()).toContain("users-query-error");
  });

  it("returns the context for a super admin", async () => {
    const ctx = await resolveAdminContext(
      stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "super_admin" } }),
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.appUserId).toBe("u1");
    expect(ctx?.authUserId).toBe("au1");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
