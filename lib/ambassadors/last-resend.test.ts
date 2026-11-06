import { describe, expect, it } from "vitest";
import { formatResendDate, latestResendByAmbassador } from "./last-resend";

describe("latestResendByAmbassador", () => {
  it("keeps the latest timestamp per ambassador", () => {
    const map = latestResendByAmbassador([
      { created_at: "2026-10-22T10:00:00Z", detail: { ambassador_id: "a" } },
      { created_at: "2026-10-01T09:00:00Z", detail: { ambassador_id: "a" } },
      { created_at: "2026-09-15T08:00:00Z", detail: { ambassador_id: "b" } },
    ]);
    expect(map.get("a")).toBe("2026-10-22T10:00:00Z");
    expect(map.get("b")).toBe("2026-09-15T08:00:00Z");
  });

  it("resolves out-of-order rows to the latest, not the first", () => {
    const map = latestResendByAmbassador([
      { created_at: "2026-10-01T09:00:00Z", detail: { ambassador_id: "a" } },
      { created_at: "2026-10-22T10:00:00Z", detail: { ambassador_id: "a" } },
    ]);
    expect(map.get("a")).toBe("2026-10-22T10:00:00Z");
  });

  it("skips rows whose detail carries no ambassador_id", () => {
    const map = latestResendByAmbassador([
      { created_at: "2026-10-22T10:00:00Z", detail: {} },
      { created_at: "2026-10-22T10:00:00Z", detail: null },
      { created_at: "2026-10-22T10:00:00Z", detail: { ambassador_id: 7 } },
    ]);
    expect(map.size).toBe(0);
  });
});

describe("formatResendDate", () => {
  const now = new Date("2026-11-06T12:00:00Z");

  it("renders day and short month for the current year", () => {
    expect(formatResendDate("2026-10-22T10:00:00Z", now)).toBe("22 Oct");
  });

  it("adds the year when it differs from the current one", () => {
    expect(formatResendDate("2025-12-30T10:00:00Z", now)).toBe("30 Dec 2025");
  });

  it("uses the UK date even when UTC has already rolled over", () => {
    // 23:30 UTC on 21 June is 00:30 BST on the 22nd.
    expect(formatResendDate("2026-06-21T23:30:00Z", now)).toBe("22 Jun");
  });

  it("returns empty for an unparseable timestamp", () => {
    expect(formatResendDate("not-a-date", now)).toBe("");
  });
});
