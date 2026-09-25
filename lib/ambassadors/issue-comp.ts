import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAuthUser, upsertAppUser } from "@/lib/bookings/create";
import { generateBookingReference } from "@/lib/bookings/reference";
import { sendCompTicketEmail } from "@/lib/bookings/send-comp-confirmation";
import { crmTagsForBooking, pushContactToCrmSafe } from "@/lib/crm/ghl";
import { logAdminAction } from "@/lib/admin/audit";
import { getActivePeriod } from "@/lib/pricing";

// Ambassador comp tickets: a REAL £0 regular-delegate booking with
// payment_status 'comp', no lunch (by decision), no Stripe object, and
// terms_accepted_at left null (v1 decision; terms-on-first-login is a
// phase 2 item). The database function issue_ambassador_comp does the
// booking + attendee + comp-record insert atomically with the
// ambassador row locked, so the allowance can never be exceeded by a
// double submit.

export interface CompRecipient {
  firstName: string;
  surname: string;
  email: string;
}

const MAX_NAME = 100;
const MAX_EMAIL = 200;

export type CompRecipientValidation =
  | { ok: true; recipient: CompRecipient }
  | { ok: false; error: string };

export function validateCompRecipient(input: {
  firstName?: unknown;
  surname?: unknown;
  email?: unknown;
}): CompRecipientValidation {
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const surname = typeof input.surname === "string" ? input.surname.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

  if (firstName.length === 0 || firstName.length > MAX_NAME) {
    return { ok: false, error: "We need their first name." };
  }
  if (surname.length === 0 || surname.length > MAX_NAME) {
    return { ok: false, error: "We need their surname." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_EMAIL) {
    return { ok: false, error: "That email does not look right." };
  }
  return { ok: true, recipient: { firstName, surname, email } };
}

// Duplicate guard (warn, don't double-book): an ACTIVE paid or comp
// booking already holding this attendee email means the person has a
// ticket. Returns its reference for the warning message.
export async function findExistingBookingForEmail(
  service: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await service
    .from("booking_attendees")
    .select("bookings!inner(booking_reference, booking_status, payment_status)")
    .eq("email", email)
    .limit(10);
  if (error) {
    // Fail SAFE for the duplicate check: if we cannot check, refuse to
    // issue rather than risk double-booking.
    throw new Error(`duplicate check failed: ${error.message}`);
  }
  type Row = {
    bookings: {
      booking_reference: string | null;
      booking_status: string;
      payment_status: string;
    };
  };
  const hit = ((data ?? []) as unknown as Row[]).find(
    (r) =>
      r.bookings.booking_status === "active" &&
      ["paid", "comp"].includes(r.bookings.payment_status),
  );
  return hit ? hit.bookings.booking_reference ?? "existing booking" : null;
}

export type IssueCompResult =
  | { ok: true; bookingReference: string }
  | { ok: false; warning?: string; error?: string };

// Claim-link extras: the guest fills a fuller form than the
// dashboard's name-and-email (comps still carry no lunch, so no
// dietary question), and the comp record notes how the ticket was
// spent.
export interface CompExtras {
  details?: {
    mobile: string;
    company: string;
    jobTitle: string;
    marketingOptIn: boolean;
  };
  source?: "dashboard" | "claim_link";
  auditAction?: "ambassador.comp_issue" | "ambassador.comp_claim";
}

// Full issuance flow, called from the gated /ambassador server action
// with the SERVICE client (ownership already verified by the guard;
// the allowance/active checks re-run inside the locked DB function).
export async function issueCompTicket(opts: {
  service: SupabaseClient;
  ambassadorId: string;
  actorAppUserId: string;
  recipient: CompRecipient;
} & CompExtras): Promise<IssueCompResult> {
  const { service, ambassadorId, actorAppUserId, recipient } = opts;

  const existingRef = await findExistingBookingForEmail(service, recipient.email);
  if (existingRef) {
    return {
      ok: false,
      warning: `That email already has a booking (${existingRef}). No new ticket was created.`,
    };
  }

  const authUserId = await ensureAuthUser(service, recipient.email, {
    first_name: recipient.firstName,
    surname: recipient.surname,
    company: "",
  });
  const recipientUserId = await upsertAppUser(service, recipient.email, authUserId, {
    firstName: recipient.firstName,
    surname: recipient.surname,
    mobile: opts.details?.mobile ?? "",
    company: opts.details?.company ?? "",
    jobTitle: opts.details?.jobTitle ?? "",
    marketingOptIn: opts.details?.marketingOptIn ?? false,
  });

  const bookingReference = generateBookingReference();
  // Best-effort period label for reporting; comps can be issued outside
  // the sales window, in which case it stays null.
  let period: string | null = null;
  try {
    period = getActivePeriod(new Date());
  } catch {
    period = null;
  }

  const { data: bookingId, error: rpcErr } = await service.rpc("issue_ambassador_comp", {
    p_ambassador_id: ambassadorId,
    p_booking_reference: bookingReference,
    p_recipient_user_id: recipientUserId,
    p_first_name: recipient.firstName,
    p_surname: recipient.surname,
    p_email: recipient.email,
    p_pricing_period: period,
    p_source: opts.source ?? "dashboard",
  });
  if (rpcErr || !bookingId) {
    const message = rpcErr?.message ?? "unknown error";
    if (/allowance exhausted/.test(message)) {
      return { ok: false, error: "No comp tickets left in your allowance." };
    }
    if (/deactivated/.test(message)) {
      return { ok: false, error: "Your ambassador account is not active." };
    }
    console.error("[ambassador] comp issuance failed:", message);
    return { ok: false, error: "Could not create the ticket. Try again." };
  }

  // Comp-specific confirmation: THE TICKET leads (booked, date, venue,
  // reference, who gave it); account setup is the quiet second section
  // with the always-works forgot-password fallback spelled out. A
  // failure here logs loudly but the booking stands; the admin
  // bookings view shows the unsent flag.
  let givenByName: string | null = null;
  try {
    const { data: ambRow } = await service
      .from("ambassadors")
      .select("display_name")
      .eq("id", ambassadorId)
      .maybeSingle();
    givenByName = (ambRow as { display_name: string } | null)?.display_name ?? null;
  } catch {
    givenByName = null; // the email has a warm no-name fallback
  }
  try {
    await sendCompTicketEmail({
      bookingId: bookingId as string,
      bookingReference,
      recipient: { firstName: recipient.firstName, email: recipient.email },
      givenByName,
    });
  } catch (err) {
    console.error(
      "[ambassador] comp confirmation email failed (booking stands):",
      bookingReference,
      err,
    );
  }

  await pushContactToCrmSafe(
    {
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.surname,
      phone: null,
      tags: crmTagsForBooking("delegate", "regular", { ambassadorComp: true }),
    },
    `ambassador comp ${bookingReference}`,
  );

  await logAdminAction(actorAppUserId, opts.auditAction ?? "ambassador.comp_issue", {
    ambassador_id: ambassadorId,
    booking_reference: bookingReference,
    source: opts.source ?? "dashboard",
  });

  return { ok: true, bookingReference };
}

