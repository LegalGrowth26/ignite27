import type { SupabaseClient } from "@supabase/supabase-js";

// Shared bookings query for the admin table and its CSV export so both
// always show the same view. Search is a case-insensitive match on
// reference / promo code, plus attendee name/email via a second query
// (PostgREST can't OR across an embedded table).

export interface AdminBookingRow {
  id: string;
  booking_reference: string | null;
  booking_type: "delegate" | "exhibitor";
  ticket_type: string;
  pricing_period: string;
  gross_amount_pence: number;
  vat_amount_pence: number;
  promo_code: string | null;
  discount_pence: number | null;
  payment_status: string;
  booking_status: string;
  created_at: string;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    email: string;
    is_primary_contact: boolean;
  }>;
}

export const SORTABLE_COLUMNS = {
  created_at: "created_at",
  reference: "booking_reference",
  price: "gross_amount_pence",
  status: "payment_status",
} as const;
export type SortKey = keyof typeof SORTABLE_COLUMNS;

export interface AdminBookingsQuery {
  search?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
}

export function normaliseQuery(params: Record<string, string | string[] | undefined>): AdminBookingsQuery {
  const raw = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = raw("sort") as SortKey | undefined;
  const dir = raw("dir");
  return {
    search: raw("q")?.trim() || undefined,
    sort: sort && sort in SORTABLE_COLUMNS ? sort : "created_at",
    dir: dir === "asc" ? "asc" : "desc",
  };
}

const COLUMNS = `id, booking_reference, booking_type, ticket_type, pricing_period,
  gross_amount_pence, vat_amount_pence, promo_code, discount_pence,
  payment_status, booking_status, created_at,
  booking_attendees (first_name, surname, email, is_primary_contact)`;

export async function fetchAdminBookings(
  client: SupabaseClient,
  query: AdminBookingsQuery,
): Promise<{ rows: AdminBookingRow[]; error: string | null }> {
  const sortColumn = SORTABLE_COLUMNS[query.sort ?? "created_at"];
  let builder = client
    .from("bookings")
    .select(COLUMNS)
    .order(sortColumn, { ascending: query.dir === "asc" })
    .limit(1000);

  if (query.search) {
    // Escape PostgREST pattern characters, then OR across reference and
    // promo code. Attendee name/email search happens client-side on the
    // fetched rows (bounded at 1000) to avoid an OR across the embed.
    const term = query.search.replace(/[%_,()]/g, " ").trim();
    if (term.length > 0) {
      builder = builder.or(
        `booking_reference.ilike.%${term}%,promo_code.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await builder;
  if (error) return { rows: [], error: error.message };

  let rows = (data ?? []) as AdminBookingRow[];

  // Second pass for attendee name/email when the direct match found
  // nothing: refetch unfiltered (same bound) and filter in JS.
  if (query.search && rows.length === 0) {
    const { data: all, error: allErr } = await client
      .from("bookings")
      .select(COLUMNS)
      .order(sortColumn, { ascending: query.dir === "asc" })
      .limit(1000);
    if (allErr) return { rows: [], error: allErr.message };
    const needle = query.search.toLowerCase();
    rows = ((all ?? []) as AdminBookingRow[]).filter((b) =>
      b.booking_attendees.some(
        (a) =>
          `${a.first_name} ${a.surname}`.toLowerCase().includes(needle) ||
          a.email.toLowerCase().includes(needle),
      ),
    );
  }

  return { rows, error: null };
}

export function primaryAttendee(row: AdminBookingRow) {
  return row.booking_attendees.find((a) => a.is_primary_contact) ?? row.booking_attendees[0] ?? null;
}
