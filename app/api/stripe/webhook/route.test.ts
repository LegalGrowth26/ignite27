import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock hoists above imports; vi.hoisted lets shared fns live alongside.
const { constructEvent, createBooking, sendConfirmation } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  createBooking: vi.fn(),
  sendConfirmation: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent,
    },
  }),
}));

vi.mock("@/lib/bookings/create", () => ({
  createDelegateBookingFromCheckoutSession: createBooking,
  markConfirmationEmailSent: vi.fn(),
  BookingCreationError: class BookingCreationError extends Error {
    constructor(m: string) {
      super(m);
    }
  },
}));

vi.mock("@/lib/bookings/send-confirmation", () => ({
  sendDelegateConfirmationEmail: sendConfirmation,
}));

vi.mock("@/lib/supabase/service-client", () => ({
  createSupabaseServiceClient: () => ({}),
}));

vi.mock("@/lib/env", () => ({
  env: {
    stripeWebhookSecret: () => "whsec_test",
    siteUrl: () => "https://example.test",
  },
}));

import { POST } from "./route";

function buildSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cs_test_abc",
    mode: "payment",
    payment_status: "paid",
    payment_intent: "pi_test_xyz",
    total_details: { amount_tax: 123 },
    metadata: {
      booking_type: "delegate",
      ticket_type: "regular",
      lunch_included: "false",
      pricing_window: "window_2",
      ticket_price_pence: "4900",
      lunch_price_pence: "0",
      charity_uplift_pence: "0",
      gross_amount_pence: "4900",
      booking_ref: "I27-ABCDEFG",
      first_name: "Ada",
      surname: "Lovelace",
      email: "ada@example.com",
      mobile: "07700900000",
      company: "Analytical",
      job_title: "Mathematician",
      dietary_requirement: "none",
      dietary_other: "",
      badge_qr_url: "",
      marketing_opt_in: "false",
      terms_accepted_at: "2026-07-10T12:00:00.000Z",
      terms_accepted_ip: "10.0.0.1",
    },
    ...overrides,
  };
}

function buildRequest(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return new Request("https://example.test/api/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    constructEvent.mockReset();
    createBooking.mockReset();
    sendConfirmation.mockReset();
  });

  it("returns 400 when signature header is missing", async () => {
    const res = await POST(buildRequest("{}", null));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(400);
  });

  it("creates a booking and sends confirmation on checkout.session.completed (new)", async () => {
    const session = buildSession();
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: session },
    });
    createBooking.mockResolvedValue({
      isNew: true,
      bookingId: "b1",
      bookingReference: "I27-ABCDEFG",
      userId: "u1",
      authUserId: "au1",
      confirmationEmailSentAt: null,
    });
    sendConfirmation.mockResolvedValue(undefined);

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    const arg = createBooking.mock.calls[0]?.[0] as {
      stripeCheckoutSessionId: string;
      stripePaymentIntentId: string;
      vatAmountPence: number;
    };
    expect(arg.stripeCheckoutSessionId).toBe("cs_test_abc");
    expect(arg.stripePaymentIntentId).toBe("pi_test_xyz");
    expect(arg.vatAmountPence).toBe(123);
  });

  it("branch 2: existing booking with email NOT yet sent retries the confirmation send", async () => {
    constructEvent.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession() },
    });
    createBooking.mockResolvedValue({
      isNew: false,
      bookingId: "b1",
      bookingReference: "I27-ABCDEFG",
      userId: "u1",
      authUserId: null,
      confirmationEmailSentAt: null,
    });
    sendConfirmation.mockResolvedValue(undefined);

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("branch 2: existing booking retry where send fails still returns 200", async () => {
    constructEvent.mockReturnValue({
      id: "evt_2b",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession() },
    });
    createBooking.mockResolvedValue({
      isNew: false,
      bookingId: "b1",
      bookingReference: "I27-ABCDEFG",
      userId: "u1",
      authUserId: null,
      confirmationEmailSentAt: null,
    });
    sendConfirmation.mockRejectedValue(new Error("resend still down"));

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("branch 3: existing booking with email already sent does not resend", async () => {
    constructEvent.mockReturnValue({
      id: "evt_2c",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession() },
    });
    createBooking.mockResolvedValue({
      isNew: false,
      bookingId: "b1",
      bookingReference: "I27-ABCDEFG",
      userId: "u1",
      authUserId: null,
      confirmationEmailSentAt: "2026-04-20T10:00:00.000Z",
    });

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it("branch 1: new booking where email send throws still returns 200", async () => {
    constructEvent.mockReturnValue({
      id: "evt_3",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession() },
    });
    createBooking.mockResolvedValue({
      isNew: true,
      bookingId: "b2",
      bookingReference: "I27-ABCDEFG",
      userId: "u1",
      authUserId: "au1",
      confirmationEmailSentAt: null,
    });
    sendConfirmation.mockRejectedValue(new Error("resend down"));

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
  });

  it("skips non-payment sessions", async () => {
    constructEvent.mockReturnValue({
      id: "evt_4",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession({ mode: "subscription" }) },
    });

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("skips sessions that are not paid", async () => {
    constructEvent.mockReturnValue({
      id: "evt_5",
      type: "checkout.session.completed",
      created: 1700000000,
      data: { object: buildSession({ payment_status: "unpaid" }) },
    });

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("acknowledges checkout.session.expired without action", async () => {
    constructEvent.mockReturnValue({
      id: "evt_6",
      type: "checkout.session.expired",
      created: 1700000000,
      data: { object: { id: "cs_test_exp" } },
    });

    const res = await POST(buildRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(createBooking).not.toHaveBeenCalled();
  });
});
