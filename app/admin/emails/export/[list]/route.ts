import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { resolveAdminContext } from "@/lib/admin/guard";
import { csvResponse, toCsv } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

interface AttendeeEmailRow {
  first_name: string;
  surname: string;
  email: string;
  bookings: { booking_type: string; payment_status: string } | null;
}

async function attendeeEmails(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  bookingType: "delegate" | "exhibitor",
): Promise<Response> {
  const { data, error } = await client
    .from("booking_attendees")
    .select("first_name, surname, email, bookings!inner (booking_type, payment_status)")
    .eq("bookings.booking_type", bookingType)
    .in("bookings.payment_status", ["paid", "comp"]);
  if (error) return new Response(`query failed: ${error.message}`, { status: 500 });

  // Dedupe by email, keeping the first name seen.
  const seen = new Map<string, { first_name: string; surname: string; email: string }>();
  for (const row of (data ?? []) as unknown as AttendeeEmailRow[]) {
    const key = row.email.toLowerCase();
    if (!seen.has(key)) seen.set(key, row);
  }
  const rows = [...seen.values()];

  const csv = toCsv(rows, [
    { header: "First name", value: (r) => r.first_name },
    { header: "Surname", value: (r) => r.surname },
    { header: "Email", value: (r) => r.email },
  ]);
  return csvResponse(csv, `ignite27-${bookingType}-emails.csv`);
}

async function signupEmails(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Response> {
  const { data, error } = await client
    .from("email_signups")
    .select("email, source, wants_agenda_alert, wants_marketing, created_at")
    .order("created_at", { ascending: true });
  if (error) return new Response(`query failed: ${error.message}`, { status: 500 });

  interface SignupRow {
    email: string;
    source: string;
    wants_agenda_alert: boolean;
    wants_marketing: boolean;
    created_at: string;
  }
  const csv = toCsv((data ?? []) as SignupRow[], [
    { header: "Email", value: (r) => r.email },
    { header: "Source", value: (r) => r.source },
    { header: "Wants agenda alert", value: (r) => (r.wants_agenda_alert ? "yes" : "no") },
    { header: "Marketing consent", value: (r) => (r.wants_marketing ? "yes" : "no") },
    { header: "Signed up", value: (r) => r.created_at },
  ]);
  return csvResponse(csv, "ignite27-signup-emails.csv");
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ list: string }> },
): Promise<Response> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(client);
  if (!ctx) return new Response("Not found", { status: 404 });

  const { list } = await props.params;
  if (list === "delegates") return attendeeEmails(client, "delegate");
  if (list === "exhibitors") return attendeeEmails(client, "exhibitor");
  if (list === "signups") return signupEmails(client);
  return new Response("Not found", { status: 404 });
}
