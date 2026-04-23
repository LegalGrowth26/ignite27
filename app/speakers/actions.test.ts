import { beforeEach, describe, expect, it, vi } from "vitest";

// The shared subscribeToEmailList helper is exercised comprehensively by
// app/agenda/actions.test.ts. These tests cover only what's specific to
// the /speakers surface: the source value and the page-specific field
// name (wantsSpeakersAlert).

const { upsertMock, headersMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-client", () => ({
  createSupabaseServiceClient: () => ({
    from: (_table: string) => ({
      upsert: upsertMock,
    }),
  }),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

import { subscribeSpeakersUpdatesAction } from "./actions";

function stubHeaders(entries: Record<string, string> = {}): void {
  headersMock.mockResolvedValue({
    get: (name: string) => entries[name.toLowerCase()] ?? null,
  });
}

describe("subscribeSpeakersUpdatesAction", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    headersMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
    stubHeaders();
  });

  it("writes the signup with source='speakers_page' on valid input", async () => {
    const result = await subscribeSpeakersUpdatesAction({
      email: "ada@example.com",
      wantsSpeakersAlert: true,
      wantsMarketing: false,
    });

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [payload, options] = upsertMock.mock.calls[0] ?? [];
    const row = payload as Record<string, unknown>;
    expect(row.source).toBe("speakers_page");
    expect(row.email).toBe("ada@example.com");
    expect(row.wants_topic_alert).toBe(true);
    expect(row.wants_marketing).toBe(false);
    expect(options).toEqual({ onConflict: "email,source" });
  });

  it("rejects a submission with wantsSpeakersAlert missing or false", async () => {
    const missing = await subscribeSpeakersUpdatesAction({
      email: "ada@example.com",
      wantsMarketing: false,
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toMatch(/tick the box/i);

    const falseFlag = await subscribeSpeakersUpdatesAction({
      email: "ada@example.com",
      wantsSpeakersAlert: false,
      wantsMarketing: false,
    });
    expect(falseFlag.ok).toBe(false);

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without writing a row", async () => {
    const result = await subscribeSpeakersUpdatesAction({
      email: "not-an-email",
      wantsSpeakersAlert: true,
      wantsMarketing: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/email/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
