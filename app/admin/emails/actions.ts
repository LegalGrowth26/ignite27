"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  SCHEDULED_EMAIL_AUDIENCES,
  type ScheduledEmailAudience,
} from "@/lib/event-emails/audience";
import { renderEventUpdate } from "@/lib/event-emails/process";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export interface ScheduledEmailActionState {
  error: string | null;
  ok: string | null;
  // Echoed on error so React 19's form reset never wipes a drafted
  // email (losing a full body draft is the worst case of this bug).
  values: EchoedValues | null;
}

export async function createScheduledEmailAction(
  _prev: ScheduledEmailActionState,
  formData: FormData,
): Promise<ScheduledEmailActionState> {
  const ctx = await requireSuperAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audienceRaw = String(formData.get("audience") ?? "");
  const sendAtRaw = String(formData.get("sendAt") ?? "").trim();

  if (!subject || subject.length > 200) return { error: "Subject is required (max 200 characters).", ok: null, values: echoFormValues(formData) };
  if (!body) return { error: "The email needs a body.", ok: null, values: echoFormValues(formData) };
  const audience = SCHEDULED_EMAIL_AUDIENCES.includes(audienceRaw as ScheduledEmailAudience)
    ? (audienceRaw as ScheduledEmailAudience)
    : null;
  if (!audience) return { error: "Pick an audience.", ok: null, values: echoFormValues(formData) };
  // datetime-local arrives without a zone; the admin thinks in UK time.
  // Store the instant the UK wall-clock value means.
  const sendAt = sendAtRaw ? new Date(sendAtRaw) : null;
  if (!sendAt || Number.isNaN(sendAt.getTime())) {
    return { error: "Pick a send date and time.", ok: null, values: echoFormValues(formData) };
  }
  if (sendAt.getTime() < Date.now() - 60_000) {
    return { error: "That send time is in the past.", ok: null, values: echoFormValues(formData) };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.from("scheduled_emails").insert({
    subject,
    body,
    audience,
    send_at: sendAt.toISOString(),
    created_by: ctx.appUserId,
  });
  if (error) {
    console.error("[admin/emails] schedule failed:", error.message);
    return { error: "Could not schedule the email. Try again.", ok: null, values: echoFormValues(formData) };
  }

  await logAdminAction(ctx.appUserId, "event_email.schedule", {
    subject,
    audience,
    send_at: sendAt.toISOString(),
  });
  revalidatePath("/admin/emails");
  return { error: null, ok: `Scheduled. Recipients are resolved when it sends, so late bookers are included.`, values: null };
}

// Immediate send of the draft content to the signed-in admin only.
// Touches no recipient rows and works before anything is scheduled.
export async function testSendAction(
  _prev: ScheduledEmailActionState,
  formData: FormData,
): Promise<ScheduledEmailActionState> {
  const ctx = await requireSuperAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Fill in subject and body first.", ok: null, values: echoFormValues(formData) };

  const { data: me } = await ctx.client
    .from("users")
    .select("email")
    .eq("id", ctx.appUserId)
    .maybeSingle();
  const email = (me as { email: string } | null)?.email;
  if (!email) return { error: "Could not find your email address.", ok: null, values: echoFormValues(formData) };

  try {
    const { html, text } = await renderEventUpdate({ subject, body });
    await sendTransactionalEmail({
      to: email,
      subject: `[TEST] ${subject}`,
      html,
      text,
      tag: "event-update-test",
    });
    return { error: null, ok: "Test sent to you. Check your inbox before scheduling.", values: echoFormValues(formData) };
  } catch (err) {
    console.error("[admin/emails] test send failed:", err);
    return { error: "Test send failed. Check the Vercel logs.", ok: null, values: echoFormValues(formData) };
  }
}

// Cancel while scheduled; Stop while sending (remaining pending rows
// are left unprocessed and visible). Nothing is deleted either way.
export async function cancelScheduledEmailAction(emailId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("id", emailId)
    .in("status", ["scheduled", "sending"]);
  if (error) throw new Error(`cancel failed: ${error.message}`);
  await logAdminAction(ctx.appUserId, "event_email.cancel", { scheduled_email_id: emailId });
  revalidatePath("/admin/emails");
}

// Flip failed recipients back to pending and re-open the email so the
// next cron tick retries them. Sent rows are untouched (idempotency).
export async function retryFailedAction(emailId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error: rowsErr } = await service
    .from("scheduled_email_sends")
    .update({ status: "pending", error: null })
    .eq("scheduled_email_id", emailId)
    .eq("status", "failed");
  if (rowsErr) throw new Error(`retry reset failed: ${rowsErr.message}`);
  const { error: emailErr } = await service
    .from("scheduled_emails")
    .update({ status: "sending", completed_at: null })
    .eq("id", emailId)
    .in("status", ["sent", "sending"]);
  if (emailErr) throw new Error(`retry reopen failed: ${emailErr.message}`);
  await logAdminAction(ctx.appUserId, "event_email.retry_failed", {
    scheduled_email_id: emailId,
  });
  revalidatePath("/admin/emails");
}
