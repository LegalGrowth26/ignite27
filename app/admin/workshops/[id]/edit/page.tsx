import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { WORKSHOP_ROOMS } from "@/lib/workshops/config";
import { updateWorkshopScheduleAction } from "../../actions";
import { WorkshopScheduleForm } from "../../WorkshopForm";

export const metadata: Metadata = {
  title: "Schedule workshop · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  title: string;
  description: string;
  speaker_name: string | null;
  host_profile_id: string | null;
  room: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number;
  published_at: string | null;
}

// Stored UTC instants are the UK wall-clock times (January = GMT), so
// slicing the ISO string gives the right datetime-local value.
function toLocalInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
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
      "id, title, description, speaker_name, host_profile_id, room, starts_at, ends_at, capacity, published_at",
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

  const { data: hostRows } = await client
    .from("speaker_profiles")
    .select("id, display_name")
    .in("profile_type", ["workshop_host", "both"])
    .order("display_name", { ascending: true });
  const hostOptions = ((hostRows ?? []) as Array<{ id: string; display_name: string }>).map(
    (h) => ({ id: h.id, name: h.display_name }),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/workshops"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to workshops
      </Link>
      <h1 className="mt-4 text-h1">Schedule workshop</h1>
      <p className="mt-3 text-small text-ignite-muted">
        {workshop.published_at
          ? "This workshop is published; schedule changes appear on /workshops as soon as you save."
          : "This workshop is unpublished (hidden from /workshops)."}
      </p>

      <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-cream p-5">
        <p className="text-small font-semibold uppercase tracking-wide text-ignite-muted">
          The host&apos;s content (read-only here)
        </p>
        <p className="mt-2 text-h3">{workshop.title}</p>
        {workshop.description ? (
          <p className="mt-2 whitespace-pre-line text-small text-ignite-ink">
            {workshop.description}
          </p>
        ) : (
          <p className="mt-2 text-small text-ignite-muted">No description yet.</p>
        )}
        <p className="mt-3 text-small text-ignite-muted">
          Title and description come from the host&apos;s own editor. To fix
          something on their behalf, edit their profile in /admin/speakers;
          it syncs here on save. Capacity is fixed at {workshop.capacity}.
        </p>
      </div>

      <div className="mt-8">
        <WorkshopScheduleForm
          action={updateWorkshopScheduleAction.bind(null, workshop.id)}
          rooms={WORKSHOP_ROOMS}
          hostOptions={hostOptions}
          defaults={{
            speakerName: workshop.speaker_name ?? "",
            hostProfileId: workshop.host_profile_id ?? "",
            room: workshop.room ?? "",
            startsAt: toLocalInput(workshop.starts_at),
            endsAt: toLocalInput(workshop.ends_at),
          }}
        />
      </div>
    </div>
  );
}
