import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAuthUserWithStatus } from "./create";

// The comp email points people at "Forgot password on the login page:
// that route always works." This pins the precondition that makes it
// true: every account we mint (comp recipients included) is created
// email-confirmed with a real random password, because Supabase will
// not issue a recovery email for an unconfirmed account.
describe("ensureAuthUserWithStatus", () => {
  it("creates recovery-capable accounts: email confirmed, random password", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    const client = {
      auth: { admin: { createUser } },
    } as unknown as SupabaseClient;

    const result = await ensureAuthUserWithStatus(client, "guest@example.com", {});
    expect(result).toEqual({ authUserId: "auth-1", accountExisted: false });

    const params = createUser.mock.calls[0]![0] as {
      email: string;
      password: string;
      email_confirm: boolean;
    };
    expect(params.email_confirm).toBe(true);
    // 24 random bytes hex-encoded: high entropy, never guessable, and
    // immediately replaceable via the recovery flow.
    expect(params.password).toMatch(/^[0-9a-f]{48}$/);
  });

  it("reports an existing account instead of minting a duplicate", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { status: 422, message: "User already registered" },
    });
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [{ id: "auth-9", email: "guest@example.com" }] },
      error: null,
    });
    const client = {
      auth: { admin: { createUser, listUsers } },
    } as unknown as SupabaseClient;

    const result = await ensureAuthUserWithStatus(client, "Guest@Example.com", {});
    expect(result).toEqual({ authUserId: "auth-9", accountExisted: true });
  });
});
