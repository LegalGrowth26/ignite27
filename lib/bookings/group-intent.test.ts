import { describe, expect, it } from "vitest";
import {
  parseGroupIntentPayload,
  tbcAttendeeFields,
  validateGroupBookingIntent,
} from "./group-intent";

function ticket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticketType: "regular",
    lunchIncluded: false,
    tbc: false,
    firstName: "Ada",
    surname: "Lovelace",
    email: `ada+${Math.random().toString(36).slice(2, 8)}@example.com`,
    jobTitle: "Engineer",
    dietaryRequirement: "none",
    dietaryOther: "",
    ...overrides,
  };
}

const base = {
  leadMobile: "07700 900000",
  company: "Analytical Engines Ltd",
  marketingOptIn: false,
  termsAccepted: "on",
  discountCode: "",
};

describe("validateGroupBookingIntent", () => {
  it("accepts a clean 3-ticket group and uppercases the code", () => {
    const result = validateGroupBookingIntent({
      ...base,
      discountCode: "save10",
      tickets: [ticket(), ticket(), ticket({ tbc: true, firstName: "", surname: "", email: "" })],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.discountCode).toBe("SAVE10");
    expect(result.intent.tickets).toHaveLength(3);
    expect(result.intent.tickets[2]!.tbc).toBe(true);
  });

  it("rejects groups of 1 and of 11", () => {
    expect(validateGroupBookingIntent({ ...base, tickets: [ticket()] }).ok).toBe(false);
    expect(
      validateGroupBookingIntent({
        ...base,
        tickets: Array.from({ length: 11 }, () => ticket()),
      }).ok,
    ).toBe(false);
  });

  it("ticket 1 can never be TBC: the lead is always named", () => {
    const result = validateGroupBookingIntent({
      ...base,
      tickets: [
        ticket({ tbc: true, firstName: "", surname: "", email: "" }),
        ticket(),
      ],
    });
    // tbc is ignored on ticket 1, so the empty name fields now fail.
    expect(result.ok).toBe(false);
  });

  it("named tickets need name and a valid, unique email; TBC tickets need nothing", () => {
    const dup = ticket({ email: "same@example.com" });
    const result = validateGroupBookingIntent({
      ...base,
      tickets: [dup, ticket({ email: "same@example.com" })],
    });
    expect(result.ok).toBe(false);

    const okResult = validateGroupBookingIntent({
      ...base,
      tickets: [ticket(), ticket({ tbc: true, firstName: "", surname: "", email: "not-an-email" })],
    });
    expect(okResult.ok).toBe(true);
  });

  it("VIP tickets always include lunch; dietary required only when eating", () => {
    const result = validateGroupBookingIntent({
      ...base,
      tickets: [
        ticket({ ticketType: "vip", lunchIncluded: false, dietaryRequirement: "vegan" }),
        ticket({ lunchIncluded: true, dietaryRequirement: "bogus" }),
      ],
    });
    expect(result.ok).toBe(false); // ticket 2's dietary is invalid
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "tickets.1.dietaryRequirement")).toBe(true);

    const okResult = validateGroupBookingIntent({
      ...base,
      tickets: [
        ticket({ ticketType: "vip", lunchIncluded: false, dietaryRequirement: "vegan" }),
        ticket({ lunchIncluded: false, dietaryRequirement: "bogus" }), // stripped, no lunch
      ],
    });
    expect(okResult.ok).toBe(true);
    if (!okResult.ok) return;
    expect(okResult.intent.tickets[0]!.lunchIncluded).toBe(true); // VIP forced
    expect(okResult.intent.tickets[1]!.dietaryRequirement).toBe("none");
  });

  it("requires terms, mobile, and company", () => {
    const result = validateGroupBookingIntent({
      leadMobile: "",
      company: "",
      termsAccepted: false,
      tickets: [ticket(), ticket()],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("leadMobile");
    expect(fields).toContain("company");
    expect(fields).toContain("termsAccepted");
  });
});

describe("tbcAttendeeFields", () => {
  it("stores the literal TBC placeholder with the lead's email", () => {
    expect(tbcAttendeeFields("lead@example.com")).toEqual({
      firstName: "TBC",
      surname: "",
      email: "lead@example.com",
    });
  });
});

describe("parseGroupIntentPayload", () => {
  it("rejects malformed payloads loudly", () => {
    expect(() => parseGroupIntentPayload(null)).toThrow();
    expect(() => parseGroupIntentPayload({ version: 2 })).toThrow();
    expect(() =>
      parseGroupIntentPayload({
        version: 1,
        intent: { tickets: [] },
      }),
    ).toThrow();
  });
});
