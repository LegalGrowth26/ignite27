import { describe, expect, it } from "vitest";
import {
  exhibitorIntentToMetadata,
  ExhibitorMetadataParseError,
  metadataToParsedExhibitor,
  validateExhibitorBookingIntent,
  type ExhibitorPricingSnapshot,
} from "./exhibitor-intent";

const validAttendee1 = {
  firstName: "Ada",
  surname: "Lovelace",
  email: "ada@example.com",
  mobile: "07700900000",
  jobTitle: "Founder",
  dietaryRequirement: "vegetarian",
  dietaryOther: "",
};

const validAttendee2 = {
  firstName: "Charles",
  surname: "Babbage",
  email: "charles@example.com",
  mobile: "",
  jobTitle: "Engineer",
  dietaryRequirement: "none",
  dietaryOther: "",
};

const validInput = {
  company: "Analytical Engines Ltd",
  website: "https://analyticalengines.example.com",
  contactFirstName: "Ada",
  contactSurname: "Lovelace",
  contactEmail: "ada@example.com",
  contactMobile: "07700900000",
  attendee1: validAttendee1,
  attendee2: validAttendee2,
  marketingOptIn: false,
  termsAccepted: true,
};

describe("validateExhibitorBookingIntent", () => {
  it("accepts a well-formed booking", () => {
    const result = validateExhibitorBookingIntent(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.company).toBe("Analytical Engines Ltd");
    expect(result.intent.attendees).toHaveLength(2);
    expect(result.intent.attendees[0].email).toBe("ada@example.com");
  });

  it("lowercases contact and attendee emails", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      contactEmail: "ADA@Example.COM",
      attendee2: { ...validAttendee2, email: "Charles@EXAMPLE.com" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.contactEmail).toBe("ada@example.com");
    expect(result.intent.attendees[1].email).toBe("charles@example.com");
  });

  it("rejects a missing company name", () => {
    const result = validateExhibitorBookingIntent({ ...validInput, company: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "company")).toBe(true);
  });

  it("website is optional but validated when present", () => {
    const empty = validateExhibitorBookingIntent({ ...validInput, website: "" });
    expect(empty.ok).toBe(true);

    const bad = validateExhibitorBookingIntent({ ...validInput, website: "not-a-url" });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.some((e) => e.field === "website")).toBe(true);
  });

  it("rejects a missing contact mobile", () => {
    const result = validateExhibitorBookingIntent({ ...validInput, contactMobile: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "contactMobile")).toBe(true);
  });

  it("requires both attendees fully named with emails and job titles", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee2: { ...validAttendee2, firstName: "", email: "nope", jobTitle: "" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("attendee2.firstName");
    expect(fields).toContain("attendee2.email");
    expect(fields).toContain("attendee2.jobTitle");
  });

  it("attendee mobile is optional", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee1: { ...validAttendee1, mobile: "" },
    });
    expect(result.ok).toBe(true);
  });

  // Exhibitor bookings always include 2 lunches, so dietary is always
  // validated for both attendees; there is no hidden-field strip branch.
  it("dietary is always validated, invalid values reject", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee2: { ...validAttendee2, dietaryRequirement: "platinum-banquet" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "attendee2.dietaryRequirement")).toBe(true);
  });

  it("dietary 'other' requires the note, per attendee", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee1: { ...validAttendee1, dietaryRequirement: "other", dietaryOther: "" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "attendee1.dietaryOther")).toBe(true);
  });

  it("strips dietaryOther when the requirement is not 'other'", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee1: { ...validAttendee1, dietaryRequirement: "vegan", dietaryOther: "wipe me" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.attendees[0].dietaryOther).toBe("");
  });

  it("rejects unchecked terms", () => {
    const result = validateExhibitorBookingIntent({ ...validInput, termsAccepted: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "termsAccepted")).toBe(true);
  });

  it("returns form-level error on non-object input", () => {
    const result = validateExhibitorBookingIntent("not an object");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.field).toBe("form");
  });

  it("tolerates missing attendee objects with field errors, not a crash", () => {
    const result = validateExhibitorBookingIntent({
      ...validInput,
      attendee1: undefined,
      attendee2: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "attendee1.firstName")).toBe(true);
    expect(result.errors.some((e) => e.field === "attendee2.firstName")).toBe(true);
  });
});

describe("exhibitor metadata round-trip", () => {
  const pricing: ExhibitorPricingSnapshot = {
    period: "launch",
    standExVatPence: 18900,
    standVatPence: 3780,
    standIncVatPence: 22680,
    grossExVatPence: 18900,
    grossVatPence: 3780,
    grossIncVatPence: 22680,
  };

  it("round-trips a valid intent through Stripe-style metadata", () => {
    const result = validateExhibitorBookingIntent(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metadata = exhibitorIntentToMetadata(
      result.intent,
      pricing,
      "I27-ABCDEFG",
      "2026-08-05T12:00:00.000Z",
      "10.0.0.1",
    );

    // Stripe's hard limit is 50 keys; this shape must stay under it.
    expect(Object.keys(metadata).length).toBeLessThanOrEqual(50);

    const parsed = metadataToParsedExhibitor(metadata as Record<string, string>);
    expect(parsed.bookingReference).toBe("I27-ABCDEFG");
    expect(parsed.termsAcceptedAt).toBe("2026-08-05T12:00:00.000Z");
    expect(parsed.termsAcceptedIp).toBe("10.0.0.1");
    expect(parsed.intent.company).toBe(result.intent.company);
    expect(parsed.intent.contactEmail).toBe(result.intent.contactEmail);
    expect(parsed.intent.attendees[0]).toEqual(result.intent.attendees[0]);
    expect(parsed.intent.attendees[1]).toEqual(result.intent.attendees[1]);
    expect(parsed.pricing).toEqual(pricing);
  });

  it("throws when booking_type is not exhibitor", () => {
    expect(() => metadataToParsedExhibitor({ booking_type: "delegate" })).toThrow(
      ExhibitorMetadataParseError,
    );
  });

  it("throws on missing fields", () => {
    expect(() => metadataToParsedExhibitor({ booking_type: "exhibitor" })).toThrow(
      ExhibitorMetadataParseError,
    );
  });
});
