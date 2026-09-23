import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { publishWorkshopAction, unpublishWorkshopAction } from "./actions";
import { resendHostInviteAction } from "./host-actions";
import { AddHostInviteeForm, InviteHostForm } from "./HostForms";

export const metadata: Metadata = {
  title: "Admin workshops · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface HostProfileRow {
  id: string;
  slug: string;
  display_name: string;
  talk_title: string; // the host's workshop title (their editor writes it)
  user_id: string | null;
  published_at: string | null;
  users: { email: string } | null;
}

const HOST_STATUS_NOTES: Record<string, string> = {
  invitee_added: "Draft invitee added. Attach their email below to send the invite.",
  invited:
    "Invite sent: account created, page live, 2 comp tickets and their 20% code are ready.",
  invited_perks_partial:
    "Invite sent and account created, but part of the perks setup (code or ambassador row) failed. Check the logs, then Resend invite to retry; nothing will be duplicated.",
  invited_email_failed:
    "Account and perks are set up, but the email failed to send. Use Resend invite.",
};

interface AdminWorkshopRow {
  id: string;
  title: string;
  speaker_name: string | null;
  room: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number;
  published_at: string | null;
  workshop_bookings: Array<{ count: number }>;
}

function ukTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

function scheduleLabel(w: AdminWorkshopRow): string {
  if (!w.starts_at || !w.ends_at) {
    return w.room ? `Not scheduled yet · ${w.room}` : "Not scheduled yet";
  }
  return `${ukTime(w.starts_at)} to ${ukTime(w.ends_at)}${w.room ? ` · ${w.room}` : ""}`;
}

export default async function AdminWorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status } = await searchParams;

  const { data, error } = await client
    .from("workshops")
    .select(
      "id, title, speaker_name, room, starts_at, ends_at, capacity, published_at, workshop_bookings(count)",
    )
    .order("starts_at", { ascending: true, nullsFirst: false });

  const { data: hostData, error: hostErr } = await client
    .from("speaker_profiles")
    .select("id, slug, display_name, talk_title, user_id, published_at, users ( email )")
    .in("profile_type", ["workshop_host", "both"])
    .order("created_at", { ascending: true });
  if (hostErr) console.error("[admin/workshops] hosts query failed:", hostErr.message);
  const hosts = ((hostData ?? []) as unknown as HostProfileRow[]);

  if (error) {
    return (
      <div>
        <h1 className="text-h1">Workshops</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">
            Could not load workshops.
          </p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table (workshops), the 20260506
            migration has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as AdminWorkshopRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Workshops</h1>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/admin/workshops/export"
            className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
          >
            Export attendee CSV
          </a>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Hosts write their own workshop (title, description, images) from
        their /speaker editor; it appears on /workshops automatically as
        &quot;time and room to be confirmed&quot;. You schedule the room and
        times from Schedule below, updating the live page in place. Every
        room seats 24. Booking opens 1 January (VIPs) and 4 January
        (everyone), enforced server-side. Unpublish is the safety net: it
        hides a workshop but keeps its bookings.
      </p>

      {status && HOST_STATUS_NOTES[status] ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          {HOST_STATUS_NOTES[status]}
        </p>
      ) : null}

      {status === "saved" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Schedule saved.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No workshops yet. They appear here as soon as a host completes
          their workshop details in their editor.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((w) => {
            const booked = w.workshop_bookings?.[0]?.count ?? 0;
            return (
              <div key={w.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">{w.title}</p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {scheduleLabel(w)}
                      {w.speaker_name ? ` · ${w.speaker_name}` : ""} · {booked}/{w.capacity} booked ·{" "}
                      {w.published_at ? "Published" : "Unpublished"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/workshops/${w.id}`}
                      className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                    >
                      Attendees ({booked})
                    </Link>
                    <Link
                      href={`/admin/workshops/${w.id}/edit`}
                      className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                    >
                      Schedule
                    </Link>
                    {w.published_at ? (
                      <form action={unpublishWorkshopAction.bind(null, w.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Unpublish
                        </button>
                      </form>
                    ) : (
                      <form action={publishWorkshopAction.bind(null, w.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Publish
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-12 text-h2">Workshop hosts</h2>
      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Invite hosts from here with a name, an email, and (optionally) a
        personal line for the invite. That sends the full kit: account, live
        page at /speakers/&lt;slug&gt;, 2 comp tickets, and their personal
        20% code (everything except lunch). The host writes their own
        workshop from their editor; it goes live on /workshops the moment
        they save it, and you schedule the room and time above.
      </p>

      <div className="mt-4 rounded-2xl border border-ignite-line bg-ignite-white p-5">
        <AddHostInviteeForm />
      </div>

      {hosts.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No hosts yet. Run the one-off seed (POST /admin/host-invitees-seed
          while signed in as a super admin) to load the draft invite list, or
          add one above.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {hosts.map((h) => (
            <div key={h.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-h3">{h.display_name}</p>
                  <p className="mt-1 text-small text-ignite-muted">
                    {h.talk_title || "No workshop content yet"} ·{" "}
                    {h.published_at ? `Live at /speakers/${h.slug}` : "Draft (page unpublished)"} ·{" "}
                    {h.user_id ? `Invited: ${h.users?.email ?? "linked"}` : "Not invited yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {h.user_id ? (
                    <>
                      <Link
                        href={`/admin/speakers/${h.id}/edit`}
                        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                      >
                        Edit page
                      </Link>
                      <form action={resendHostInviteAction.bind(null, h.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          Resend invite
                        </button>
                      </form>
                    </>
                  ) : (
                    <InviteHostForm profileId={h.id} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
