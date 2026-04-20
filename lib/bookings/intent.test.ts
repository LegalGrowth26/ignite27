import { describe, expect, it } from "vitest";
import {
  intentToMetadata,
  metadataToParsed,
  MetadataParseError,
  validateDelegateBookingIntent,
  type DelegatePricingSnapshot,
} from "./intent";

const validRegularInput = {
  ticketType: "regular",
  lunchIncluded: true,
  firstName: "Ada",
  surname: "Lovelace",
  email: "ada@example.com",
  mobile: "07700900000",
  company: "Analytical Engines Ltd",
  jobTitle: "Mathematician",
  dietaryRequirement: "vegetarian",
  dietaryOther: "",
  badgeQrUrl: "",
  marketingOptIn: false,
  termsAccepted: true,
};

describe("validateDelegateBookingIntent", () => {
  it("accepts a well-formed regular booking", () => {
    const result = validateDelegateBookingIntent(validRegularInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.ticketType).toBe("regular");
    expect(result.intent.lunchIncluded).toBe(true);
    expect(result.intent.email).toBe("ada@example.com");
  });

  it("lowercases email", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      email: "ADA@Example.COM",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.email).toBe("ada@example.com");
  });

  it("forces lunchIncluded=true on VIP regardless of input flag", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "vip",
      lunchIncluded: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.lunchIncluded).toBe(true);
  });

  it("rejects missing first name", () => {
    const result = validateDelegateBookingIntent({ ...validRegularInput, firstName: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
  });

  it("rejects unchecked terms", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      termsAccepted: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "termsAccepted")).toBe(true);
  });

  it("requires dietaryOther when dietaryRequirement is other", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      dietaryRequirement: "other",
      dietaryOther: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "dietaryOther")).toBe(true);
  });

  it("strips dietaryOther when not other", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      dietaryRequirement: "vegan",
      dietaryOther: "should be wiped",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.dietaryOther).toBe("");
  });

  it("rejects malformed badge QR URL but accepts empty", () => {
    const bad = validateDelegateBookingIntent({
      ...validRegularInput,
      badgeQrUrl: "not-a-url",
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.some((e) => e.field === "badgeQrUrl")).toBe(true);

    const empty = validateDelegateBookingIntent({
      ...validRegularInput,
      badgeQrUrl: "",
    });
    expect(empty.ok).toBe(true);
  });

  it("rejects unknown ticket type", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "platinum",
    });
    expect(result.ok).toBe(false);
  });

  it("returns form-level error on non-object input", () => {
    const result = validateDelegateBookingIntent("not an object");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.field).toBe("form");
  });
});

describe("intent metadata round-trip", () => {
  const pricing: DelegatePricingSnapshot = {
    window: "window_2",
    ticketPricePence: 4900,
    lunchPricePence: 1500,
    charityUpliftPence: 0,
    grossAmountPence: 6400,
  };

  it("round-trips a valid intent through Stripe-style metadata", () => {
    const result = validateDelegateBookingIntent(validRegularInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metadata = intentToMetadata(
      result.intent,
      pricing,
      "I27-ABCDEFG",
      "2026-07-10T12:00:00.000Z",
      "10.0.0.1",
    );
    const parsed = metadataToParsed(metadata as unknown as Record<string, string>);

    expect(parsed.bookingReference).toBe("I27-ABCDEFG");
    expect(parsed.termsAcceptedAt).toBe("2026-07-10T12:00:00.000Z");
    expect(parsed.termsAcceptedIp).toBe("10.0.0.1");
    expect(parsed.intent.email).toBe(result.intent.email);
    expect(parsed.intent.lunchIncluded).toBe(result.intent.lunchIncluded);
    expect(parsed.intent.marketingOptIn).toBe(result.intent.marketingOptIn);
    expect(parsed.pricing.ticketPricePence).toBe(4900);
    expect(parsed.pricing.grossAmountPence).toBe(6400);
  });

  it("throws MetadataParseError when booking_type is not delegate", () => {
    expect(() => metadataToParsed({ booking_type: "exhibitor" })).toThrow(MetadataParseError);
  });

  it("throws MetadataParseError on missing fields", () => {
    expect(() => metadataToParsed({ booking_type: "delegate" })).toThrow(MetadataParseError);
  });
});
