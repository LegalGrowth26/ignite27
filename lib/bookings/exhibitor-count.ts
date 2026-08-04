import type { SupabaseClient } from "@supabase/supabase-js";

// Statuses that count toward the stand cap. Matches the admin overview:
// "comp" is a real stand with zero revenue; pending/failed/refunded and
// abandoned checkouts never count (SPEC: only PAID exhibitor bookings
// count toward the cap).
export const STAND_COUNTED_STATUSES = ["paid", "comp"] as const;

export class ExhibitorCountError extends Error {
  constructor(message: string, readonly originalCause?: unknown) {
    super(message);
    this.name = "ExhibitorCountError";
  }
}

// Live count of completed exhibitor bookings, used to gate the booking
// page (sold-out state), the checkout action (server refusal), and the
// /exhibit spaces-remaining note. Callers pass the service-role client:
// anonymous visitors have no RLS read on bookings, and the count leaks
// nothing personal.
export async function countCompletedExhibitorBookings(
  client: SupabaseClient,
): Promise<number> {
  const { count, error } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booking_type", "exhibitor")
    .in("payment_status", [...STAND_COUNTED_STATUSES]);
  if (error) {
    throw new ExhibitorCountError("count exhibitor bookings failed", error);
  }
  return count ?? 0;
}
