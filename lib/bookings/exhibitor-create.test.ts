import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createExhibitorBookingFromCheckoutSession } from "./exhibitor-create";
import type { ParsedExhibitorMetadata } from "./exhibitor-intent";

// Stub Supabase client covering exactly the calls the exhibitor
// creation path makes: idempotency lookup, auth user provisioning, app
// user upsert, bookings insert, attendees insert. Captures inserts so
// assertions can inspect what would be written.
interface StubState {
  existingBookingBySession?: {
    id: string;
    user_id: string;
    booking_reference: string | null;
    confirmation_email_sent_at: string | null;
  };
  existingUserByEmail?: { id: string; auth_user_id: string | null };
  bookingInsert?: Record<string, unknown>;
  attendeeInserts?: Record<string, unknown>[];
  userInsert?: Record<string, unknown>;
}

function stubClient(state: StubState): SupabaseClient {
  return {
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: "auth-user-new" } },
          error: null,
        }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
    from(table: string) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.existingBookingBySession ?? null,
                error: null,
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            state.bookingInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: "booking-1" }, error: null }),
              }),
            };
          },
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
          insert: (row: Record<string, unknown>) => {
            state.userInsert = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: "app-user-1" }, error: null }),
              }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "booking_attendees") {
        return {
          insert: async (rows: Record<string, unknown>[]) => {
            state.attendeeInserts = rows;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

function parsedFixture(overrides?: {
  contactEmail?: string;
  a1Email?: string;
}): ParsedExhibitorMetadata {
  const contactEmail = overrides?.contactEmail ?? "ada@example.com";
  const a1Email = overrides?.a1Email ?? "ada@example.com";
  return {
    bookingReference: "I27-EXHIB01",
    termsAcceptedAt: "2026-08-05T12:00:00.000Z",
    termsAcceptedIp: "10.0.0.1",
    intent: {
      company: "Analytical Engines Ltd",
      website: "https://analyticalengines.example.com",
      contactFirstName: "Ada",
      contactSurname: "Lovelace",
      contactEmail,
      contactMobile: "07700900000",
      attendees: [
        {
          tbc: false,
          firstName: "Ada",
          surname: "Lovelace",
          email: a1Email,
          mobile: "07700900000",
          jobTitle: "Founder",
          dietaryRequirement: "vegetarian",
          dietaryOther: "",
        },
        {
          tbc: false,
          firstName: "Charles",
          surname: "Babbage",
          email: "charles@example.com",
          mobile: "",
          jobTitle: "Engineer",
          dietaryRequirement: "other",
          dietaryOther: "No beans",
        },
      ],
      marketingOptIn: true,
      termsAccepted: true,
    },
    pricing: {
      period: "launch",
      standExVatPence: 18900,
      standVatPence: 3780,
      standIncVatPence: 22680,
      grossExVatPence: 18900,
      grossVatPence: 3780,
      grossIncVatPence: 22680,
    },
  };
}

function baseInput(state: StubState, parsed = parsedFixture()) {
  return {
    client: stubClient(state),
    parsed,
    stripeCheckoutSessionId: "cs_test_exhib_1",
    stripePaymentIntentId: "pi_1",
    vatAmountPence: 3780,
    paidAt: new Date("2026-08-05T12:00:00Z"),
  };
}

describe("createExhibitorBookingFromCheckoutSession", () => {
  it("creates a booking with type exhibitor and TWO attendee rows, both with lunch", async () => {
    const state: StubState = {};
    const result = await createExhibitorBookingFromCheckoutSession(baseInput(state));

    expect(result.isNew).toBe(true);
    expect(result.bookingId).toBe("booking-1");

    expect(state.bookingInsert).toMatchObject({
      booking_type: "exhibitor",
      ticket_type: "exhibitor",
      lunch_included: true,
      gross_amount_pence: 22680,
      pricing_period: "launch",
      payment_status: "paid",
      booking_status: "active",
      company_name: "Analytical Engines Ltd",
      company_contact_name: "Ada Lovelace",
      company_contact_email: "ada@example.com",
      company_contact_mobile: "07700900000",
      company_website: "https://analyticalengines.example.com",
    });

    expect(state.attendeeInserts).toHaveLength(2);
    const [a1, a2] = state.attendeeInserts!;
    expect(a1).toMatchObject({
      attendee_index: 1,
      lunch_entitlement: true,
      dietary_requirement: "vegetarian",
      company: "Analytical Engines Ltd",
      badge_qr_url: null,
    });
    expect(a2).toMatchObject({
      attendee_index: 2,
      lunch_entitlement: true,
      dietary_requirement: "other",
      dietary_other: "No beans",
      mobile: null, // optional mobile left blank stores null
      badge_qr_url: null,
    });
  });

  it("links the app user and primary-contact flag only where the attendee IS the contact", async () => {
    const state: StubState = {};
    await createExhibitorBookingFromCheckoutSession(baseInput(state));

    const [a1, a2] = state.attendeeInserts!;
    expect(a1).toMatchObject({ user_id: "app-user-1", is_primary_contact: true });
    expect(a2).toMatchObject({ user_id: null, is_primary_contact: false });
  });

  it("no attendee is primary when the contact is not attending", async () => {
    const state: StubState = {};
    await createExhibitorBookingFromCheckoutSession(
      baseInput(state, parsedFixture({ contactEmail: "office@example.com" })),
    );

    const [a1, a2] = state.attendeeInserts!;
    expect(a1).toMatchObject({ user_id: null, is_primary_contact: false });
    expect(a2).toMatchObject({ user_id: null, is_primary_contact: false });
  });

  it("is idempotent: an existing booking for the session short-circuits", async () => {
    const state: StubState = {
      existingBookingBySession: {
        id: "booking-existing",
        user_id: "user-existing",
        booking_reference: "I27-EXHIB01",
        confirmation_email_sent_at: "2026-08-05T12:05:00.000Z",
      },
    };
    const result = await createExhibitorBookingFromCheckoutSession(baseInput(state));

    expect(result.isNew).toBe(false);
    expect(result.bookingId).toBe("booking-existing");
    expect(result.confirmationEmailSentAt).toBe("2026-08-05T12:05:00.000Z");
    expect(state.bookingInsert).toBeUndefined();
    expect(state.attendeeInserts).toBeUndefined();
  });

  it("TBC attendee: stored as name TBC under the contact's email, no dietary, lunch kept", async () => {
    const state: StubState = {};
    const parsed = parsedFixture();
    parsed.intent.attendees[1] = {
      tbc: true,
      firstName: "TBC",
      surname: "",
      email: "",
      mobile: "",
      jobTitle: "",
      dietaryRequirement: "none",
      dietaryOther: "",
    };
    await createExhibitorBookingFromCheckoutSession(baseInput(state, parsed));

    const [, a2] = state.attendeeInserts!;
    expect(a2).toMatchObject({
      first_name: "TBC",
      surname: "",
      // email column is NOT NULL; the contact's address is the chase route.
      email: "ada@example.com",
      mobile: null,
      job_title: null,
      dietary_requirement: "none",
      dietary_other: null,
      lunch_entitlement: true, // the lunch belongs to the booking
      user_id: null,
      is_primary_contact: false,
      attendee_index: 2,
    });
  });

  it("a TBC attendee never captures the primary-contact flag via the shared email", async () => {
    // TBC rows carry the contact's email by necessity; that must not
    // make them the primary contact or link the contact's app user.
    const state: StubState = {};
    const parsed = parsedFixture();
    parsed.intent.attendees[0] = {
      tbc: true,
      firstName: "TBC",
      surname: "",
      email: "",
      mobile: "",
      jobTitle: "",
      dietaryRequirement: "none",
      dietaryOther: "",
    };
    await createExhibitorBookingFromCheckoutSession(baseInput(state, parsed));
    const [a1] = state.attendeeInserts!;
    expect(a1).toMatchObject({ first_name: "TBC", user_id: null, is_primary_contact: false });
  });

  it("stores comp payment status and promo details when passed", async () => {
    const state: StubState = {};
    await createExhibitorBookingFromCheckoutSession({
      ...baseInput(state),
      paymentStatus: "comp" as const,
      promo: { code: "COMP-KELHAM-AB12", promotionCodeId: "promo_1", discountPence: 18900 },
    });

    expect(state.bookingInsert).toMatchObject({
      payment_status: "comp",
      promo_code: "COMP-KELHAM-AB12",
      promo_code_id: "promo_1",
      discount_pence: 18900,
    });
  });
});
