import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { getResend } from "./client";

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Separate reply-to. Defaults to RESEND_REPLY_TO_EMAIL.
  replyTo?: string;
  // Optional tag Resend-side for searching.
  tag?: string;
}

export interface TransactionalEmailResult {
  dispatched: boolean;
  reason?: "allowlist_blocked" | "sent";
  providerMessageId?: string;
}

async function isOnAllowlist(email: string): Promise<boolean> {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("email_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.warn("[resend] allowlist lookup failed:", error.message);
    return false;
  }
  return Boolean(data);
}

// Send a transactional email via Resend. In non-prod environments, recipients
// must be on email_allowlist or the send is silently skipped and logged.
// Callers should treat any thrown error as non-fatal (log and continue).
export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<TransactionalEmailResult> {
  const { to, subject, html, text, replyTo, tag } = input;

  if (env.emailAllowlistEnabled()) {
    const ok = await isOnAllowlist(to);
    if (!ok) {
      console.info(
        "[resend] allowlist blocked send",
        JSON.stringify({ to: redactEmail(to), subject, tag }),
      );
      return { dispatched: false, reason: "allowlist_blocked" };
    }
  }

  const resend = getResend();
  const result = await resend.emails.send({
    from: env.resendFromEmail(),
    to,
    subject,
    html,
    text,
    replyTo: replyTo ?? env.resendReplyToEmail(),
    tags: tag ? [{ name: "template", value: tag }] : undefined,
  });

  if (result.error) {
    throw new Error(`resend send failed: ${result.error.message}`);
  }

  console.info(
    "[resend] sent",
    JSON.stringify({
      to: redactEmail(to),
      subject,
      tag,
      providerMessageId: result.data?.id ?? null,
    }),
  );
  return { dispatched: true, reason: "sent", providerMessageId: result.data?.id };
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[redacted]";
  const shown = local.slice(0, 1);
  return `${shown}***@${domain}`;
}
