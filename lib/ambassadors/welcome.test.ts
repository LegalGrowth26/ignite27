import { describe, expect, it } from "vitest";
import { compTicketsLine, discountLines, formatUkDate } from "./welcome";

describe("compTicketsLine", () => {
  it("omits the block entirely at zero allowance", () => {
    expect(compTicketsLine(0)).toBeNull();
    expect(compTicketsLine(-1)).toBeNull();
  });

  it("reads naturally in singular and plural", () => {
    expect(compTicketsLine(1)).toContain("1 complimentary ticket to give away");
    expect(compTicketsLine(1)).not.toContain("tickets to give away");
    expect(compTicketsLine(3)).toContain("3 complimentary tickets to give away");
  });
});

describe("discountLines", () => {
  const base = { code: "STEPHINE20", percentOff: 20 };

  it("omits the block entirely with no code", () => {
    expect(discountLines(null)).toBeNull();
  });

  it("states code and percent, then the limits that exist", () => {
    expect(
      discountLines({ ...base, limits: { maxRedemptions: 50, expiresAt: null } }),
    ).toEqual([
      "Your discount code is STEPHINE20. It takes 20% off for anyone who uses it at checkout.",
      "It can be used up to 50 times.",
    ]);
    expect(
      discountLines({
        ...base,
        limits: { maxRedemptions: null, expiresAt: new Date("2026-12-31T00:00:00Z") },
      })![1],
    ).toBe("It is valid until 31 December 2026.");
    expect(
      discountLines({
        ...base,
        limits: { maxRedemptions: 50, expiresAt: new Date("2026-12-31T00:00:00Z") },
      })![1],
    ).toBe("It can be used up to 50 times and is valid until 31 December 2026.");
  });

  it("says 'no limit' only when Stripe confirmed there are none", () => {
    expect(
      discountLines({ ...base, limits: { maxRedemptions: null, expiresAt: null } })![1],
    ).toBe("There is no limit on how many people can use it.");
    // Unknown limits (lookup failed): claim nothing.
    expect(discountLines({ ...base, limits: null })).toHaveLength(1);
  });
});

describe("formatUkDate", () => {
  it("formats UK-style long dates", () => {
    expect(formatUkDate(new Date("2027-01-21T12:00:00Z"))).toBe("21 January 2027");
  });
});
