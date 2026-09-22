import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Speaker messages · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface MessageRow {
  id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  relayed_at: string | null;
  relay_error: string | null;
  created_at: string;
}

function ukDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export default async function SpeakerMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data: speakerData, error: speakerErr } = await client
    .from("speaker_profiles")
    .select("id, display_name, slug, enquiries_email, users ( email )")
    .eq("id", id)
    .maybeSingle();
  if (speakerErr) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {speakerErr.message}
      </p>
    );
  }
  const speaker = speakerData as unknown as {
    id: string;
    display_name: string;
    slug: string;
    enquiries_email: string | null;
    users: { email: string } | null;
  } | null;
  if (!speaker) notFound();

  const { data, error } = await client
    .from("speaker_messages")
    .select("id, sender_name, sender_email, message, relayed_at, relay_error, created_at")
    .eq("speaker_profile_id", id)
    .order("created_at", { ascending: false });
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const messages = (data ?? []) as unknown as MessageRow[];
  const relayTarget = speaker.enquiries_email ?? speaker.users?.email ?? null;

  return (
    <div>
      <Link
        href="/admin/speakers"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to speakers
      </Link>
      <h1 className="mt-4 text-h1">Messages for {speaker.display_name}</h1>
      <p className="mt-2 text-small text-ignite-muted">
        {relayTarget
          ? `Relayed to ${relayTarget} with reply-to set to the sender.`
          : "No relay address yet (account-less page with no enquiries email): messages are stored here only."}
      </p>

      {messages.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No messages yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {messages.map((m) => (
            <div key={m.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <p className="text-small text-ignite-muted">
                {ukDateTime(m.created_at)} ·{" "}
                <span className="font-semibold text-ignite-ink">{m.sender_name}</span> ·{" "}
                {m.sender_email} ·{" "}
                {m.relayed_at
                  ? "relayed"
                  : m.relay_error
                    ? `relay failed: ${m.relay_error}`
                    : "not relayed"}
              </p>
              <p className="mt-3 whitespace-pre-line text-body text-ignite-ink">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
