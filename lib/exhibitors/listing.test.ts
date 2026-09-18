import { describe, expect, it } from "vitest";
import {
  attendeeFallbacks,
  isLivePaidSession,
  resolveExhibitorDisplayName,
} from "./listing";

// The bookings-derived listing rule (buildExhibitorListing) is gone:
// exhibitor_profiles is the single public source now, and its creation
// gate is tested in create-profile.test.ts. What stays here are the
// helpers the admin page, backfill, and editor self-heal still share.

describe("resolveExhibitorDisplayName", () => {
  it("prefers the submitted signage name over the checkout company name", () => {
    expect(
      resolveExhibitorDisplayName({
        signageName: "Analytical Engines",
        companyName: "Analytical Engines Ltd",
        attendeeCompany: null,
        contactName: null,
      }),
    ).toBe("Analytical Engines");
  });

  // Regression: three real paid live bookings predate the webhook
  // populating company_name and have no requirements row. They must
  // still resolve via the attendee/contact fallbacks, not vanish.
  it("falls back company -> attendee company -> contact name", () => {
    expect(
      resolveExhibitorDisplayName({
        signageName: null,
        companyName: null,
        attendeeCompany: "Fallback Widgets Ltd",
        contactName: "Ada Lovelace",
      }),
    ).toBe("Fallback Widgets Ltd");
    expect(
      resolveExhibitorDisplayName({
        signageName: null,
        companyName: null,
        attendeeCompany: null,
        contactName: "Ada Lovelace",
      }),
    ).toBe("Ada Lovelace");
  });

  it("returns an empty string when no usable name exists anywhere", () => {
    expect(
      resolveExhibitorDisplayName({
        signageName: "  ",
        companyName: null,
        attendeeCompany: null,
        contactName: null,
      }),
    ).toBe("");
  });
});

describe("attendeeFallbacks", () => {
  it("uses the first attendee by index", () => {
    expect(
      attendeeFallbacks([
        { first_name: "Grace", surname: "Hopper", company: "Second Co", attendee_index: 2 },
        { first_name: "Ada", surname: "Lovelace", company: "First Co", attendee_index: 1 },
      ]),
    ).toEqual({ attendeeCompany: "First Co", attendeeName: "Ada Lovelace" });
  });

  it("never turns a TBC placeholder into a display name", () => {
    expect(
      attendeeFallbacks([
        { first_name: "TBC", surname: "", company: null, attendee_index: 1 },
      ]),
    ).toEqual({ attendeeCompany: null, attendeeName: null });
  });

  it("handles no attendees", () => {
    expect(attendeeFallbacks([])).toEqual({ attendeeCompany: null, attendeeName: null });
  });
});

describe("isLivePaidSession", () => {
  it("accepts live session ids only", () => {
    expect(isLivePaidSession("cs_live_abc")).toBe(true);
    expect(isLivePaidSession("cs_test_abc")).toBe(false);
    expect(isLivePaidSession(null)).toBe(false);
    expect(isLivePaidSession("")).toBe(false);
  });
});
