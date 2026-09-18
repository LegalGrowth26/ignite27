import { describe, expect, it } from "vitest";
import {
  pickAvailableSlug,
  slugifyCompany,
  validateProfileContent,
} from "./profile";

const valid = {
  displayName: "Impact Marketing",
  description: "We do marketing that lands.",
  websiteUrl: "https://impact.example.com",
  socialLinks: [{ platform: "linkedin", url: "https://linkedin.com/company/impact" }],
  ctaPrimaryLabel: "Book a call",
  ctaPrimaryUrl: "https://impact.example.com/call",
  ctaSecondaryLabel: "",
  ctaSecondaryUrl: "",
  showContactEmail: true,
  contactEmail: "hello@impact.example.com",
};

describe("validateProfileContent", () => {
  it("accepts a full profile and normalises empties to null", () => {
    const result = validateProfileContent({ ...valid, description: "", websiteUrl: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.description).toBeNull();
    expect(result.value.websiteUrl).toBeNull();
    expect(result.value.ctaSecondaryLabel).toBeNull();
  });

  it("caps description at 2000 characters", () => {
    expect(validateProfileContent({ ...valid, description: "x".repeat(2001) }).ok).toBe(false);
    expect(validateProfileContent({ ...valid, description: "x".repeat(2000) }).ok).toBe(true);
  });

  it("rejects non-http URLs everywhere they can appear", () => {
    expect(validateProfileContent({ ...valid, websiteUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(
      validateProfileContent({
        ...valid,
        socialLinks: [{ platform: "x", url: "not-a-url" }],
      }).ok,
    ).toBe(false);
    expect(
      validateProfileContent({ ...valid, ctaPrimaryUrl: "ftp://files.example.com" }).ok,
    ).toBe(false);
  });

  it("enforces the social platform allow-list and one link per platform", () => {
    expect(
      validateProfileContent({
        ...valid,
        socialLinks: [{ platform: "myspace", url: "https://myspace.com/impact" }],
      }).ok,
    ).toBe(false);
    expect(
      validateProfileContent({
        ...valid,
        socialLinks: [
          { platform: "linkedin", url: "https://linkedin.com/a" },
          { platform: "linkedin", url: "https://linkedin.com/b" },
        ],
      }).ok,
    ).toBe(false);
    // Empty URL slots are skipped, not errors (the form renders six
    // fixed inputs).
    const result = validateProfileContent({
      ...valid,
      socialLinks: [{ platform: "tiktok", url: "" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.socialLinks).toEqual([]);
  });

  it("CTA slots need label and URL together or neither", () => {
    expect(
      validateProfileContent({ ...valid, ctaSecondaryLabel: "See prices" }).ok,
    ).toBe(false);
    expect(
      validateProfileContent({
        ...valid,
        ctaSecondaryLabel: "See prices",
        ctaSecondaryUrl: "https://impact.example.com/prices",
      }).ok,
    ).toBe(true);
  });

  it("showing the contact email requires a valid one", () => {
    expect(
      validateProfileContent({ ...valid, showContactEmail: true, contactEmail: "nope" }).ok,
    ).toBe(false);
    expect(
      validateProfileContent({ ...valid, showContactEmail: false, contactEmail: "" }).ok,
    ).toBe(true);
  });
});

describe("slugifyCompany", () => {
  it("produces clean lowercase slugs", () => {
    expect(slugifyCompany("Impact Marketing Ltd.")).toBe("impact-marketing-ltd");
    expect(slugifyCompany("Smith & Jones")).toBe("smith-and-jones");
    expect(slugifyCompany("  Café Crème  ")).toBe("cafe-creme");
  });

  it("never returns an empty or too-short slug", () => {
    expect(slugifyCompany("!!!")).toBe("exhibitor");
    expect(slugifyCompany("A")).toBe("exhibitor");
  });
});

describe("pickAvailableSlug", () => {
  it("returns the base when free, suffixes when taken", () => {
    expect(pickAvailableSlug("impact", new Set())).toBe("impact");
    expect(pickAvailableSlug("impact", new Set(["impact"]))).toBe("impact-2");
    expect(pickAvailableSlug("impact", new Set(["impact", "impact-2"]))).toBe("impact-3");
  });
});
