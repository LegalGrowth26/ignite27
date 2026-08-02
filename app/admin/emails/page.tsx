import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";

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

export default async function AdminEmailsPage() {
  await requireSuperAdmin();
  return (
    <div>
      <h1 className="text-h1">Email lists</h1>
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
