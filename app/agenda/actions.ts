"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export type SubscribeAgendaUpdatesResult =
  | { ok: true }
  | { ok: false; error: string };

const AGENDA_SOURCE = "agenda_page";
const MAX_UA_LENGTH = 500;

const InputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "We need an email so we can let you know.")
    .max(200, "That email looks too long.")
    .email("That email does not look right.")
    .transform((value) => value.toLowerCase()),
  // Tightly bound to the agenda form: the client MUST have ticked the
  // agenda-alert box. We enforce server-side, not just UI.
  wantsAgendaAlert: z.literal(true, {
    message: "Tick the box to confirm you want the agenda alert.",
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

export async function subscribeAgendaUpdatesAction(
  rawInput: unknown,
): Promise<SubscribeAgendaUpdatesResult> {
  const parsed = InputSchema.safeParse(rawInput);
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
        source: AGENDA_SOURCE,
        wants_agenda_alert: true,
        wants_marketing: wantsMarketing,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      { onConflict: "email,source" },
    );

  if (error) {
    console.error("[agenda-signup] upsert failed:", error.message);
    return {
      ok: false,
      error: "We could not save your details. Try again in a moment.",
    };
  }

  // Anti-enumeration: always return ok on a valid submission, regardless of
  // whether this email was new or already on the list.
  return { ok: true };
}
