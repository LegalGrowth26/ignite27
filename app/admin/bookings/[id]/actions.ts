"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  cleanupCrmTagsForRefundSafe,
  markBookingRefunded,
} from "@/lib/bookings/refund";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Refund from the dashboard (supersedes the phase-1 "refunds are
// manual in Stripe" rule by decision, October 2026). One action
// covers both shapes:
//   - not yet refunded: issues the Stripe refund (full by default;
//     an amount in pounds makes it partial, e.g. minus Stripe fees
//     per the refund policy), then marks the booking;
//   - already refunded straight in Stripe: the refund call says so,
//     and the action falls through to marking the booking, which
//     heals exactly the "refunded in Stripe, still paid here" case.
// Either way the final full/partial state is read back from Stripe's
// own charge, never guessed.

export interface RefundActionState {
  error: string | null;
  ok: string | null;
}

export async function refundBookingAction(
  bookingId: string,
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const ctx = await requireSuperAdmin();

  if (formData.get("confirm") !== "on") {
    return { error: "Tick the confirmation box first.", ok: null };
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("bookings")
    .select(
      "id, booking_reference, booking_type, ticket_type, payment_status, booking_status, gross_amount_pence, stripe_payment_intent_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) {
    return { error: `Could not load the booking: ${error?.message ?? "not found"}`, ok: null };
  }
  const booking = data as {
    id: string;
    booking_reference: string | null;
    booking_type: string;
    ticket_type: string;
    payment_status: string;
    booking_status: string;
    gross_amount_pence: number;
    stripe_payment_intent_id: string | null;
  };

  if (booking.payment_status === "comp") {
    return { error: "This is a comp: nothing was paid, so there is nothing to refund.", ok: null };
  }
  if (!booking.stripe_payment_intent_id) {
    return { error: "This booking has no Stripe payment to refund.", ok: null };
  }

  const amountRaw = String(formData.get("amountPounds") ?? "").trim();
  let amountPence: number | null = null;
  if (amountRaw) {
    const pounds = Number.parseFloat(amountRaw.replace(/^£/, ""));
    if (!Number.isFinite(pounds) || pounds <= 0) {
      return { error: "The amount must be a number of pounds, or leave it blank for a full refund.", ok: null };
    }
    amountPence = Math.round(pounds * 100);
    if (amountPence > booking.gross_amount_pence) {
      return { error: "That is more than was paid.", ok: null };
    }
  }

  const stripe = getStripe();
  let via: "stripe_refund" | "already_refunded" = "stripe_refund";
  try {
    await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      ...(amountPence ? { amount: amountPence } : {}),
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "charge_already_refunded") {
      // Refunded straight in Stripe: nothing to send back, just heal
      // our records below.
      via = "already_refunded";
    } else {
      const message = err instanceof Error ? err.message : "unknown Stripe error";
      console.error("[admin/refund] Stripe refund failed:", message);
      return { error: `Stripe refused the refund: ${message}`, ok: null };
    }
  }

  // The charge is the source of truth for full vs partial.
  let fullyRefunded = amountPence === null;
  let amountRefundedPence = amountPence ?? booking.gross_amount_pence;
  try {
    const intent = await stripe.paymentIntents.retrieve(
      booking.stripe_payment_intent_id,
      { expand: ["latest_charge"] },
    );
    const charge = intent.latest_charge as Stripe.Charge | null;
    if (charge) {
      fullyRefunded = charge.refunded === true;
      amountRefundedPence = charge.amount_refunded ?? amountRefundedPence;
    }
  } catch (err) {
    console.error("[admin/refund] charge read-back failed (using form amount):", err);
  }

  const result = await markBookingRefunded(service, booking.id, {
    fullyRefunded,
    amountRefundedPence,
  });
  if (!result.matched) {
    return { error: "The refund went through but the booking row did not update. Check the logs.", ok: null };
  }

  await cleanupCrmTagsForRefundSafe(service, booking);

  await logAdminAction(ctx.appUserId, "booking.refund", {
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    via,
    amount_refunded_pence: amountRefundedPence,
    payment_status: result.paymentStatus,
    was: `${booking.payment_status}/${booking.booking_status}`,
  });

  revalidatePath(`/admin/bookings/${booking.id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return {
    error: null,
    ok:
      via === "already_refunded"
        ? `Stripe had already refunded this; records are now aligned (payment_status ${result.paymentStatus}, booking_status cancelled).`
        : `Refunded £${(amountRefundedPence / 100).toFixed(2)} and cancelled the booking (payment_status ${result.paymentStatus}, booking_status cancelled).`,
  };
}
