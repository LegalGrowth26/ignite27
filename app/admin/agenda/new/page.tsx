import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { createAgendaItemAction } from "../actions";
import { AgendaItemForm } from "../AgendaItemForm";

export const metadata: Metadata = {
  title: "New agenda item · IGNITE! 27",
  robots: { index: false, follow: false },
};

export default async function NewAgendaItemPage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/agenda"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to agenda
      </Link>
      <h1 className="mt-4 text-h1">New agenda item</h1>
      <p className="mt-3 text-small text-ignite-muted">
        Created as a draft; publish it from the agenda list when the time is
        fixed. Event day is Thursday 21 January 2027.
      </p>
      <div className="mt-8">
        <AgendaItemForm
          action={createAgendaItemAction}
          submitLabel="Create draft item"
          defaults={{
            title: "",
            description: "",
            speakerName: "",
            location: "",
            startsAt: "2027-01-21T09:30",
            endsAt: "2027-01-21T10:00",
          }}
        />
      </div>
    </div>
  );
}
