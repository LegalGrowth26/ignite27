import { describe, expect, it } from "vitest";
import {
  buildExhibitorListing,
  isLivePaidSession,
  type ExhibitorListingSourceRow,
} from "./listing";

function row(overrides: Partial<ExhibitorListingSourceRow>): ExhibitorListingSourceRow {
  return {
    bookingId: "b-1",
    companyName: "Analytical Engines Ltd",
    signageName: null,
    websiteUrl: null,
    logoPath: null,
    paymentStatus: "paid",
    bookingStatus: "active",
    stripeCheckoutSessionId: "cs_live_abc123",
    listingHiddenAt: null,
    ...overrides,
  };
}

describe("buildExhibitorListing", () => {
  it("paid, no logo or website: listed on company name alone", () => {
    const entries = buildExhibitorListing([row({})]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      bookingId: "b-1",
      displayName: "Analytical Engines Ltd",
      websiteUrl: null,
      logoPath: null,
    });
  });

  it("paid with logo and website: listed with both, no admin action involved", () => {
    const entries = buildExhibitorListing([
      row({
        logoPath: "b-1/logo.png",
        websiteUrl: "https://analyticalengines.example.com",
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.logoPath).toBe("b-1/logo.png");
    expect(entries[0]!.websiteUrl).toBe("https://analyticalengines.example.com");
  });

  it("hidden by an admin: excluded, even though paid and live", () => {
    const entries = buildExhibitorListing([
      row({ listingHiddenAt: "2026-08-08T10:00:00Z" }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it("unpaid / abandoned checkout: excluded", () => {
    expect(buildExhibitorListing([row({ paymentStatus: "pending" })])).toHaveLength(0);
    expect(buildExhibitorListing([row({ paymentStatus: "failed" })])).toHaveLength(0);
    expect(buildExhibitorListing([row({ paymentStatus: "refunded" })])).toHaveLength(0);
  });

  it("test-mode Stripe rows can never appear", () => {
    expect(
      buildExhibitorListing([row({ stripeCheckoutSessionId: "cs_test_abc123" })]),
    ).toHaveLength(0);
    expect(buildExhibitorListing([row({ stripeCheckoutSessionId: null })])).toHaveLength(0);
  });

  it("comp bookings are excluded: no payment happened", () => {
    // Deliberate under the "successful live payment" rule; flagged in
    // the PR so a comped stand can be added to the rule if wanted.
    expect(buildExhibitorListing([row({ paymentStatus: "comp" })])).toHaveLength(0);
  });

  it("cancelled bookings drop off the listing", () => {
    expect(buildExhibitorListing([row({ bookingStatus: "cancelled" })])).toHaveLength(0);
  });

  it("prefers the submitted signage name over the checkout company name", () => {
    const entries = buildExhibitorListing([
      row({ companyName: "Analytical Engines Ltd", signageName: "Analytical Engines" }),
    ]);
    expect(entries[0]!.displayName).toBe("Analytical Engines");
  });

  it("never lists a row with no usable name", () => {
    expect(
      buildExhibitorListing([row({ companyName: null, signageName: "  " })]),
    ).toHaveLength(0);
  });

  it("sorts alphabetically by display name", () => {
    const entries = buildExhibitorListing([
      row({ bookingId: "b-2", companyName: "Zebra Print Co" }),
      row({ bookingId: "b-3", companyName: "Acme Widgets" }),
      row({ bookingId: "b-1" }),
    ]);
    expect(entries.map((e) => e.displayName)).toEqual([
      "Acme Widgets",
      "Analytical Engines Ltd",
      "Zebra Print Co",
    ]);
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
