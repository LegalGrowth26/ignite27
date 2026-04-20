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

describe("computeDelegatePricing", () => {
  it("regular without lunch in window_2", () => {
    const p = computeDelegatePricing(
      { ...validIntent, lunchIncluded: false },
      uk("2026-07-10T12:00:00"),
    );
    expect(p.window).toBe("window_2");
    expect(p.ticketPricePence).toBe(4900);
    expect(p.lunchPricePence).toBe(0);
    expect(p.charityUpliftPence).toBe(0);
    expect(p.grossAmountPence).toBe(4900);
  });

  it("regular with lunch adds £15 separately", () => {
    const p = computeDelegatePricing(validIntent, uk("2026-07-10T12:00:00"));
    expect(p.lunchPricePence).toBe(1500);
    expect(p.grossAmountPence).toBe(4900 + 1500);
  });

  it("VIP never adds a separate lunch line (lunch bundled)", () => {
    const p = computeDelegatePricing(vipIntent, uk("2026-07-10T12:00:00"));
    expect(p.ticketPricePence).toBe(11900);
    expect(p.lunchPricePence).toBe(0);
    expect(p.grossAmountPence).toBe(11900);
  });

  it("event-day regular includes £5 charity uplift", () => {
    const p = computeDelegatePricing(
      { ...validIntent, lunchIncluded: false },
      uk("2027-01-21T10:00:00"),
    );
    expect(p.window).toBe("event_day");
    expect(p.ticketPricePence).toBe(6900);
    expect(p.charityUpliftPence).toBe(500);
    expect(p.grossAmountPence).toBe(7400);
  });

  it("Christmas drop reverts to Window 2 prices", () => {
    const p = computeDelegatePricing(
      { ...validIntent, lunchIncluded: false },
      uk("2026-12-25T12:00:00"),
    );
    expect(p.window).toBe("christmas_drop");
    expect(p.ticketPricePence).toBe(4900);
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
      now: uk("2026-07-10T12:00:00"),
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
    expect(params.line_items[0]?.price_data.unit_amount).toBe(4900);
    expect(params.success_url).toContain("/attend/book/success?session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toContain("/attend/book/cancel");
    expect(params.customer_email).toBe(validIntent.email);
    expect(params.metadata.booking_type).toBe("delegate");
    expect(params.metadata.ticket_type).toBe("regular");
    expect(params.metadata.terms_accepted_ip).toBe("10.0.0.1");
    expect(params.client_reference_id).toMatch(/^I27-[A-Z2-9]{7}$/);
    expect(result.url).toBe("https://checkout.stripe.test/cs_test_123");
  });

  it("includes ticket + lunch line items for regular with lunch", async () => {
    await createDelegateCheckoutSession({
      intent: validIntent,
      termsAcceptedIp: "10.0.0.1",
      now: uk("2026-07-10T12:00:00"),
    });
    const params = createMock.mock.calls[0]?.[0] as {
      line_items: Array<{ price_data: { unit_amount: number; product_data: { name: string } } }>;
    };
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0]?.price_data.unit_amount).toBe(4900);
    expect(params.line_items[1]?.price_data.unit_amount).toBe(1500);
    expect(params.line_items[1]?.price_data.product_data.name).toMatch(/lunch/i);
  });

  it("includes charity uplift line on event day", async () => {
    await createDelegateCheckoutSession({
      intent: { ...validIntent, lunchIncluded: false },
      termsAcceptedIp: "10.0.0.1",
      now: uk("2027-01-21T10:00:00"),
    });
    const params = createMock.mock.calls[0]?.[0] as {
      line_items: Array<{ price_data: { unit_amount: number; product_data: { name: string } } }>;
    };
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[1]?.price_data.unit_amount).toBe(500);
    expect(params.line_items[1]?.price_data.product_data.name).toMatch(/Lincoln City Foundation/);
  });

  it("throws BookingsNotOpenForCheckoutError before Window 1 opens", async () => {
    await expect(
      createDelegateCheckoutSession({
        intent: validIntent,
        termsAcceptedIp: "10.0.0.1",
        now: uk("2026-06-29T00:00:00"),
      }),
    ).rejects.toBeInstanceOf(BookingsNotOpenForCheckoutError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("throws BookingsClosedForCheckoutError after event day ends", async () => {
    await expect(
      createDelegateCheckoutSession({
        intent: validIntent,
        termsAcceptedIp: "10.0.0.1",
        now: uk("2027-01-22T00:00:00"),
      }),
    ).rejects.toBeInstanceOf(BookingsClosedForCheckoutError);
    expect(createMock).not.toHaveBeenCalled();
  });
});
