import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared mocks hoisted so vi.mock factories can reference them.
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

import { subscribeAgendaUpdatesAction } from "./actions";

function stubHeaders(entries: Record<string, string>): void {
  headersMock.mockResolvedValue({
    get: (name: string) => entries[name.toLowerCase()] ?? null,
  });
}

describe("subscribeAgendaUpdatesAction", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    headersMock.mockReset();
    stubHeaders({});
  });

  it("upserts the email with agenda_page source on the happy path", async () => {
    upsertMock.mockResolvedValue({ error: null });

    const result = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    expect(result).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [row, options] = upsertMock.mock.calls[0] ?? [];
    expect(row).toMatchObject({
      email: "ada@example.com",
      source: "agenda_page",
      wants_topic_alert: true,
      wants_marketing: false,
    });
    expect(options).toEqual({ onConflict: "email,source" });
  });

  it("passes wants_marketing=true through when the optional box is ticked", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: true,
    });

    const [row] = upsertMock.mock.calls[0] ?? [];
    expect(row.wants_marketing).toBe(true);
  });

  it("lowercases and trims the email before writing", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "  ADA@Example.COM  ",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    const [row] = upsertMock.mock.calls[0] ?? [];
    expect(row.email).toBe("ada@example.com");
  });

  it("rejects when wantsAgendaAlert is false", async () => {
    const result = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: false,
      wantsMarketing: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/tick the box/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects when wantsAgendaAlert is missing entirely", async () => {
    const result = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsMarketing: false,
    });

    expect(result.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects malformed email", async () => {
    const result = await subscribeAgendaUpdatesAction({
      email: "not-an-email",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/email/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects empty email", async () => {
    const result = await subscribeAgendaUpdatesAction({
      email: "",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    expect(result.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("captures ip_address and user_agent from headers", async () => {
    stubHeaders({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "user-agent": "Mozilla/5.0 SmokeTest",
    });
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    const [row] = upsertMock.mock.calls[0] ?? [];
    expect(row.ip_address).toBe("203.0.113.5");
    expect(row.user_agent).toBe("Mozilla/5.0 SmokeTest");
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    stubHeaders({ "x-real-ip": "198.51.100.7" });
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    const [row] = upsertMock.mock.calls[0] ?? [];
    expect(row.ip_address).toBe("198.51.100.7");
  });

  it("records ip_address as null when no proxy headers are present", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });

    const [row] = upsertMock.mock.calls[0] ?? [];
    expect(row.ip_address).toBeNull();
  });

  it("uses upsert onConflict=email,source so re-submits update consent rather than duplicate", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });
    await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: true,
    });

    expect(upsertMock).toHaveBeenCalledTimes(2);
    const [, firstOpts] = upsertMock.mock.calls[0] ?? [];
    const [, secondOpts] = upsertMock.mock.calls[1] ?? [];
    expect(firstOpts).toEqual({ onConflict: "email,source" });
    expect(secondOpts).toEqual({ onConflict: "email,source" });
  });

  it("always returns ok on valid input regardless of pre-existing row (anti-enumeration)", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const first = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });
    const second = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
  });

  it("surfaces a generic error message on DB failure without leaking details", async () => {
    upsertMock.mockResolvedValue({ error: { message: "something deeply internal" } });
    const result = await subscribeAgendaUpdatesAction({
      email: "ada@example.com",
      wantsAgendaAlert: true,
      wantsMarketing: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(/internal/);
    expect(result.error).toMatch(/could not save/i);
  });
});
