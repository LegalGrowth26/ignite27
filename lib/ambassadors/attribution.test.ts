import { describe, expect, it } from "vitest";
import {
  ambassadorShareUrl,
  isValidRefSlug,
  normaliseRefSlug,
} from "./attribution";

describe("normaliseRefSlug", () => {
  it("accepts clean slugs", () => {
    expect(normaliseRefSlug("stephine")).toBe("stephine");
    expect(normaliseRefSlug("impact-2027")).toBe("impact-2027");
  });

  it("normalises case and whitespace", () => {
    expect(normaliseRefSlug(" Stephine ")).toBe("stephine");
    expect(normaliseRefSlug("IMPACT")).toBe("impact");
  });

  it("rejects garbage without throwing", () => {
    expect(normaliseRefSlug("")).toBeNull();
    expect(normaliseRefSlug("a")).toBeNull(); // too short
    expect(normaliseRefSlug("-leading-hyphen")).toBeNull();
    expect(normaliseRefSlug("has spaces")).toBeNull();
    expect(normaliseRefSlug("semi;colon")).toBeNull();
    expect(normaliseRefSlug("x".repeat(31))).toBeNull();
    expect(normaliseRefSlug(null)).toBeNull();
    expect(normaliseRefSlug(42)).toBeNull();
    expect(normaliseRefSlug(["stephine"])).toBeNull();
  });
});

describe("isValidRefSlug", () => {
  it("matches the migration's slug check", () => {
    expect(isValidRefSlug("stephine")).toBe(true);
    expect(isValidRefSlug("Stephine")).toBe(false); // no uppercase
    expect(isValidRefSlug("st")).toBe(true); // 2 chars minimum
  });
});

describe("ambassadorShareUrl", () => {
  it("builds the public link, tolerating a trailing slash on the site url", () => {
    expect(ambassadorShareUrl("https://www.ignite27.co.uk/", "stephine")).toBe(
      "https://www.ignite27.co.uk/?ref=stephine",
    );
    expect(ambassadorShareUrl("https://www.ignite27.co.uk", "impact")).toBe(
      "https://www.ignite27.co.uk/?ref=impact",
    );
  });
});
