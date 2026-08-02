import { describe, expect, it } from "vitest";
import {
  bookingIncludesLunch,
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

  it("VIP: rejects malformed badge QR URL but accepts empty", () => {
    const bad = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "vip",
      badgeQrUrl: "not-a-url",
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.some((e) => e.field === "badgeQrUrl")).toBe(true);

    const empty = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "vip",
      badgeQrUrl: "",
    });
    expect(empty.ok).toBe(true);
  });

  it("VIP: keeps a well-formed badge QR URL", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "vip",
      badgeQrUrl: "https://www.linkedin.com/in/ada",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.badgeQrUrl).toBe("https://www.linkedin.com/in/ada");
  });

  it("non-VIP: badge QR is a VIP-only perk, value is stripped (never stored, never an error)", () => {
    // The field does not render for non-VIP tickets, so a value here is
    // form tampering. It must be silently dropped, valid or not.
    const tamperedValid = validateDelegateBookingIntent({
      ...validRegularInput,
      badgeQrUrl: "https://example.com/me",
    });
    expect(tamperedValid.ok).toBe(true);
    if (!tamperedValid.ok) return;
    expect(tamperedValid.intent.badgeQrUrl).toBe("");

    const tamperedMalformed = validateDelegateBookingIntent({
      ...validRegularInput,
      badgeQrUrl: "not-a-url",
    });
    expect(tamperedMalformed.ok).toBe(true);
    if (!tamperedMalformed.ok) return;
    expect(tamperedMalformed.intent.badgeQrUrl).toBe("");
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

// The show/hide rule shared by the booking form and server validation.
// The form renders the dietary field exactly when this returns true, so
// covering every branch here covers the toggle behaviour.
describe("bookingIncludesLunch (dietary field visibility rule)", () => {
  it("Regular without the lunch add-on: no lunch, no dietary field", () => {
    expect(bookingIncludesLunch("regular", false)).toBe(false);
  });

  it("Regular with the lunch add-on ticked: dietary field appears", () => {
    expect(bookingIncludesLunch("regular", true)).toBe(true);
  });

  it("VIP: always shows dietary (lunch included), whatever the flag says", () => {
    expect(bookingIncludesLunch("vip", true)).toBe(true);
    expect(bookingIncludesLunch("vip", false)).toBe(true);
  });
});

describe("dietary is stripped on no-lunch bookings (tampering guard)", () => {
  it("Regular without lunch: submitted dietary values are silently dropped", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      lunchIncluded: false,
      dietaryRequirement: "vegan",
      dietaryOther: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.dietaryRequirement).toBe("none");
    expect(result.intent.dietaryOther).toBe("");
  });

  it("Regular without lunch: even garbage dietary values never error", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      lunchIncluded: false,
      dietaryRequirement: "platinum-banquet",
      dietaryOther: "x".repeat(500),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.dietaryRequirement).toBe("none");
    expect(result.intent.dietaryOther).toBe("");
  });

  it("Regular WITH lunch: dietary is validated and kept", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      lunchIncluded: true,
      dietaryRequirement: "gluten_free",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.dietaryRequirement).toBe("gluten_free");
  });

  it("Regular WITH lunch: invalid dietary still rejects", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      lunchIncluded: true,
      dietaryRequirement: "not-a-real-option",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "dietaryRequirement")).toBe(true);
  });

  it("VIP: dietary always validated even if the lunch flag was tampered to false", () => {
    const result = validateDelegateBookingIntent({
      ...validRegularInput,
      ticketType: "vip",
      lunchIncluded: false,
      dietaryRequirement: "nut_allergy",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.lunchIncluded).toBe(true);
    expect(result.intent.dietaryRequirement).toBe("nut_allergy");
  });
});

describe("intent metadata round-trip", () => {
  const pricing: DelegatePricingSnapshot = {
    period: "standard",
    ticketExVatPence: 3500,
    ticketVatPence: 700,
    ticketIncVatPence: 4200,
    lunchExVatPence: 1250,
    lunchVatPence: 250,
    lunchIncVatPence: 1500,
    grossExVatPence: 4750,
    grossVatPence: 950,
    grossIncVatPence: 5700,
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
    expect(parsed.pricing.ticketIncVatPence).toBe(4200);
    expect(parsed.pricing.grossIncVatPence).toBe(5700);
    expect(parsed.pricing.period).toBe("standard");
  });

  it("throws MetadataParseError when booking_type is not delegate", () => {
    expect(() => metadataToParsed({ booking_type: "exhibitor" })).toThrow(MetadataParseError);
  });

  it("throws MetadataParseError on missing fields", () => {
    expect(() => metadataToParsed({ booking_type: "delegate" })).toThrow(MetadataParseError);
  });
});
