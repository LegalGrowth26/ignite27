import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { resolveAdminContext } from "@/lib/admin/guard";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import {
  fetchAdminBookings,
  normaliseQuery,
  primaryAttendee,
  type AdminBookingRow,
} from "@/lib/admin/bookings";

export const dynamic = "force-dynamic";

// Route handlers are NOT covered by the /admin layout gate; re-check
// here. Non-admins get a plain 404 body, indistinguishable from a
// missing route.
export async function GET(request: Request): Promise<Response> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(client);
  if (!ctx) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const query = normaliseQuery(Object.fromEntries(url.searchParams.entries()));
  const { rows, error } = await fetchAdminBookings(client, query);
  if (error) return new Response(`query failed: ${error}`, { status: 500 });

  const csv = toCsv<AdminBookingRow>(rows, [
    { header: "Reference", value: (b) => b.booking_reference },
    { header: "Name", value: (b) => {
        const a = primaryAttendee(b);
        return a ? `${a.first_name} ${a.surname}` : "";
      } },
    { header: "Email", value: (b) => primaryAttendee(b)?.email ?? "" },
    { header: "Type", value: (b) => (b.booking_type === "exhibitor" ? "exhibitor" : b.ticket_type) },
    { header: "Period", value: (b) => b.pricing_period },
    { header: "Gross (pence, inc VAT)", value: (b) => b.gross_amount_pence },
    { header: "VAT (pence)", value: (b) => b.vat_amount_pence },
    { header: "Promo code", value: (b) => b.promo_code },
    { header: "Discount (pence)", value: (b) => b.discount_pence },
    { header: "Payment status", value: (b) => b.payment_status },
    { header: "Booking status", value: (b) => b.booking_status },
    { header: "Created", value: (b) => b.created_at },
  ]);

  return csvResponse(csv, "ignite27-bookings.csv");
}
