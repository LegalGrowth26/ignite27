import { describe, expect, it } from "vitest";
import { provisionDecision, syncedAllowance } from "./provision";

describe("provisionDecision", () => {
  it("a row this partner owns syncs", () => {
    expect(
      provisionDecision({ ownRow: { id: "a1" }, otherRow: null }),
    ).toBe("sync");
  });

  it("NO TRAMPLE: an unrelated existing row on the contact is left alone", () => {
    expect(
      provisionDecision({ ownRow: null, otherRow: { slug: "dan-ince" } }),
    ).toBe("no_trample");
  });

  it("nothing existing creates fresh", () => {
    expect(provisionDecision({ ownRow: null, otherRow: null })).toBe("create");
  });

  it("owning a row wins even if the contact somehow has another", () => {
    // Defensive: the unique(partner_id) index makes this the only
    // sane reading if data ever got strange.
    expect(
      provisionDecision({ ownRow: { id: "a1" }, otherRow: { slug: "x" } }),
    ).toBe("sync");
  });
});

describe("syncedAllowance", () => {
  it("never goes below guest tickets already used", () => {
    expect(syncedAllowance(1, 3)).toEqual({ allowance: 3, clampedTo: 3 });
  });

  it("moves freely above the spent count", () => {
    expect(syncedAllowance(5, 2)).toEqual({ allowance: 5, clampedTo: null });
    expect(syncedAllowance(2, 2)).toEqual({ allowance: 2, clampedTo: null });
  });
});
