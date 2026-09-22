import { describe, expect, it } from "vitest";
import {
  parseStoredTakeaways,
  parseTakeaways,
  validateSpeakerContent,
} from "./profile";
import { validateContactMessage } from "./contact";

const valid = {
  displayName: "Stephine Robinson",
  bio: "Practical AI, minus the hype.",
  talkTitle: "Practical AI for small businesses",
  talkDescription: "A hands-on session.",
  talkTakeaways: "Ship one AI workflow\nSpot the snake oil",
  websiteUrl: "https://example.com",
  socialLinks: [{ platform: "linkedin", url: "https://linkedin.com/in/steph" }],
  ctaLabel: "Book a call",
  ctaUrl: "https://example.com/call",
  enquiriesEmail: "talks@example.com",
};

describe("validateSpeakerContent", () => {
  it("accepts a full profile and normalises empties to null", () => {
    const result = validateSpeakerContent({
      ...valid,
      websiteUrl: "",
      ctaLabel: "",
      ctaUrl: "",
      enquiriesEmail: " ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.websiteUrl).toBeNull();
    expect(result.value.ctaLabel).toBeNull();
    expect(result.value.enquiriesEmail).toBeNull();
    expect(result.value.talkTakeaways).toEqual([
      "Ship one AI workflow",
      "Spot the snake oil",
    ]);
  });

  it("rejects non-http URLs everywhere they can appear", () => {
    expect(validateSpeakerContent({ ...valid, websiteUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(
      validateSpeakerContent({
        ...valid,
        socialLinks: [{ platform: "x", url: "ftp://x.com/a" }],
      }).ok,
    ).toBe(false);
    expect(validateSpeakerContent({ ...valid, ctaUrl: "not-a-url" }).ok).toBe(false);
  });

  it("enforces the shared platform allow-list and one link per platform", () => {
    expect(
      validateSpeakerContent({
        ...valid,
        socialLinks: [{ platform: "myspace", url: "https://myspace.com/s" }],
      }).ok,
    ).toBe(false);
    expect(
      validateSpeakerContent({
        ...valid,
        socialLinks: [
          { platform: "x", url: "https://x.com/a" },
          { platform: "x", url: "https://x.com/b" },
        ],
      }).ok,
    ).toBe(false);
  });

  it("CTA needs label and URL together or neither; enquiries email validated when set", () => {
    expect(validateSpeakerContent({ ...valid, ctaUrl: "" }).ok).toBe(false);
    expect(validateSpeakerContent({ ...valid, enquiriesEmail: "nope" }).ok).toBe(false);
  });
});

describe("parseTakeaways", () => {
  it("splits lines, strips bullet markers, drops blanks", () => {
    expect(parseTakeaways("- One\n\n• Two\n* Three\n")).toEqual(["One", "Two", "Three"]);
  });

  it("caps at 6 bullets and 200 chars each", () => {
    expect(typeof parseTakeaways(Array(7).fill("a bullet").join("\n"))).toBe("string");
    expect(typeof parseTakeaways("x".repeat(201))).toBe("string");
  });
});

describe("parseStoredTakeaways", () => {
  it("tolerates bad shapes and trims", () => {
    expect(parseStoredTakeaways(null)).toEqual([]);
    expect(parseStoredTakeaways(["  a ", 3, "", "b"])).toEqual(["a", "b"]);
  });
});

describe("validateContactMessage", () => {
  const message = {
    senderName: "Ada Lovelace",
    senderEmail: "ada@example.com",
    message: "I would love a word about your talk.",
    company: "",
  };

  it("accepts a clean message with the honeypot empty", () => {
    const result = validateContactMessage(message);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.honeypotTripped).toBe(false);
  });

  it("flags a filled honeypot while still validating (silent drop upstream)", () => {
    const result = validateContactMessage({ ...message, company: "Bots R Us" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.honeypotTripped).toBe(true);
  });

  it("requires name, valid email, and a non-trivial message", () => {
    expect(validateContactMessage({ ...message, senderName: "" }).ok).toBe(false);
    expect(validateContactMessage({ ...message, senderEmail: "nope" }).ok).toBe(false);
    expect(validateContactMessage({ ...message, message: "hi" }).ok).toBe(false);
    expect(validateContactMessage({ ...message, message: "x".repeat(2001) }).ok).toBe(false);
  });
});
