"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { publishLogoCopy } from "@/lib/exhibitors/save-requirements";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Listing controls under the auto-listing model (Aug 2026): paid live
// exhibitor bookings list themselves; the only admin lever is the hide
// toggle. Hide, not delete: the booking and requirements rows are
// untouched, listing_hidden_at is stamped, and the action lands in
// admin_audit. Hiding also removes the PUBLIC logo copy so nothing of
// the listing stays reachable; showing again restores the copy from the
// private original.
//
// Service-role client is used server-side only; requireSuperAdmin gates
// the caller first.

export async function hideExhibitorListingAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { error: stampErr } = await service
    .from("bookings")
    .update({ listing_hidden_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("booking_type", "exhibitor");
  if (stampErr) throw new Error(`listing hide failed: ${stampErr.message}`);

  // Pull the public logo copy down with the listing. The private
  // original stays, so unhiding can restore it.
  const { data: req } = await service
    .from("exhibitor_requirements")
    .select("logo_path")
    .eq("booking_id", bookingId)
    .maybeSingle();
  const logoPath = (req as { logo_path: string | null } | null)?.logo_path;
  if (logoPath) {
    await service.storage.from("exhibitor-logos-public").remove([logoPath]);
  }

  await logAdminAction(ctx.appUserId, "exhibitor.listing_hide", {
    booking_id: bookingId,
    public_logo_removed: Boolean(logoPath),
  });

  revalidatePath("/admin/exhibitors");
  revalidatePath("/exhibit");
}

export async function showExhibitorListingAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { error: stampErr } = await service
    .from("bookings")
    .update({ listing_hidden_at: null })
    .eq("id", bookingId)
    .eq("booking_type", "exhibitor");
  if (stampErr) throw new Error(`listing show failed: ${stampErr.message}`);

  // Restore the public logo copy from the private original, if there is
  // one recorded.
  const { data: req } = await service
    .from("exhibitor_requirements")
    .select("logo_path")
    .eq("booking_id", bookingId)
    .maybeSingle();
  const logoPath = (req as { logo_path: string | null } | null)?.logo_path;
  let logoRestored = false;
  if (logoPath) {
    const { error: copyErr } = await publishLogoCopy(service, logoPath);
    if (copyErr) {
      console.error("[admin/exhibitors] logo restore failed:", copyErr);
    } else {
      logoRestored = true;
    }
  }

  await logAdminAction(ctx.appUserId, "exhibitor.listing_show", {
    booking_id: bookingId,
    public_logo_restored: logoRestored,
  });

  revalidatePath("/admin/exhibitors");
  revalidatePath("/exhibit");
}
