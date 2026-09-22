import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { createWorkshopAction } from "../actions";
import { WorkshopForm } from "../WorkshopForm";

export const metadata: Metadata = {
  title: "New workshop · IGNITE! 27",
  robots: { index: false, follow: false },
};

export default async function NewWorkshopPage() {
  const { client } = await requireSuperAdmin();

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
      <h1 className="mt-4 text-h1">New workshop</h1>
      <p className="mt-3 text-small text-ignite-muted">
        Created as a draft; publish it from the workshops list when the
        details are final. Event day is Thursday 21 January 2027.
      </p>
      <div className="mt-8">
        <WorkshopForm
          action={createWorkshopAction}
          submitLabel="Create draft workshop"
          hostOptions={hostOptions}
          defaults={{
            title: "",
            description: "",
            speakerName: "",
            hostProfileId: "",
            room: "",
            startsAt: "2027-01-21T10:00",
            endsAt: "2027-01-21T11:00",
            capacity: "30",
          }}
        />
      </div>
    </div>
  );
}
