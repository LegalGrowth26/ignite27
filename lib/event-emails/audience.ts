import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";

// Audience resolution for scheduled event emails. Pure: the cron route
// fetches attendee rows (joined to their booking) and this decides who
// gets the email. Resolution happens at SEND time so late bookers are
// always included.
//
// Rules, per organiser decision:
//   - Only ACTIVE bookings with a completed payment (paid or comp).
//   - 'delegates' = regular delegate tickets, which INCLUDES comp
//     recipients (their bookings are regular delegates at £0).
//   - 'vips' = VIP tickets.
//   - 'exhibitors' = every NAMED attendee on exhibitor bookings; TBC
//     placeholder attendees are skipped everywhere (their email is the
//     booking contact's, who is a named attendee or reachable anyway).
//   - Deduped by email: someone on two bookings gets ONE email.

export type ScheduledEmailAudience =
  | "all_attendees"
  | "delegates"
  | "vips"
  | "exhibitors"
  | "everyone_except_vips";

export const SCHEDULED_EMAIL_AUDIENCES: readonly ScheduledEmailAudience[] = [
  "all_attendees",
  "delegates",
  "vips",
  "exhibitors",
  "everyone_except_vips",
];

export const AUDIENCE_LABELS: Record<ScheduledEmailAudience, string> = {
  all_attendees: "All attendees",
  delegates: "Delegates",
  vips: "VIPs",
  exhibitors: "Exhibitors",
  everyone_except_vips: "Everyone except VIPs",
};

export interface AttendeeSourceRow {
  first_name: string;
  surname: string;
  email: string;
  booking_id: string;
  // 'partner' = the partner package's own places: included in
  // all_attendees and everyone_except_vips, never in the typed lists.
  booking_type: "delegate" | "exhibitor" | "partner";
  ticket_type: string;
  booking_status: string;
  payment_status: string;
}

export interface EmailRecipient {
  email: string;
  firstName: string;
  bookingId: string;
}

function matchesAudience(row: AttendeeSourceRow, audience: ScheduledEmailAudience): boolean {
  switch (audience) {
    case "all_attendees":
      return true;
    case "delegates":
      return row.booking_type === "delegate" && row.ticket_type === "regular";
    case "vips":
      return row.booking_type === "delegate" && row.ticket_type === "vip";
    case "exhibitors":
      return row.booking_type === "exhibitor";
    // For announcements VIPs already had (e.g. "workshop booking now
    // open to everyone" after their early window). Excludes VIP rows;
    // note someone who is BOTH a VIP and a named exhibitor attendee
    // still receives it via their exhibitor row.
    case "everyone_except_vips":
      return !(row.booking_type === "delegate" && row.ticket_type === "vip");
  }
}

export function resolveRecipients(
  rows: readonly AttendeeSourceRow[],
  audience: ScheduledEmailAudience,
): EmailRecipient[] {
  const byEmail = new Map<string, EmailRecipient>();
  for (const row of rows) {
    if (row.booking_status !== "active") continue;
    if (!["paid", "comp"].includes(row.payment_status)) continue;
    if (isTbcAttendeeName(row.first_name, row.surname)) continue;
    if (!matchesAudience(row, audience)) continue;
    const email = row.email.trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, { email, firstName: row.first_name, bookingId: row.booking_id });
  }
  return [...byEmail.values()];
}
