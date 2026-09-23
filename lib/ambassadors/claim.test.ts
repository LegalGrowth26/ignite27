import { describe, expect, it } from "vitest";
import { claimPageState, claimsRemaining, claimUrl, CLAIM_TOKEN_PATTERN } from "./claim";

const active = { comp_allowance: 2, deactivated_at: null };

describe("claimPageState", () => {
  it("shows the form while claims remain", () => {
    expect(claimPageState(active, 0)).toBe("form");
    expect(claimPageState(active, 1)).toBe("form");
  });

  it("cuts off hard at zero remaining", () => {
    expect(claimPageState(active, 2)).toBe("exhausted");
    expect(claimPageState(active, 3)).toBe("exhausted");
    expect(claimPageState({ comp_allowance: 0, deactivated_at: null }, 0)).toBe(
      "exhausted",
    );
  });

  it("a deactivated ambassador's link goes quiet, not exhausted", () => {
    expect(
      claimPageState({ comp_allowance: 2, deactivated_at: "2026-09-01" }, 0),
    ).toBe("unavailable");
  });
});

describe("claimsRemaining", () => {
  it("never goes negative", () => {
    expect(claimsRemaining(active, 5)).toBe(0);
    expect(claimsRemaining(active, 1)).toBe(1);
  });
});

describe("claimUrl", () => {
  it("builds the public URL without a double slash", () => {
    expect(claimUrl("https://ignite27.co.uk/", "abc")).toBe(
      "https://ignite27.co.uk/claim/abc",
    );
  });
});

describe("CLAIM_TOKEN_PATTERN", () => {
  it("accepts uuids and rejects junk", () => {
    expect(CLAIM_TOKEN_PATTERN.test("6f9619ff-8b86-d011-b42d-00c04fc964ff")).toBe(true);
    expect(CLAIM_TOKEN_PATTERN.test("not-a-token")).toBe(false);
    expect(CLAIM_TOKEN_PATTERN.test("")).toBe(false);
  });
});
