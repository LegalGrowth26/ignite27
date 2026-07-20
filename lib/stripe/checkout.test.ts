import { fromZonedTime } from "date-fns-tz";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DelegateBookingIntent } from "@/lib/bookings/intent";
import {
  BookingsClosedForCheckoutError,
  BookingsNotOpenForCheckoutError,
  computeDelegatePricing,
  createDelegateCheckoutSession,
} from "./checkout";

const TZ = "Europe/London";
const uk = (iso: string) => fromZonedTime(iso, TZ);

const validIntent: DelegateBookingIntent = {
  ticketType: "regular",
  lunchIncluded: true,
  firstName: "Ada",
  surname: "Lovelace",
  email: "ada@example.com",
  mobile: "07700900000",
  company: "Analytical Engines Ltd",
  jobTitle: "Mathematician",
  dietaryRequirement: "none",
  dietaryOther: "",
  badgeQrUrl: "",
  marketingOptIn: false,
  termsAccepted: true,
};

const vipIntent: DelegateBookingIntent = {
  ...validIntent,
  ticketType: "vip",
  lunchIncluded: true,
};

// Pricing-v2 checkpoint dates for the launch / standard / late periods.
// Launch:   Sat 1 Aug 2026 09:00 UK → Tue 4 Aug 2026 09:00 UK
// Standard: Tue 4 Aug 2026 09:00 UK → Thu 1 Jan 2027 00:00 UK
// Late:     Fri 1 Jan 2027 00:00 UK → Mon 18 Jan 2027 17:00 UK
const IN_LAUNCH    = uk("2026-08-02T10:00:00");
const IN_STANDARD  = uk("2026-10-01T12:00:00");
const IN_LATE      = uk("2027-01-10T12:00:00");
const BEFORE_OPEN  = uk("2026-06-29T00:00:00");
const AFTER_CLOSE  = uk("2027-01-19T00:00:00");

describe("computeDelegatePricing", () => {
  it("regular without lunch in launch period (£25 + VAT)", () => {
    const p = computeDelegatePricing(
      { ...validIntent, lunchIncluded: false },
      IN_LAUNCH,
    );
    expect(p.period).toBe("launch");
    expect(p.ticketExVatPence).toBe(2500);
    expect(p.ticketVatPence).toBe(500);
    expect(p.ticketIncVatPence).toBe(3000);
    expect(p.lunchExVatPence).toBe(0);
    expect(p.lunchVatPence).toBe(0);
    expect(p.lunchIncVatPence).toBe(0);
    expect(p.grossExVatPence).toBe(2500);
    expect(p.grossVatPence).toBe(500);
    expect(p.grossIncVatPence).toBe(3000);
  });

  it("regular with lunch adds a £15 inc-VAT line separately", () => {
    const p = computeDelegatePricing(validIntent, IN_STANDARD);
    expect(p.period).toBe("standard");
    expect(p.ticketIncVatPence).toBe(4200);         // £35 + VAT
    expect(p.lunchIncVatPence).toBe(1500);          // £15 inc-VAT
    expect(p.lunchExVatPence).toBe(1250);
    expect(p.lunchVatPence).toBe(250);
    expect(p.grossIncVatPence).toBe(5700);
  });

  it("VIP never adds a separate lunch line (lunch bundled)", () => {
    const p = computeDelegatePricing(vipIntent, IN_LAUNCH);
    expect(p.ticketExVatPence).toBe(6900);
    expect(p.ticketIncVatPence).toBe(8280);         // £69 + VAT
    expect(p.lunchIncVatPence).toBe(0);
    expect(p.grossIncVatPence).toBe(8280);
  });

  it("late period regular price is £45 + VAT", () => {
    const p = computeDelegatePricing(
      { ...validIntent, lunchIncluded: false },
      IN_LATE,
    );
    expect(p.period).toBe("late");
    expect(p.ticketExVatPence).toBe(4500);
    expect(p.ticketVatPence).toBe(900);
    expect(p.ticketIncVatPence).toBe(5400);
  });
});

// ---------------------------------------------------------------------------
// createDelegateCheckoutSession with a mocked Stripe client.
// ---------------------------------------------------------------------------

const createMock = vi.fn(async (params: Record<string, unknown>) => ({
  id: "cs_test_123",
  url: "https://checkout.stripe.test/cs_test_123",
  ...params,
}));

vi.mock("./client", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: createMock,
      },
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: () => "https://example.test",
    stripeSecretKey: () => "sk_test_xxx",
  },
}));

describe("createDelegateCheckoutSession", () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  afterEach(() => {
    createMock.mockClear();
  });

  it("creates a session with ticket line item only for regular without lunch", async () => {
    const result = await createDelegateCheckoutSession({
      intent: { ...validIntent, lunchIncluded: false },
      termsAcceptedIp: "10.0.0.1",
      pricingNow: IN_STANDARD,
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const params = createMock.mock.calls[0]?.[0] as {
      line_items: Array<{ price_data: { unit_amount: number; product_data: { name: string } } }>;
      success_url: string;
      cancel_url: string;
      metadata: Record<string, string>;
      customer_email: string;
      client_reference_id: string;
    };
    expect(params.line_items).toHaveLength(1);
    // Step 2 still emits inc-VAT unit amounts with tax_behavior "inclusive"
    // so total customer charge is unchanged. Step 4 flips to ex-VAT + exclusive.
    expect(params.line_items[0]?.price_data.unit_amount).toBe(4200); // £35 inc-VAT
    expect(params.success_url).toContain("/attend/book/success?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toContain("/attend/book/cancel");
    expect(params.customer_email).toBe(validIntent.email);
    expect(params.metadata.booking_type).toBe("delegate");
    expect(params.metadata.ticket_type).toBe("regular");
    expect(params.metadata.pricing_period).toBe("standard");
    expect(params.metadata.terms_accepted_ip).toBe("10.0.0.1");
    expect(params.client_reference_id).toMatch(/^I27-[A-Z2-9]{7}$/);
    expect(result.url).toBe("https://checkout.stripe.test/cs_test_123");
  });

  it("includes ticket + lunch line items for regular with lunch", async () => {
    await createDelegateCheckoutSession({
      intent: validIntent,
      termsAcceptedIp: "10.0.0.1",
      pricingNow: IN_STANDARD,
    });
    const params = createMock.mock.calls[0]?.[0] as {
      line_items: Array<{ price_data: { unit_amount: number; product_data: { name: string } } }>;
    };
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0]?.price_data.unit_amount).toBe(4200); // £35 inc-VAT
    expect(params.line_items[1]?.price_data.unit_amount).toBe(1500); // £15 inc-VAT lunch
    expect(params.line_items[1]?.price_data.product_data.name).toMatch(/lunch/i);
  });

  it("emits only 2 line items maximum (no charity uplift in pricing v2)", async () => {
    await createDelegateCheckoutSession({
      intent: { ...validIntent, lunchIncluded: false },
      termsAcceptedIp: "10.0.0.1",
      pricingNow: IN_LATE,
    });
    const params = createMock.mock.calls[0]?.[0] as {
      line_items: Array<{ price_data: { unit_amount: number } }>;
    };
    expect(params.line_items).toHaveLength(1); // no charity uplift ever
    expect(params.line_items[0]?.price_data.unit_amount).toBe(5400); // £45 inc-VAT
  });

  it("throws BookingsNotOpenForCheckoutError before the launch period opens", async () => {
    await expect(
      createDelegateCheckoutSession({
        intent: validIntent,
        termsAcceptedIp: "10.0.0.1",
        pricingNow: BEFORE_OPEN,
      }),
    ).rejects.toBeInstanceOf(BookingsNotOpenForCheckoutError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("throws BookingsClosedForCheckoutError after bookings close (18 Jan 17:00)", async () => {
    await expect(
      createDelegateCheckoutSession({
        intent: validIntent,
        termsAcceptedIp: "10.0.0.1",
        pricingNow: AFTER_CLOSE,
      }),
    ).rejects.toBeInstanceOf(BookingsClosedForCheckoutError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("anchors expires_at and termsAcceptedAt to real wall-clock time, not pricingNow", async () => {
    // pricingNow is far in the future (inside the late period). Under the
    // old bug Stripe would see expires_at months out and reject. Both
    // expires_at and termsAcceptedAt must sit near the real now.
    const callStart = Date.now();
    await createDelegateCheckoutSession({
      intent: { ...validIntent, lunchIncluded: false },
      termsAcceptedIp: "10.0.0.1",
      pricingNow: IN_LATE,
    });
    const callEnd = Date.now();

    const params = createMock.mock.calls[0]?.[0] as {
      expires_at: number;
      metadata: Record<string, string>;
      line_items: Array<{ price_data: { unit_amount: number } }>;
    };

    const expiresMs = params.expires_at * 1000;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(callStart);
    expect(expiresMs - callEnd).toBeLessThan(twentyFourHoursMs);

    const termsMs = new Date(params.metadata.terms_accepted_at ?? "").getTime();
    expect(termsMs).toBeGreaterThanOrEqual(callStart);
    expect(termsMs).toBeLessThanOrEqual(callEnd);

    expect(params.line_items[0]?.price_data.unit_amount).toBe(5400); // £45 inc-VAT
    expect(params.metadata.pricing_period).toBe("late");
  });
});
