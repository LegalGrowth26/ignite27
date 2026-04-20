import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDelegateBookingFromCheckoutSession } from "./create";
import type { ParsedDelegateMetadata } from "./intent";

function buildParsed(overrides: Partial<ParsedDelegateMetadata> = {}): ParsedDelegateMetadata {
  return {
    bookingReference: "I27-ABCDEFG",
    termsAcceptedAt: "2026-07-10T12:00:00.000Z",
    termsAcceptedIp: "10.0.0.1",
    intent: {
      ticketType: "regular",
      lunchIncluded: true,
      firstName: "Ada",
      surname: "Lovelace",
      email: "ada@example.com",
      mobile: "07700900000",
      company: "Analytical",
      jobTitle: "Mathematician",
      dietaryRequirement: "none",
      dietaryOther: "",
      badgeQrUrl: "",
      marketingOptIn: false,
      termsAccepted: true,
      ...overrides.intent,
    },
    pricing: {
      window: "window_2",
      ticketPricePence: 4900,
      lunchPricePence: 1500,
      charityUpliftPence: 0,
      grossAmountPence: 6400,
      ...overrides.pricing,
    },
  };
}

// A minimal Supabase stub that supports the chain the creation module uses.
function buildStubClient(state: {
  existingBookingForSession?: {
    id: string;
    user_id: string;
    booking_reference: string | null;
    confirmation_email_sent_at: string | null;
  };
  existingUserByEmail?: { id: string; auth_user_id: string | null };
  createUserError?: { status?: number; message?: string };
  createdAuthUserId?: string;
  insertBookingId?: string;
}) {
  const calls = {
    bookingsInsert: vi.fn(),
    bookingAttendeesInsert: vi.fn(),
    usersInsert: vi.fn(),
    usersUpdate: vi.fn(),
    createUser: vi.fn(),
    listUsers: vi.fn(),
  };

  const client = {
    auth: {
      admin: {
        createUser: calls.createUser.mockImplementation(async () => {
          if (state.createUserError) {
            return { data: null, error: state.createUserError };
          }
          return {
            data: { user: { id: state.createdAuthUserId ?? "auth-user-id-new" } },
            error: null,
          };
        }),
        listUsers: calls.listUsers.mockImplementation(async () => ({
          data: {
            users: [
              { id: state.existingUserByEmail?.auth_user_id ?? "auth-user-id-old", email: "ada@example.com" },
            ],
          },
          error: null,
        })),
      },
    },
    from(table: string) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.existingBookingForSession ?? null,
                error: null,
              }),
            }),
          }),
          insert: (row: unknown) => {
            calls.bookingsInsert(row);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: state.insertBookingId ?? "booking-1" },
                  error: null,
                }),
              }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.existingUserByEmail ?? null,
                error: null,
              }),
            }),
          }),
          insert: (row: unknown) => {
            calls.usersInsert(row);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "app-user-new" },
                  error: null,
                }),
              }),
            };
          },
          update: (row: unknown) => {
            calls.usersUpdate(row);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "booking_attendees") {
        return {
          insert: async (row: unknown) => {
            calls.bookingAttendeesInsert(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;

  return { client, calls };
}

describe("createDelegateBookingFromCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new booking when no prior session match exists", async () => {
    const { client, calls } = buildStubClient({});
    const parsed = buildParsed();

    const result = await createDelegateBookingFromCheckoutSession({
      client,
      parsed,
      stripeCheckoutSessionId: "cs_test_new",
      stripePaymentIntentId: "pi_test",
      vatAmountPence: 200,
      paidAt: new Date(),
    });

    expect(result.isNew).toBe(true);
    expect(result.confirmationEmailSentAt).toBeNull();
    expect(calls.bookingsInsert).toHaveBeenCalledTimes(1);
    expect(calls.bookingAttendeesInsert).toHaveBeenCalledTimes(1);
    expect(calls.usersInsert).toHaveBeenCalledTimes(1);
    const bookingRow = calls.bookingsInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(bookingRow.booking_reference).toBe("I27-ABCDEFG");
    expect(bookingRow.stripe_checkout_session_id).toBe("cs_test_new");
    expect(bookingRow.booking_type).toBe("delegate");
    expect(bookingRow.payment_status).toBe("paid");
  });

  it("is idempotent when a booking with this session id already exists (email not yet sent)", async () => {
    const { client, calls } = buildStubClient({
      existingBookingForSession: {
        id: "existing-id",
        user_id: "existing-user",
        booking_reference: "I27-EXISTS",
        confirmation_email_sent_at: null,
      },
    });
    const parsed = buildParsed();

    const result = await createDelegateBookingFromCheckoutSession({
      client,
      parsed,
      stripeCheckoutSessionId: "cs_test_dup",
      stripePaymentIntentId: "pi_test",
      vatAmountPence: 0,
      paidAt: new Date(),
    });

    expect(result.isNew).toBe(false);
    expect(result.bookingId).toBe("existing-id");
    expect(result.bookingReference).toBe("I27-EXISTS");
    expect(result.confirmationEmailSentAt).toBeNull();
    expect(calls.bookingsInsert).not.toHaveBeenCalled();
    expect(calls.bookingAttendeesInsert).not.toHaveBeenCalled();
  });

  it("surfaces confirmation_email_sent_at when the existing booking already had an email sent", async () => {
    const sentAt = "2026-04-20T10:00:00.000Z";
    const { client } = buildStubClient({
      existingBookingForSession: {
        id: "existing-id",
        user_id: "existing-user",
        booking_reference: "I27-EXISTS",
        confirmation_email_sent_at: sentAt,
      },
    });
    const parsed = buildParsed();

    const result = await createDelegateBookingFromCheckoutSession({
      client,
      parsed,
      stripeCheckoutSessionId: "cs_test_dup_already_emailed",
      stripePaymentIntentId: "pi_test",
      vatAmountPence: 0,
      paidAt: new Date(),
    });

    expect(result.isNew).toBe(false);
    expect(result.confirmationEmailSentAt).toBe(sentAt);
  });

  it("links an existing users row to a newly-created auth user when auth_user_id was null", async () => {
    const { client, calls } = buildStubClient({
      existingUserByEmail: { id: "existing-app-user", auth_user_id: null },
    });
    const parsed = buildParsed();

    await createDelegateBookingFromCheckoutSession({
      client,
      parsed,
      stripeCheckoutSessionId: "cs_test_new2",
      stripePaymentIntentId: "pi_test",
      vatAmountPence: 0,
      paidAt: new Date(),
    });

    expect(calls.usersUpdate).toHaveBeenCalledTimes(1);
    const updateRow = calls.usersUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateRow.auth_user_id).toBeTruthy();
    expect(calls.usersInsert).not.toHaveBeenCalled();
  });

  it("recovers when auth.admin.createUser reports the user already exists", async () => {
    const { client, calls } = buildStubClient({
      createUserError: { status: 422, message: "User already registered" },
      existingUserByEmail: { id: "existing-app-user", auth_user_id: "existing-auth-id" },
    });
    const parsed = buildParsed();

    const result = await createDelegateBookingFromCheckoutSession({
      client,
      parsed,
      stripeCheckoutSessionId: "cs_test_existing_auth",
      stripePaymentIntentId: "pi_test",
      vatAmountPence: 0,
      paidAt: new Date(),
    });

    expect(result.isNew).toBe(true);
    expect(calls.listUsers).toHaveBeenCalledTimes(1);
  });
});
