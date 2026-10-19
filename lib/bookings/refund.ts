import type { SupabaseClient } from "@supabase/supabase-js";
import { crmTagForBooking, removeContactTagsSafe } from "@/lib/crm/ghl";

// Refund handling (October 2026): a refund in Stripe, whether issued
// from our admin or straight from the Stripe dashboard, must flip the
// booking here too, or it keeps counting in revenue, headcount, lunch
// numbers, and exports. Any refund cancels the booking (the policy
// refunds minus Stripe fees, so a "partial" refund still means the
// person is not coming); payment_status records full vs partial
// honestly.

export interface ChargeRefundFacts {
  // Stripe's charge.refunded boolean: true only when FULLY refunded.
  fullyRefunded: boolean;
  amountRefundedPence: number;
}

// Pure and unit-tested: which payment_status a refund produces.
export function refundPaymentStatus(
  facts: ChargeRefundFacts,
): "refunded" | "partially_refunded" {
  return facts.fullyRefunded ? "refunded" : "partially_refunded";
}

export interface MarkRefundedResult {
  matched: boolean;
  paymentStatus: "refunded" | "partially_refunded";
}

// Idempotent: re-delivery writes the same values; a second partial
// refund that completes the amount upgrades partially_refunded to
// refunded. booking_status 'cancelled' drops the booking out of the
// overview stats (paid/comp only), the email audiences (active only),
// and the attendee exports.
export async function markBookingRefunded(
  service: SupabaseClient,
  bookingId: string,
  facts: ChargeRefundFacts,
): Promise<MarkRefundedResult> {
  const paymentStatus = refundPaymentStatus(facts);
  const { data, error } = await service
    .from("bookings")
    .update({ payment_status: paymentStatus, booking_status: "cancelled" })
    .eq("id", bookingId)
    .select("id");
  if (error) throw new Error(`refund mark failed: ${error.message}`);
  return { matched: (data ?? []).length > 0, paymentStatus };
}

// Pure and unit-tested: the booking-type CRM tag is removed only when
// the person holds NO OTHER active booking that would have applied it
// (someone with two tickets who refunds one keeps their tag).
export function shouldRemoveCrmTag(otherActiveSameTagBookings: number): boolean {
  return otherActiveSameTagBookings === 0;
}

// Best-effort CRM tag cleanup for a refunded booking's attendees.
// Never throws; a CRM hiccup must not fail the refund.
export async function cleanupCrmTagsForRefundSafe(
  service: SupabaseClient,
  booking: { id: string; booking_type: string; ticket_type: string },
): Promise<void> {
  try {
    const tag = crmTagForBooking(
      booking.booking_type as "delegate" | "exhibitor" | "partner",
      booking.ticket_type,
    );

    const { data: attendeeData } = await service
      .from("booking_attendees")
      .select("email")
      .eq("booking_id", booking.id);
    const emails = [
      ...new Set(
        ((attendeeData ?? []) as Array<{ email: string }>).map((a) =>
          a.email.toLowerCase(),
        ),
      ),
    ];

    for (const email of emails) {
      // Other ACTIVE paid/comp bookings holding this email that carry
      // the same tag keep it in place.
      const { data: otherData } = await service
        .from("booking_attendees")
        .select(
          "booking_id, bookings!inner (id, booking_type, ticket_type, booking_status, payment_status)",
        )
        .eq("email", email)
        .neq("booking_id", booking.id);
      type OtherRow = {
        bookings: {
          booking_type: string;
          ticket_type: string;
          booking_status: string;
          payment_status: string;
        };
      };
      const others = ((otherData ?? []) as unknown as OtherRow[]).filter(
        (r) =>
          r.bookings.booking_status === "active" &&
          ["paid", "comp"].includes(r.bookings.payment_status) &&
          crmTagForBooking(
            r.bookings.booking_type as "delegate" | "exhibitor" | "partner",
            r.bookings.ticket_type,
          ) === tag,
      ).length;

      if (shouldRemoveCrmTag(others)) {
        await removeContactTagsSafe(email, [tag], `refund ${booking.id}`);
      }
    }
  } catch (err) {
    console.error("[refund] CRM tag cleanup failed (refund stands):", err);
  }
}
