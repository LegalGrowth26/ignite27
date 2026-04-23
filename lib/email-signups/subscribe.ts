import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Shared helper used by each "notify me" surface on the site
// (currently /agenda and /speakers). Page-level server actions
// translate their form-specific field names into this shape and
// call here; the helper owns validation, IP/UA capture, and the
// upsert against public.email_signups. Adding a new capture
// surface is a two-line action plus a page + form component.

export type SubscribeToEmailListInput = {
  source: string;
  email: unknown;
  wantsAlert: unknown;
  wantsMarketing: unknown;
};

export type SubscribeToEmailListResult =
  | { ok: true }
  | { ok: false; error: string };

const MAX_UA_LENGTH = 500;

const PayloadSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "We need an email so we can let you know.")
    .max(200, "That email looks too long.")
    .email("That email does not look right.")
    .transform((value) => value.toLowerCase()),
  // Generic required-alert flag. The UI provides a context-specific
  // label (e.g. "Notify me when the agenda is announced."); this
  // server-side check is only a safety net for submissions that
  // bypassed the form.
  wantsAlert: z.literal(true, {
    message: "Tick the box to confirm you want email updates.",
  }),
  wantsMarketing: z.boolean(),
});

function deriveClientIp(forwardedFor: string | null, realIp: string | null): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }
  if (realIp && realIp.length > 0) return realIp;
  return null;
}

export async function subscribeToEmailList(
  input: SubscribeToEmailListInput,
): Promise<SubscribeToEmailListResult> {
  const parsed = PayloadSchema.safeParse({
    email: input.email,
    wantsAlert: input.wantsAlert,
    wantsMarketing: input.wantsMarketing,
  });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Check the form and try again.";
    return { ok: false, error: firstError };
  }
  const { email, wantsMarketing } = parsed.data;

  const headerList = await headers();
  const ipAddress = deriveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );
  const userAgent = (headerList.get("user-agent") ?? "").slice(0, MAX_UA_LENGTH) || null;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("email_signups")
    .upsert(
      {
        email,
        source: input.source,
        // Boolean opt-in flag. True for every row we insert here because
        // validation above already enforced wantsAlert=true. The source
        // column is the authoritative "what did they ask to be told about".
        wants_topic_alert: true,
        wants_marketing: wantsMarketing,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      { onConflict: "email,source" },
    );

  if (error) {
    console.error("[email-signup] upsert failed:", error.message);
    return {
      ok: false,
      error: "We could not save your details. Try again in a moment.",
    };
  }

  // Anti-enumeration: always return ok on a valid submission, regardless of
  // whether this email was new or already on the list.
  return { ok: true };
}
