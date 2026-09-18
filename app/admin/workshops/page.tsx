import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { publishWorkshopAction, unpublishWorkshopAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin workshops · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AdminWorkshopRow {
  id: string;
  title: string;
  speaker_name: string | null;
  room: string | null;
  starts_at: string;
  ends_at: string;
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
    .order("starts_at", { ascending: true });

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
          <Link
            href="/admin/workshops/new"
            className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
          >
            New workshop
          </Link>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        Workshops are created as drafts; publish when ready and they appear
        on /workshops. Booking opens 1 January (VIPs) and 4 January
        (everyone), enforced server-side. Unpublishing hides a workshop but
        keeps its bookings.
      </p>

      {status === "created" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Workshop created as a draft. Publish it when the details are final.
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Workshop saved.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No workshops yet. Eight are planned for the day; create the first
          one above.
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
                      {ukTime(w.starts_at)} to {ukTime(w.ends_at)}
                      {w.room ? ` · ${w.room}` : ""}
                      {w.speaker_name ? ` · ${w.speaker_name}` : ""} · {booked}/{w.capacity} booked ·{" "}
                      {w.published_at ? "Published" : "Draft"}
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
                      Edit
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
    </div>
  );
}
