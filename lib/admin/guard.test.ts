import { describe, expect, it } from "vitest";
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
  it("returns null when there is no session", async () => {
    expect(await resolveAdminContext(stubClient({ authUser: null }))).toBeNull();
  });

  it("returns null when auth errors", async () => {
    expect(await resolveAdminContext(stubClient({ authError: true }))).toBeNull();
  });

  it("returns null when there is no app users row", async () => {
    expect(
      await resolveAdminContext(stubClient({ authUser: { id: "au1" }, userRow: null })),
    ).toBeNull();
  });

  it("returns null for attendee role", async () => {
    expect(
      await resolveAdminContext(
        stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "attendee" } }),
      ),
    ).toBeNull();
  });

  it("returns null for scanner_staff role", async () => {
    expect(
      await resolveAdminContext(
        stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "scanner_staff" } }),
      ),
    ).toBeNull();
  });

  it("returns null when the users query errors", async () => {
    expect(
      await resolveAdminContext(stubClient({ authUser: { id: "au1" }, queryError: true })),
    ).toBeNull();
  });

  it("returns the context for a super admin", async () => {
    const ctx = await resolveAdminContext(
      stubClient({ authUser: { id: "au1" }, userRow: { id: "u1", role: "super_admin" } }),
    );
    expect(ctx).not.toBeNull();
    expect(ctx?.appUserId).toBe("u1");
    expect(ctx?.authUserId).toBe("au1");
  });
});
