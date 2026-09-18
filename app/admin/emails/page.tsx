import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { AUDIENCE_LABELS, type ScheduledEmailAudience } from "@/lib/event-emails/audience";
import { cancelScheduledEmailAction, retryFailedAction } from "./actions";
import { ScheduleEmailForm } from "./ScheduleEmailForm";

export const metadata: Metadata = {
  title: "Admin email lists · IGNITE! 27",
  robots: { index: false, follow: false },
};

const LISTS = [
  {
    href: "/admin/emails/export/delegates",
    label: "All delegate emails",
    detail: "Every attendee on a paid or comp delegate/VIP booking. One row per unique email.",
  },
  {
    href: "/admin/emails/export/exhibitors",
    label: "All exhibitor emails",
    detail: "Exhibitor booking contacts and their attendees. One row per unique email.",
  },
  {
    href: "/admin/emails/export/signups",
    label: "All signup-list emails",
    detail: "Agenda and speaker alert signups from the marketing pages, with consent flags.",
  },
] as const;

interface ScheduledEmailListRow {
  id: string;
  subject: string;
  audience: ScheduledEmailAudience;
  send_at: string;
  status: "scheduled" | "sending" | "sent" | "cancelled";
}

function formatUk(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AdminEmailsPage() {
  const { client } = await requireSuperAdmin();

  const { data: emailData, error: emailErr } = await client
    .from("scheduled_emails")
    .select("id, subject, audience, send_at, status")
    .order("send_at", { ascending: false })
    .limit(50);
  if (emailErr) console.error("[admin/emails] scheduled list error:", emailErr.message);
  const scheduled = (emailData ?? []) as ScheduledEmailListRow[];

  // Per-email sent/failed/pending counts, aggregated in one pass.
  const { data: sendRows } = await client
    .from("scheduled_email_sends")
    .select("scheduled_email_id, status");
  const countsByEmail = new Map<string, { sent: number; failed: number; pending: number }>();
  for (const r of (sendRows ?? []) as Array<{ scheduled_email_id: string; status: string }>) {
    const c = countsByEmail.get(r.scheduled_email_id) ?? { sent: 0, failed: 0, pending: 0 };
    if (r.status === "sent") c.sent += 1;
    else if (r.status === "failed") c.failed += 1;
    else c.pending += 1;
    countsByEmail.set(r.scheduled_email_id, c);
  }

  return (
    <div>
      <h1 className="text-h1">Emails</h1>

      <h2 className="mt-8 text-h2">Pre-event emails</h2>
      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Scheduled event-service emails to ticket holders: reminders,
        travel and parking, agenda updates, the day-before practical
        email. Recipients are resolved when the email sends, so late
        bookers are always included. These are transactional; promotional
        sends route through TomCRM (GoHighLevel), not here.
      </p>

      <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
        <h3 className="text-h3">Schedule a send</h3>
        <div className="mt-4">
          <ScheduleEmailForm />
        </div>
      </div>

      {scheduled.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {scheduled.map((e) => {
            const counts = countsByEmail.get(e.id) ?? { sent: 0, failed: 0, pending: 0 };
            return (
              <div key={e.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-h3">{e.subject}</p>
                    <p className="mt-1 text-small text-ignite-muted">
                      {AUDIENCE_LABELS[e.audience]} · {formatUk(e.send_at)} UK ·{" "}
                      <span className="font-semibold uppercase">{e.status}</span>
                    </p>
                    <p className="mt-1 text-small text-ignite-muted">
                      Sent {counts.sent} · Failed {counts.failed} · Pending {counts.pending}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status === "scheduled" || e.status === "sending" ? (
                      <form action={cancelScheduledEmailAction.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                        >
                          {e.status === "scheduled" ? "Cancel" : "Stop remaining"}
                        </button>
                      </form>
                    ) : null}
                    {counts.failed > 0 && e.status !== "cancelled" ? (
                      <form action={retryFailedAction.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Retry failed
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <h2 className="mt-12 text-h2">Email lists</h2>
      <p className="mt-3 max-w-2xl text-body text-ignite-muted">
        One-click CSVs for marketing sends. The signups list includes the
        marketing consent flag; respect it when importing into a campaign
        tool.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {LISTS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-ignite-line bg-ignite-white p-6 transition-colors hover:border-ignite-red"
          >
            <p className="text-h3 text-ignite-ink">{l.label}</p>
            <p className="mt-2 text-small text-ignite-muted">{l.detail}</p>
            <p className="mt-4 text-small font-semibold text-ignite-red">Download CSV</p>
          </a>
        ))}
      </div>
    </div>
  );
}
