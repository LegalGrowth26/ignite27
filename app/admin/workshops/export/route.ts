import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { resolveAdminContext } from "@/lib/admin/guard";
import { csvResponse, toCsv } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

interface Row {
  created_at: string;
  workshops: {
    title: string;
    starts_at: string;
    ends_at: string;
    room: string | null;
  } | null;
  users: {
    first_name: string | null;
    surname: string | null;
    email: string;
    company: string | null;
  } | null;
}

function ukTime(iso: string | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

// Every workshop booking across every workshop (drafts included, so a
// just-unpublished workshop's list is still reachable), one row per
// person per workshop, ordered by workshop start then booking time.
export async function GET(): Promise<Response> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(client);
  if (!ctx) return new Response("Not found", { status: 404 });

  const { data, error } = await client
    .from("workshop_bookings")
    .select(
      `created_at,
       workshops ( title, starts_at, ends_at, room ),
       users ( first_name, surname, email, company )`,
    )
    .order("created_at", { ascending: true });
  if (error) return new Response(`query failed: ${error.message}`, { status: 500 });

  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (a.workshops?.starts_at ?? "").localeCompare(b.workshops?.starts_at ?? ""),
  );

  const csv = toCsv<Row>(rows, [
    { header: "Workshop", value: (r) => r.workshops?.title ?? "" },
    {
      header: "Time",
      value: (r) =>
        r.workshops
          ? `${ukTime(r.workshops.starts_at)}-${ukTime(r.workshops.ends_at)}`
          : "",
    },
    { header: "Room", value: (r) => r.workshops?.room ?? "" },
    {
      header: "Name",
      value: (r) =>
        [r.users?.first_name, r.users?.surname].filter(Boolean).join(" "),
    },
    { header: "Email", value: (r) => r.users?.email ?? "" },
    { header: "Company", value: (r) => r.users?.company ?? "" },
    { header: "Booked at", value: (r) => r.created_at },
  ]);

  return csvResponse(csv, "ignite27-workshop-bookings.csv");
}
