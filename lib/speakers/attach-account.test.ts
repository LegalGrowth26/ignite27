import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSpeakerAccount } from "./create-profile";

// Regression for the second-account bug class: an invite whose email
// exactly matches an existing IGNITE! account must ATTACH the profile
// to that account (and say so), never mint a parallel identity.

const ensureAuthUserWithStatus = vi.fn();
const upsertAppUser = vi.fn();

vi.mock("@/lib/bookings/create", () => ({
  ensureAuthUserWithStatus: (...args: unknown[]) => ensureAuthUserWithStatus(...args),
  upsertAppUser: (...args: unknown[]) => upsertAppUser(...args),
}));

// Minimal speaker_profiles stub: read returns the given user_id; the
// update records what it was called with.
function stubClient(profileUserId: string | null) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => {
      if (table !== "speaker_profiles") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { user_id: profileUserId }, error: null }),
          }),
        }),
        update: (row: Record<string, unknown>) => ({
          eq: () => ({
            is: async () => {
              updates.push(row);
              return { error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, updates };
}

beforeEach(() => {
  ensureAuthUserWithStatus.mockReset();
  upsertAppUser.mockReset();
});

describe("attachSpeakerAccount", () => {
  it("attaches an unlinked profile to an EXISTING account and reports it", async () => {
    ensureAuthUserWithStatus.mockResolvedValue({
      authUserId: "auth-1",
      accountExisted: true,
    });
    upsertAppUser.mockResolvedValue("user-1");
    const { client, updates } = stubClient(null);

    const result = await attachSpeakerAccount(
      client,
      "profile-1",
      "mike@wfttpartnership.co.uk",
      "Mike Wistow",
    );

    expect(result).toEqual({ appUserId: "user-1", created: true, accountExisted: true });
    expect(updates).toEqual([{ user_id: "user-1" }]);
    // The existing account is looked up, never a fresh insert forced.
    expect(ensureAuthUserWithStatus).toHaveBeenCalledWith(
      client,
      "mike@wfttpartnership.co.uk",
      expect.objectContaining({ first_name: "Mike" }),
    );
  });

  it("is a no-op when the profile is already on that account", async () => {
    ensureAuthUserWithStatus.mockResolvedValue({
      authUserId: "auth-1",
      accountExisted: true,
    });
    upsertAppUser.mockResolvedValue("user-1");
    const { client, updates } = stubClient("user-1");

    const result = await attachSpeakerAccount(client, "p1", "a@b.co", "A B");
    expect(result.created).toBe(false);
    expect(result.accountExisted).toBe(true);
    expect(updates).toEqual([]);
  });

  it("refuses to re-point a profile linked to a DIFFERENT account", async () => {
    ensureAuthUserWithStatus.mockResolvedValue({
      authUserId: "auth-2",
      accountExisted: false,
    });
    upsertAppUser.mockResolvedValue("user-2");
    const { client, updates } = stubClient("someone-else");

    await expect(attachSpeakerAccount(client, "p1", "a@b.co", "A B")).rejects.toThrow(
      /different account/,
    );
    expect(updates).toEqual([]);
  });

  it("reports a brand-new account so the invite sends set-password", async () => {
    ensureAuthUserWithStatus.mockResolvedValue({
      authUserId: "auth-3",
      accountExisted: false,
    });
    upsertAppUser.mockResolvedValue("user-3");
    const { client } = stubClient(null);

    const result = await attachSpeakerAccount(client, "p1", "new@b.co", "New Person");
    expect(result.accountExisted).toBe(false);
  });
});
