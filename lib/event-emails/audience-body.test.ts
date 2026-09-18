import { describe, expect, it } from "vitest";
import { bodyToParagraphs, tokeniseParagraph } from "./body";
import { resolveRecipients, type AttendeeSourceRow } from "./audience";

function row(overrides: Partial<AttendeeSourceRow>): AttendeeSourceRow {
  return {
    first_name: "Ada",
    surname: "Lovelace",
    email: "ada@example.com",
    booking_id: "b-1",
    booking_type: "delegate",
    ticket_type: "regular",
    booking_status: "active",
    payment_status: "paid",
    ...overrides,
  };
}

describe("resolveRecipients", () => {
  it("all_attendees: paid and comp actives across both booking types", () => {
    const recipients = resolveRecipients(
      [
        row({}),
        row({ email: "vip@example.com", ticket_type: "vip" }),
        row({ email: "ex@example.com", booking_type: "exhibitor", ticket_type: "exhibitor" }),
        row({ email: "comp@example.com", payment_status: "comp" }),
        row({ email: "pending@example.com", payment_status: "pending" }),
        row({ email: "cancelled@example.com", booking_status: "cancelled" }),
      ],
      "all_attendees",
    );
    expect(recipients.map((r) => r.email).sort()).toEqual([
      "ada@example.com",
      "comp@example.com",
      "ex@example.com",
      "vip@example.com",
    ]);
  });

  it("delegates: regular tickets only, and comp recipients COUNT as delegates", () => {
    const recipients = resolveRecipients(
      [
        row({}),
        row({ email: "comp@example.com", payment_status: "comp" }),
        row({ email: "vip@example.com", ticket_type: "vip" }),
        row({ email: "ex@example.com", booking_type: "exhibitor", ticket_type: "exhibitor" }),
      ],
      "delegates",
    );
    expect(recipients.map((r) => r.email).sort()).toEqual([
      "ada@example.com",
      "comp@example.com",
    ]);
  });

  it("vips and exhibitors select their own groups", () => {
    const rows = [
      row({}),
      row({ email: "vip@example.com", ticket_type: "vip" }),
      row({ email: "ex@example.com", booking_type: "exhibitor", ticket_type: "exhibitor" }),
    ];
    expect(resolveRecipients(rows, "vips").map((r) => r.email)).toEqual(["vip@example.com"]);
    expect(resolveRecipients(rows, "exhibitors").map((r) => r.email)).toEqual(["ex@example.com"]);
  });

  it("skips TBC placeholder attendees", () => {
    const recipients = resolveRecipients(
      [
        row({
          first_name: "TBC",
          surname: "",
          email: "contact@example.com",
          booking_type: "exhibitor",
          ticket_type: "exhibitor",
        }),
      ],
      "exhibitors",
    );
    expect(recipients).toEqual([]);
  });

  it("dedupes by email, case-insensitively: two bookings, one email", () => {
    const recipients = resolveRecipients(
      [row({}), row({ email: "Ada@Example.com", booking_id: "b-2" })],
      "all_attendees",
    );
    expect(recipients).toHaveLength(1);
    expect(recipients[0]!.email).toBe("ada@example.com");
  });
});

describe("bodyToParagraphs", () => {
  it("splits on blank lines, tolerating CRLF and stray whitespace", () => {
    expect(bodyToParagraphs("One.\r\n\r\nTwo.\n\n   \nThree.")).toEqual([
      "One.",
      "Two.",
      "Three.",
    ]);
  });

  it("drops empty input to an empty list", () => {
    expect(bodyToParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("tokeniseParagraph", () => {
  it("auto-links bare URLs and keeps surrounding text", () => {
    expect(tokeniseParagraph("Park at https://example.com/parking then walk.")).toEqual([
      { type: "text", value: "Park at " },
      { type: "link", value: "https://example.com/parking" },
      { type: "text", value: " then walk." },
    ]);
  });

  it("does not swallow trailing punctuation into the link", () => {
    expect(tokeniseParagraph("See https://example.com.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "." },
    ]);
  });

  it("plain text passes through as one token", () => {
    expect(tokeniseParagraph("No links here.")).toEqual([
      { type: "text", value: "No links here." },
    ]);
  });
});
