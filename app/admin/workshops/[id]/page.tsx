import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Workshop attendees · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface WorkshopRow {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  room: string | null;
  capacity: number;
  published_at: string | null;
}

interface BookingRow {
  created_at: string;
  users: {
    first_name: string | null;
    surname: string | null;
    email: string;
    company: string | null;
  } | null;
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

export default async function WorkshopAttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data: workshopData, error: workshopErr } = await client
    .from("workshops")
    .select("id, title, starts_at, ends_at, room, capacity, published_at")
    .eq("id", id)
    .maybeSingle();
  if (workshopErr) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {workshopErr.message}
      </p>
    );
  }
  const workshop = workshopData as unknown as WorkshopRow | null;
  if (!workshop) notFound();

  const { data: bookingsData, error: bookingsErr } = await client
    .from("workshop_bookings")
    .select("created_at, users ( first_name, surname, email, company )")
    .eq("workshop_id", id)
    .order("created_at", { ascending: true });
  if (bookingsErr) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {bookingsErr.message}
      </p>
    );
  }
  const bookings = (bookingsData ?? []) as unknown as BookingRow[];

  return (
    <div>
      <Link
        href="/admin/workshops"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to workshops
      </Link>
      <h1 className="mt-4 text-h1">{workshop.title}</h1>
      <p className="mt-2 text-small text-ignite-muted">
        {workshop.starts_at && workshop.ends_at ? (
          <>
            {ukDateTime(workshop.starts_at)} to{" "}
            {new Intl.DateTimeFormat("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "Europe/London",
            }).format(new Date(workshop.ends_at))}
          </>
        ) : (
          "Not scheduled yet"
        )}
        {workshop.room ? ` · ${workshop.room}` : ""} · {bookings.length}/{workshop.capacity}{" "}
        booked · {workshop.published_at ? "Published" : "Unpublished"}
      </p>

      {bookings.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No bookings yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ignite-line bg-ignite-white">
          <table className="w-full text-left text-small">
            <thead>
              <tr className="border-b border-ignite-line text-eyebrow uppercase text-ignite-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Booked</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <tr key={i} className="border-b border-ignite-line/60 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ignite-ink">
                    {[b.users?.first_name, b.users?.surname].filter(Boolean).join(" ") ||
                      "Unknown"}
                  </td>
                  <td className="px-4 py-3">{b.users?.email ?? ""}</td>
                  <td className="px-4 py-3">{b.users?.company ?? ""}</td>
                  <td className="px-4 py-3">{ukDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
