import { describe, expect, it } from "vitest";
import {
  ambassadorSlugFromProfileSlug,
  HOST_COMP_ALLOWANCE,
  HOST_DISCOUNT_PERCENT,
  hostDiscountCode,
} from "./host-invite";

describe("host invite defaults", () => {
  it("carries the confirmed numbers: 2 comps, 20 percent", () => {
    expect(HOST_COMP_ALLOWANCE).toBe(2);
    expect(HOST_DISCOUNT_PERCENT).toBe(20);
  });
});

describe("hostDiscountCode", () => {
  it("builds an uppercase alphanumeric code from the slug", () => {
    expect(hostDiscountCode("dan-ince")).toBe("DANINCE20");
    expect(hostDiscountCode("scott-linfoot")).toBe("SCOTTLINFOOT20");
  });

  it("caps very long slugs and survives degenerate input", () => {
    expect(hostDiscountCode("a".repeat(50))).toBe("A".repeat(18) + "20");
    expect(hostDiscountCode("---")).toBe("HOST20");
  });
});

describe("ambassadorSlugFromProfileSlug", () => {
  it("passes short slugs through and truncates long ones to 30", () => {
    expect(ambassadorSlugFromProfileSlug("dan-ince", new Set())).toBe("dan-ince");
    const long = "a-very-long-company-name-slug-indeed-truly";
    const result = ambassadorSlugFromProfileSlug(long, new Set());
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("-")).toBe(false);
  });

  it("uniquifies against taken ambassador slugs within the 30 cap", () => {
    expect(ambassadorSlugFromProfileSlug("dan-ince", new Set(["dan-ince"]))).toBe(
      "dan-ince-2",
    );
    const long = "a".repeat(30);
    const bumped = ambassadorSlugFromProfileSlug(long, new Set([long]));
    expect(bumped.length).toBeLessThanOrEqual(30);
    expect(bumped.endsWith("-2")).toBe(true);
  });
});
