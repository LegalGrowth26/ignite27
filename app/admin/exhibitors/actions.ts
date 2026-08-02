"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Approve an exhibitor's requirements submission for public display:
// copies their logo from the PRIVATE bucket to the PUBLIC one, upserts
// the confirmed_exhibitors row that the public site reads, and stamps
// approved_at / approved_by. Nothing reaches the public site except
// through this action.
//
// Service-role client is used server-side only (same pattern as the
// Stripe webhook writes); requireSuperAdmin gates the caller first.
export async function approveExhibitorAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data: req, error: reqErr } = await service
    .from("exhibitor_requirements")
    .select("id, booking_id, signage_name, logo_path, website_url")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (reqErr || !req) {
    throw new Error(`no requirements submission for booking ${bookingId}`);
  }

  // Copy the logo to the public bucket if one was uploaded. Same object
  // path in both buckets ({booking_id}/{filename}).
  let publicLogoPath: string | null = null;
  const logoPath = (req as { logo_path: string | null }).logo_path;
  if (logoPath) {
    const { data: file, error: downloadErr } = await service.storage
      .from("exhibitor-logos")
      .download(logoPath);
    if (downloadErr || !file) {
      throw new Error(`logo download failed: ${downloadErr?.message ?? "no file"}`);
    }
    const { error: uploadErr } = await service.storage
      .from("exhibitor-logos-public")
      .upload(logoPath, file, { upsert: true });
    if (uploadErr) {
      throw new Error(`logo publish failed: ${uploadErr.message}`);
    }
    publicLogoPath = logoPath;
  }

  const { error: upsertErr } = await service.from("confirmed_exhibitors").upsert(
    {
      booking_id: bookingId,
      display_name: (req as { signage_name: string }).signage_name,
      logo_path: publicLogoPath,
      website_url: (req as { website_url: string | null }).website_url,
    },
    { onConflict: "booking_id" },
  );
  if (upsertErr) throw new Error(`confirmed_exhibitors upsert failed: ${upsertErr.message}`);

  const { error: stampErr } = await service
    .from("exhibitor_requirements")
    .update({ approved_at: new Date().toISOString(), approved_by: ctx.appUserId })
    .eq("booking_id", bookingId);
  if (stampErr) throw new Error(`approval stamp failed: ${stampErr.message}`);

  await logAdminAction(ctx.appUserId, "exhibitor.approve", {
    booking_id: bookingId,
    display_name: (req as { signage_name: string }).signage_name,
    logo_published: Boolean(publicLogoPath),
  });

  revalidatePath("/admin/exhibitors");
  revalidatePath("/exhibit");
}

// Pull an exhibitor back off the public site: deletes the
// confirmed_exhibitors row, removes the public logo copy, clears the
// approval stamp. The private submission is untouched.
export async function revokeExhibitorApprovalAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data: confirmed } = await service
    .from("confirmed_exhibitors")
    .select("logo_path")
    .eq("booking_id", bookingId)
    .maybeSingle();

  const publicLogo = (confirmed as { logo_path: string | null } | null)?.logo_path;
  if (publicLogo) {
    await service.storage.from("exhibitor-logos-public").remove([publicLogo]);
  }

  await service.from("confirmed_exhibitors").delete().eq("booking_id", bookingId);
  await service
    .from("exhibitor_requirements")
    .update({ approved_at: null, approved_by: null })
    .eq("booking_id", bookingId);

  await logAdminAction(ctx.appUserId, "exhibitor.revoke_approval", {
    booking_id: bookingId,
  });

  revalidatePath("/admin/exhibitors");
  revalidatePath("/exhibit");
}
