import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { updateWorkshopAction } from "../../actions";
import { WorkshopForm } from "../../WorkshopForm";

export const metadata: Metadata = {
  title: "Edit workshop · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  title: string;
  description: string;
  speaker_name: string | null;
  room: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  published_at: string | null;
}

// Stored UTC instants are the UK wall-clock times (January = GMT), so
// slicing the ISO string gives the right datetime-local value.
function toLocalInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("workshops")
    .select(
      "id, title, description, speaker_name, room, starts_at, ends_at, capacity, published_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const workshop = data as unknown as Row | null;
  if (!workshop) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/workshops"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to workshops
      </Link>
      <h1 className="mt-4 text-h1">Edit workshop</h1>
      <p className="mt-3 text-small text-ignite-muted">
        {workshop.published_at
          ? "This workshop is published; changes appear on /workshops as soon as you save."
          : "This workshop is a draft."}
      </p>
      <div className="mt-8">
        <WorkshopForm
          action={updateWorkshopAction.bind(null, workshop.id)}
          submitLabel="Save workshop"
          defaults={{
            title: workshop.title,
            description: workshop.description,
            speakerName: workshop.speaker_name ?? "",
            room: workshop.room ?? "",
            startsAt: toLocalInput(workshop.starts_at),
            endsAt: toLocalInput(workshop.ends_at),
            capacity: String(workshop.capacity),
          }}
        />
      </div>
    </div>
  );
}
