import type { SupabaseClient } from "@supabase/supabase-js";

// Customer-facing /account queries.
//
// RLS is the gate, but bookings_admin_all means a super admin's session
// can SEE every booking. Without an explicit user_id filter, Tom or Paul
// visiting their own /account would get everyone's bookings rendered as
// "Your bookings" (the parked account-page RLS issue, option B). These
// helpers therefore ALWAYS scope by the caller's own app user id, and
// the account pages must query through them, never through raw
// .from("bookings") calls.

export async function resolveOwnAppUserId(
  client: SupabaseClient,
): Promise<string | null> {
  const { data: userData, error: authError } = await client.auth.getUser();
  if (authError || !userData?.user) return null;
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

const BOOKING_LIST_COLUMNS =
  "id, booking_reference, booking_type, ticket_type, gross_amount_pence, payment_status, booking_status, created_at";

export async function fetchOwnBookings(client: SupabaseClient, appUserId: string) {
  return client
    .from("bookings")
    .select(BOOKING_LIST_COLUMNS)
    .eq("user_id", appUserId)
    .order("created_at", { ascending: false });
}

const BOOKING_DETAIL_COLUMNS = `id, booking_reference, booking_type, ticket_type, pricing_period,
       gross_amount_pence, vat_amount_pence, discount_pence, promo_code,
       lunch_included,
       payment_status, booking_status, created_at, confirmation_email_sent_at,
       booking_attendees (
         first_name, surname, email, mobile, company, job_title,
         dietary_requirement, dietary_other, lunch_entitlement, badge_qr_url, is_primary_contact
       )`;

export async function fetchOwnBookingDetail(
  client: SupabaseClient,
  appUserId: string,
  bookingId: string,
) {
  return client
    .from("bookings")
    .select(BOOKING_DETAIL_COLUMNS)
    .eq("id", bookingId)
    .eq("user_id", appUserId)
    .maybeSingle();
}
