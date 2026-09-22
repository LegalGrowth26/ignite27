"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkContactRateLimits,
  validateContactMessage,
} from "@/lib/speakers/contact";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// "Get in touch with <speaker>": relays via the Resend choke point TO
// the speaker (enquiries_email, else their account email), reply-to
// the sender so the speaker replies directly. The speaker's address is
// never rendered anywhere. Every message is stored (admin-visible) and
// the stored rows drive the rate limits.

function deriveClientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return realIp ?? "0.0.0.0";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendSpeakerMessageAction(
  slug: string,
  formData: FormData,
): Promise<void> {
  const back = `/speakers/${slug}`;
  const fail = (message: string) =>
    redirect(`${back}?contact_error=${encodeURIComponent(message)}#contact`);

  const validated = validateContactMessage({
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
    message: formData.get("message"),
    company: formData.get("company"), // honeypot
  });
  if (!validated.ok) fail(validated.error);
  if (!validated.ok) return; // unreachable; narrows the type

  // Honeypot: pretend success, deliver nothing, store nothing.
  if (validated.honeypotTripped) {
    redirect(`${back}?contact=sent#contact`);
  }

  const service = createSupabaseServiceClient();

  const { data: profileData, error: profileErr } = await service
    .from("speaker_profiles")
    .select("id, display_name, enquiries_email, published_at, users ( email )")
    .eq("slug", slug)
    .maybeSingle();
  if (profileErr || !profileData) {
    fail("Something went wrong. Try again.");
    return;
  }
  const profile = profileData as unknown as {
    id: string;
    display_name: string;
    enquiries_email: string | null;
    published_at: string | null;
    users: { email: string } | null;
  };
  if (!profile.published_at) fail("This page is not taking messages right now.");

  const relayTo = profile.enquiries_email ?? profile.users?.email ?? null;
  if (!relayTo) {
    fail("This speaker is not taking messages yet. Try again nearer the event.");
    return;
  }

  const headerList = await headers();
  const senderIp = deriveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );

  const limit = await checkContactRateLimits(service, senderIp, profile.id);
  if (limit === "ip_limited") {
    fail("You have sent a few messages recently. Try again in an hour.");
  }
  if (limit === "speaker_limited") {
    fail("This speaker's inbox is busy today. Try again tomorrow.");
  }

  const v = validated.value;

  // Store first: the admin copy and the rate-limit ledger must exist
  // even if the relay then fails.
  const { data: messageRow, error: insertErr } = await service
    .from("speaker_messages")
    .insert({
      speaker_profile_id: profile.id,
      sender_name: v.senderName,
      sender_email: v.senderEmail,
      message: v.message,
      sender_ip: senderIp,
    })
    .select("id")
    .single();
  if (insertErr || !messageRow) {
    console.error("[speaker-contact] message insert failed:", insertErr?.message);
    fail("Something went wrong. Try again.");
    return;
  }
  const messageId = (messageRow as { id: string }).id;

  const safeName = escapeHtml(v.senderName);
  const safeMessage = escapeHtml(v.message).replace(/\n/g, "<br />");
  const html = [
    `<p><strong>${safeName}</strong> (${escapeHtml(v.senderEmail)}) sent you a message via your IGNITE! 27 speaker page:</p>`,
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #E11D2E;color:#111418;">${safeMessage}</blockquote>`,
    `<p>Reply to this email to answer them directly.</p>`,
  ].join("");
  const text = [
    `${v.senderName} (${v.senderEmail}) sent you a message via your IGNITE! 27 speaker page:`,
    "",
    v.message,
    "",
    "Reply to this email to answer them directly.",
  ].join("\n");

  try {
    const result = await sendTransactionalEmail({
      to: relayTo,
      subject: `New message from ${v.senderName} via your IGNITE! 27 page`,
      html,
      text,
      replyTo: v.senderEmail,
      tag: "speaker-contact",
    });
    await service
      .from("speaker_messages")
      .update(
        result.dispatched
          ? { relayed_at: new Date().toISOString() }
          : { relay_error: result.reason ?? "not dispatched" },
      )
      .eq("id", messageId);
  } catch (err) {
    console.error("[speaker-contact] relay failed:", err);
    await service
      .from("speaker_messages")
      .update({ relay_error: err instanceof Error ? err.message : "relay failed" })
      .eq("id", messageId);
    // The message is stored and admin-visible; do not fail the sender.
  }

  redirect(`${back}?contact=sent#contact`);
}
