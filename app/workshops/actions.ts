"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

// Book / un-book actions. All rules live in the SECURITY DEFINER
// database functions (window, ticket check, capacity lock, clash rule);
// this layer only translates their stable error codes into sentences.

function friendlyBookingError(message: string): string {
  if (message.includes("not_signed_in")) return "Sign in to book a workshop.";
  if (message.includes("no_ticket")) {
    return "Workshop booking is for IGNITE! 27 ticket holders. Book your place first, then come back.";
  }
  if (message.includes("not_open_yet")) {
    return "Workshop booking is not open yet. VIP ticket holders book from 1 January, everyone else from 4 January.";
  }
  if (message.includes("not_found")) return "That workshop is no longer available.";
  if (message.includes("full")) return "That workshop has just filled up.";
  if (message.includes("clash:")) {
    const clashTitle = message.split("clash:")[1]?.trim();
    return clashTitle
      ? `That clashes with ${clashTitle}, which you are already booked on. Un-book that one first if you would rather do this.`
      : "That clashes with a workshop you are already booked on.";
  }
  if (message.includes("too_late")) {
    return "Workshop changes closed the day before the event. Speak to the team on the day.";
  }
  console.error("[workshops] unexpected booking error:", message);
  return "Something went wrong. Try again.";
}

export async function bookWorkshopAction(
  workshopId: string,
  returnTo: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_workshop", {
    p_workshop_id: workshopId,
  });

  const base = returnTo.startsWith("/workshops") ? returnTo : "/workshops";
  if (error) {
    redirect(`${base}?error=${encodeURIComponent(friendlyBookingError(error.message))}`);
  }
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
  const status = data === "already_booked" ? "already_booked" : "booked";
  redirect(`${base}?status=${status}`);
}

export async function cancelWorkshopBookingAction(
  workshopId: string,
  returnTo: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_workshop_booking", {
    p_workshop_id: workshopId,
  });

  const base = returnTo.startsWith("/workshops") ? returnTo : "/workshops";
  if (error) {
    redirect(`${base}?error=${encodeURIComponent(friendlyBookingError(error.message))}`);
  }
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
  redirect(`${base}?status=cancelled`);
}
