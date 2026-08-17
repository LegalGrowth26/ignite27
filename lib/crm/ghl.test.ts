import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  crmTagForBooking,
  isCrmConfigured,
  maskEmail,
  pushContactToCrmSafe,
} from "./ghl";

describe("crmTagForBooking", () => {
  it("delegate regular -> Delegate27", () => {
    expect(crmTagForBooking("delegate", "regular")).toBe("Delegate27");
  });
  it("delegate vip -> VIP27", () => {
    expect(crmTagForBooking("delegate", "vip")).toBe("VIP27");
  });
  it("exhibitor -> Exhibitor27, whatever the ticket type says", () => {
    expect(crmTagForBooking("exhibitor", "exhibitor")).toBe("Exhibitor27");
  });
  // Partner27 is reserved in lib/crm/ghl.ts for partner bookings; no
  // booking type maps to it yet, so there is nothing more to test here.
});

describe("maskEmail", () => {
  it("keeps one character and the domain", () => {
    expect(maskEmail("ada@example.com")).toBe("a***@example.com");
  });
  it("degrades to *** on malformed input", () => {
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("pushContactToCrmSafe", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GHL_API_KEY", "pit-test-token");
    vi.stubEnv("GHL_LOCATION_ID", "loc_123");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const input = {
    email: "Ada@Example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "07700900000",
    tag: "Delegate27" as const,
  };

  function okResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200 });
  }

  it("upserts the contact, then adds the tag via the ADDITIVE tags endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ contact: { id: "c_1" } }))
      .mockResolvedValueOnce(okResponse({ tags: ["Delegate27"] }));

    const ok = await pushContactToCrmSafe(input, "test");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [upsertUrl, upsertInit] = fetchMock.mock.calls[0]!;
    expect(String(upsertUrl)).toContain("/contacts/upsert");
    const upsertBody = JSON.parse((upsertInit as RequestInit).body as string);
    expect(upsertBody).toMatchObject({
      locationId: "loc_123",
      email: "ada@example.com", // lowercased
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "07700900000",
    });
    // Tags must NOT ride on the upsert: a tag array on a contact write
    // can replace the contact's existing tags in the CRM.
    expect(upsertBody.tags).toBeUndefined();
    const headers = (upsertInit as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer pit-test-token");
    expect(headers.Version).toBe("2021-07-28");

    const [tagUrl, tagInit] = fetchMock.mock.calls[1]!;
    expect(String(tagUrl)).toContain("/contacts/c_1/tags");
    expect(JSON.parse((tagInit as RequestInit).body as string)).toEqual({
      tags: ["Delegate27"],
    });
  });

  it("omits phone when not held", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ contact: { id: "c_1" } }))
      .mockResolvedValueOnce(okResponse({}));
    await pushContactToCrmSafe({ ...input, phone: null }, "test");
    const upsertBody = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect("phone" in upsertBody).toBe(false);
  });

  // Failure isolation: the whole point. None of these may throw.
  it("never throws when the API errors, returns false and logs", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    await expect(pushContactToCrmSafe(input, "test")).resolves.toBe(false);
    expect(errSpy).toHaveBeenCalled();
    // The log line must not contain the full email address.
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain("ada@example.com");
    errSpy.mockRestore();
  });

  it("never throws when fetch itself rejects (network death)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(pushContactToCrmSafe(input, "test")).resolves.toBe(false);
    errSpy.mockRestore();
  });

  it("never throws when the tag call fails after a successful upsert", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(okResponse({ contact: { id: "c_1" } }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    await expect(pushContactToCrmSafe(input, "test")).resolves.toBe(false);
    errSpy.mockRestore();
  });

  it("skips cleanly when not configured, without touching the network", async () => {
    vi.stubEnv("GHL_API_KEY", "");
    expect(isCrmConfigured()).toBe(false);
    await expect(pushContactToCrmSafe(input, "test")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Idempotent re-delivery: calling twice makes the same two calls
  // twice. GHL's upsert dedupes the contact by email and the tags
  // endpoint no-ops on an existing tag, so nothing duplicates.
  it("re-delivery repeats identical idempotent calls", async () => {
    // A fresh Response per call: bodies are single-read streams.
    fetchMock.mockImplementation(async () => okResponse({ contact: { id: "c_1" } }));
    await pushContactToCrmSafe(input, "delivery 1");
    await pushContactToCrmSafe(input, "delivery 2");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const firstUpsert = (fetchMock.mock.calls[0]![1] as RequestInit).body;
    const secondUpsert = (fetchMock.mock.calls[2]![1] as RequestInit).body;
    expect(firstUpsert).toEqual(secondUpsert);
  });
});
