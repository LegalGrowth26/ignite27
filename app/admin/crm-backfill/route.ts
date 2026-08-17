import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { crmTagForBooking, maskEmail, pushContactToCrmSafe } from "@/lib/crm/ghl";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
// Sequential pushes across every booking can exceed the default limit.
export const maxDuration = 300;

interface BackfillBookingRow {
  id: string;
  booking_reference: string | null;
  booking_type: "delegate" | "exhibitor";
  ticket_type: string;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_contact_mobile: string | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    email: string;
    mobile: string | null;
    is_primary_contact: boolean;
    attendee_index: number;
  }>;
}

// One-off catch-up: pushes every completed (paid or comp, active)
// booking into TomCRM with its tag. Safe to run repeatedly; both CRM
// calls are idempotent, so a re-run only re-asserts what is already
// there. Super-admin only (404 otherwise, same as the CSV exports).
//
// HOW TO RUN (once, after GHL_API_KEY / GHL_LOCATION_ID are set in
// Vercel and redeployed): sign in as a super admin, then from the
// browser console on any /admin page run
//   fetch('/admin/crm-backfill', { method: 'POST' }).then(r => r.json()).then(console.log)
// or from a terminal with your session cookie. The JSON response
// reports pushed / failed / skipped counts, and the run is written to
// admin_audit as 'crm.backfill'.
export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("bookings")
    .select(
      `id, booking_reference, booking_type, ticket_type,
       company_contact_name, company_contact_email, company_contact_mobile,
       booking_attendees ( first_name, surname, email, mobile, is_primary_contact, attendee_index )`,
    )
    .in("payment_status", ["paid", "comp"])
    .eq("booking_status", "active")
    .order("created_at", { ascending: true });
  if (error) {
    return new Response(`bookings query failed: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as unknown as BackfillBookingRow[];
  let pushed = 0;
  let failed = 0;
  const skipped: string[] = [];

  for (const b of rows) {
    const contact = resolveContact(b);
    if (!contact) {
      skipped.push(b.booking_reference ?? b.id);
      continue;
    }
    const ok = await pushContactToCrmSafe(
      {
        ...contact,
        tag: crmTagForBooking(b.booking_type, b.ticket_type),
      },
      `backfill ${b.booking_reference ?? b.id}`,
    );
    if (ok) pushed += 1;
    else failed += 1;
  }

  await logAdminAction(ctx.appUserId, "crm.backfill", {
    total_bookings: rows.length,
    pushed,
    failed,
    skipped: skipped.length,
  });

  return NextResponse.json({
    totalBookings: rows.length,
    pushed,
    failed,
    skippedNoContact: skipped,
    note:
      failed > 0
        ? "Failures are logged with [crm] in Vercel logs; safe to re-run after fixing."
        : "Safe to re-run at any time; pushes are idempotent.",
  });
}

// The CRM record per booking: delegates use their (single) attendee,
// exhibitors use the main contact, falling back to the primary or first
// attendee for bookings that predate the company_* columns. TBC
// placeholder attendees are never pushed.
function resolveContact(
  b: BackfillBookingRow,
): { email: string; firstName: string; lastName: string; phone: string | null } | null {
  if (b.booking_type === "exhibitor" && b.company_contact_email) {
    const [firstName, ...rest] = (b.company_contact_name ?? "").split(" ");
    return {
      email: b.company_contact_email,
      firstName: firstName || "Exhibitor",
      lastName: rest.join(" "),
      phone: b.company_contact_mobile,
    };
  }
  const attendees = [...b.booking_attendees].sort(
    (a, z) => a.attendee_index - z.attendee_index,
  );
  const a =
    attendees.find((x) => x.is_primary_contact) ??
    attendees.find((x) => !(x.first_name === "TBC" && x.surname.trim() === ""));
  if (!a) return null;
  console.info(`[crm] backfill contact resolved ${maskEmail(a.email)}`);
  return {
    email: a.email,
    firstName: a.first_name,
    lastName: a.surname,
    phone: a.mobile,
  };
}
