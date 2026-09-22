import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { updateAgendaItemAction } from "../../actions";
import { AgendaItemForm } from "../../AgendaItemForm";

export const metadata: Metadata = {
  title: "Edit agenda item · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  title: string;
  description: string;
  speaker_name: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  published_at: string | null;
}

// Stored UTC instants are the UK wall-clock times (January = GMT).
function toLocalInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export default async function EditAgendaItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("agenda_items")
    .select("id, title, description, speaker_name, location, starts_at, ends_at, published_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const item = data as unknown as Row | null;
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/agenda"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to agenda
      </Link>
      <h1 className="mt-4 text-h1">Edit agenda item</h1>
      <p className="mt-3 text-small text-ignite-muted">
        {item.published_at
          ? "Published; changes appear on /my-day as soon as you save."
          : "This item is a draft."}
      </p>
      <div className="mt-8">
        <AgendaItemForm
          action={updateAgendaItemAction.bind(null, item.id)}
          submitLabel="Save agenda item"
          defaults={{
            title: item.title,
            description: item.description,
            speakerName: item.speaker_name ?? "",
            location: item.location ?? "",
            startsAt: toLocalInput(item.starts_at),
            endsAt: toLocalInput(item.ends_at),
          }}
        />
      </div>
    </div>
  );
}
