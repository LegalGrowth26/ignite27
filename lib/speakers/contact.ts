import type { SupabaseClient } from "@supabase/supabase-js";

// "Get in touch with <speaker>" contact form: validation and the
// rate-limit rules. The relay itself lives in the page action; this
// module keeps the testable parts pure and the DB checks in one place.
//
// Spam defence (approved):
//   - honeypot: a hidden "company" field real people never see. Bots
//     fill it; those submissions are ACCEPTED-shaped but dropped.
//   - per-IP: max 5 messages per rolling hour across all speakers.
//   - per-speaker: max 20 messages per rolling day (flood backstop).
// Both counts come from speaker_messages, so they hold across lambdas.

export const CONTACT_MAX_PER_IP_PER_HOUR = 5;
export const CONTACT_MAX_PER_SPEAKER_PER_DAY = 20;

const MAX_NAME = 100;
const MAX_MESSAGE = 2000;

export interface ContactInput {
  senderName: string;
  senderEmail: string;
  message: string;
}

export type ContactValidation =
  | { ok: true; value: ContactInput; honeypotTripped: boolean }
  | { ok: false; error: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateContactMessage(input: {
  senderName?: unknown;
  senderEmail?: unknown;
  message?: unknown;
  company?: unknown; // the honeypot: humans never see it, so it must be empty
}): ContactValidation {
  const honeypotTripped = str(input.company).length > 0;

  const senderName = str(input.senderName);
  if (!senderName || senderName.length > MAX_NAME) {
    return { ok: false, error: "We need your name." };
  }

  const senderEmail = str(input.senderEmail).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail) || senderEmail.length > 200) {
    return { ok: false, error: "We need a valid email so they can reply to you." };
  }

  const message = str(input.message);
  if (message.length < 10) {
    return { ok: false, error: "Tell them a little more than that." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: `Keep the message under ${MAX_MESSAGE} characters.` };
  }

  return { ok: true, value: { senderName, senderEmail, message }, honeypotTripped };
}

export type RateLimitResult = "ok" | "ip_limited" | "speaker_limited";

// DB-backed rolling-window counts. A failed count fails OPEN with a
// loud log: a Supabase blip should not take the contact form down,
// and the honeypot still stands in front of it.
export async function checkContactRateLimits(
  service: SupabaseClient,
  senderIp: string,
  speakerProfileId: string,
): Promise<RateLimitResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: ipCount, error: ipErr } = await service
    .from("speaker_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_ip", senderIp)
    .gte("created_at", hourAgo);
  if (ipErr) {
    console.error("[speaker-contact] ip rate-limit count failed:", ipErr.message);
  } else if ((ipCount ?? 0) >= CONTACT_MAX_PER_IP_PER_HOUR) {
    return "ip_limited";
  }

  const { count: speakerCount, error: spErr } = await service
    .from("speaker_messages")
    .select("id", { count: "exact", head: true })
    .eq("speaker_profile_id", speakerProfileId)
    .gte("created_at", dayAgo);
  if (spErr) {
    console.error("[speaker-contact] speaker rate-limit count failed:", spErr.message);
  } else if ((speakerCount ?? 0) >= CONTACT_MAX_PER_SPEAKER_PER_DAY) {
    return "speaker_limited";
  }

  return "ok";
}
