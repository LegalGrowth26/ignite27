import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EventUpdateEmail,
  renderEventUpdatePlainText,
  type EventUpdateProps,
} from "@/emails/event-update";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import {
  resolveRecipients,
  type AttendeeSourceRow,
  type ScheduledEmailAudience,
} from "./audience";

// The cron-tick processor. Design (per the approved plan):
//   - Claim due emails atomically (scheduled -> sending); resumed
//     'sending' emails from earlier ticks are picked up too.
//   - Resolve recipients NOW (late bookers included) and snapshot them
//     with insert ... on conflict do nothing: the unique
//     (scheduled_email_id, attendee_email) key makes re-snapshotting a
//     no-op, so retries never duplicate recipients.
//   - Process pending rows sequentially with per-recipient try/catch
//     (a failure marks that ROW failed and moves on) under a send
//     budget per tick and a throttle inside Resend's default 2 req/s.
//   - Known micro-window, same accepted trade-off as the confirmation
//     emails: a crash between Resend accepting and the row update can
//     duplicate ONE recipient's email on resume.

const SEND_BUDGET_PER_TICK = 200;
const THROTTLE_MS = 600; // ~1.6 sends/second, inside the 2 rps default

export interface ProcessSummary {
  claimed: number;
  sent: number;
  failed: number;
  completedEmails: number;
}

interface ScheduledEmailRow {
  id: string;
  subject: string;
  body: string;
  audience: ScheduledEmailAudience;
}

function eventUpdateProps(email: { subject: string; body: string }): EventUpdateProps {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  return {
    subject: email.subject,
    body: email.body,
    accountUrl: `${siteUrl}/account`,
    contactUrl: `${siteUrl}/contact`,
  };
}

export async function renderEventUpdate(email: {
  subject: string;
  body: string;
}): Promise<{ html: string; text: string }> {
  const props = eventUpdateProps(email);
  return {
    html: await render(EventUpdateEmail(props)),
    text: renderEventUpdatePlainText(props),
  };
}

async function fetchAttendeeSourceRows(service: SupabaseClient): Promise<AttendeeSourceRow[]> {
  const { data, error } = await service
    .from("booking_attendees")
    .select(
      `first_name, surname, email, booking_id,
       bookings!inner ( booking_type, ticket_type, booking_status, payment_status )`,
    );
  if (error) throw new Error(`attendee query failed: ${error.message}`);
  type Raw = {
    first_name: string;
    surname: string;
    email: string;
    booking_id: string;
    bookings: {
      booking_type: "delegate" | "exhibitor";
      ticket_type: string;
      booking_status: string;
      payment_status: string;
    };
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    first_name: r.first_name,
    surname: r.surname,
    email: r.email,
    booking_id: r.booking_id,
    booking_type: r.bookings.booking_type,
    ticket_type: r.bookings.ticket_type,
    booking_status: r.bookings.booking_status,
    payment_status: r.bookings.payment_status,
  }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processScheduledEmails(
  service: SupabaseClient,
  now: Date = new Date(),
): Promise<ProcessSummary> {
  const summary: ProcessSummary = { claimed: 0, sent: 0, failed: 0, completedEmails: 0 };

  // Claim newly due emails. The status filter in the WHERE makes this
  // safe under overlapping cron ticks: each row flips exactly once.
  const { data: claimedRows, error: claimErr } = await service
    .from("scheduled_emails")
    .update({ status: "sending", started_at: now.toISOString() })
    .eq("status", "scheduled")
    .lte("send_at", now.toISOString())
    .select("id");
  if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);
  summary.claimed = (claimedRows ?? []).length;

  // Everything mid-flight (just claimed + resumed from earlier ticks).
  const { data: sendingRows, error: sendingErr } = await service
    .from("scheduled_emails")
    .select("id, subject, body, audience")
    .eq("status", "sending")
    .order("send_at", { ascending: true });
  if (sendingErr) throw new Error(`sending query failed: ${sendingErr.message}`);
  const emails = (sendingRows ?? []) as ScheduledEmailRow[];
  if (emails.length === 0) return summary;

  const sourceRows = await fetchAttendeeSourceRows(service);
  let budget = SEND_BUDGET_PER_TICK;

  for (const email of emails) {
    // Snapshot recipients at send time; conflicts are silent no-ops.
    const recipients = resolveRecipients(sourceRows, email.audience);
    if (recipients.length > 0) {
      const { error: snapErr } = await service
        .from("scheduled_email_sends")
        .upsert(
          recipients.map((r) => ({
            scheduled_email_id: email.id,
            attendee_email: r.email,
            booking_id: r.bookingId,
          })),
          { onConflict: "scheduled_email_id,attendee_email", ignoreDuplicates: true },
        );
      if (snapErr) throw new Error(`recipient snapshot failed: ${snapErr.message}`);
    }

    const { html, text } = await renderEventUpdate(email);

    while (budget > 0) {
      const { data: pendingRows, error: pendingErr } = await service
        .from("scheduled_email_sends")
        .select("id, attendee_email")
        .eq("scheduled_email_id", email.id)
        .eq("status", "pending")
        .limit(Math.min(budget, 50));
      if (pendingErr) throw new Error(`pending query failed: ${pendingErr.message}`);
      const pending = (pendingRows ?? []) as Array<{ id: string; attendee_email: string }>;
      if (pending.length === 0) break;

      for (const row of pending) {
        if (budget <= 0) break;
        budget -= 1;
        try {
          await sendTransactionalEmail({
            to: row.attendee_email,
            subject: email.subject,
            html,
            text,
            tag: "event-update",
          });
          await service
            .from("scheduled_email_sends")
            .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
            .eq("id", row.id);
          summary.sent += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "send failed";
          await service
            .from("scheduled_email_sends")
            .update({ status: "failed", error: message.slice(0, 500) })
            .eq("id", row.id);
          summary.failed += 1;
          console.error(`[event-emails] send failed for email ${email.id}:`, message);
        }
        await sleep(THROTTLE_MS);
      }
    }

    // No pending rows left (regardless of budget) -> the email is done.
    const { count } = await service
      .from("scheduled_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_email_id", email.id)
      .eq("status", "pending");
    if ((count ?? 0) === 0) {
      await service
        .from("scheduled_emails")
        .update({ status: "sent", completed_at: new Date().toISOString() })
        .eq("id", email.id)
        .eq("status", "sending");
      summary.completedEmails += 1;
    }

    if (budget <= 0) break;
  }

  return summary;
}
