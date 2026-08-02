import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { getResend } from "./client";
import { buildFromAddress } from "./from";

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
  const from = buildFromAddress(env.resendFromEmail());
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    replyTo: replyTo ?? env.resendReplyToEmail(),
    tags: tag ? [{ name: "template", value: tag }] : undefined,
  });

  if (result.error) {
    // LOUD failure: log the full Resend error response plus send context
    // so domain-verification / auth failures are visible in production
    // logs, not reduced to a one-line message. (This class of failure
    // silently ate booking confirmations when the from-domain was not
    // verified with Resend.)
    console.error(
      "[resend] SEND FAILED",
      JSON.stringify({
        error: result.error, // full Resend error object: name, message, statusCode
        from,
        to: redactEmail(to),
        subject,
        tag,
      }),
    );
    const e = result.error as { name?: string; message: string; statusCode?: number };
    throw new Error(
      `resend send failed: ${e.name ?? "error"}${e.statusCode ? ` (${e.statusCode})` : ""}: ${e.message}`,
    );
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
