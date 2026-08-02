"use server";

import { redirect } from "next/navigation";
import { fetchOwnBookingDetail, resolveOwnAppUserId } from "@/lib/account/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export interface RequirementsFormState {
  error: string | null;
}

// Upserts the exhibitor requirements for a booking the caller owns.
// Everything runs on the USER-scoped client, so RLS enforces booking
// ownership on the row and the storage upload; the approval columns
// are unreachable from here (column-level grants in the migration).
export async function submitExhibitorRequirementsAction(
  bookingId: string,
  _prev: RequirementsFormState,
  formData: FormData,
): Promise<RequirementsFormState> {
  const supabase = await createSupabaseServerClient();
  const appUserId = await resolveOwnAppUserId(supabase);
  if (!appUserId) return { error: "You need to be signed in." };

  const { data: booking } = await fetchOwnBookingDetail(supabase, appUserId, bookingId);
  if (!booking || (booking as { booking_type: string }).booking_type !== "exhibitor") {
    return { error: "This booking is not an exhibitor booking." };
  }

  const signageName = String(formData.get("signageName") ?? "").trim();
  if (signageName.length === 0 || signageName.length > 120) {
    return { error: "Company name for signage is required (max 120 characters)." };
  }

  const websiteRaw = String(formData.get("websiteUrl") ?? "").trim();
  let websiteUrl: string | null = null;
  if (websiteRaw.length > 0) {
    try {
      const u = new URL(websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
      websiteUrl = u.toString();
    } catch {
      return { error: "That website URL does not look right." };
    }
  }

  const needsPower = formData.get("needsPower") === "on";
  const needsTableChairs = formData.get("needsTableChairs") === "on";

  // Optional logo upload into the PRIVATE bucket at {bookingId}/logo.{ext}.
  // Storage RLS re-checks booking ownership on the path.
  let logoPath: string | null = null;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_LOGO_TYPES[logo.type];
    if (!ext) {
      return { error: "Logo must be a PNG, JPG, WebP, or SVG file." };
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: "Logo must be 2MB or smaller." };
    }
    logoPath = `${bookingId}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("exhibitor-logos")
      .upload(logoPath, logo, { upsert: true, contentType: logo.type });
    if (uploadErr) {
      console.error("[requirements] logo upload failed:", uploadErr.message);
      return { error: "Logo upload failed. Try again or skip the logo for now." };
    }
  }

  const row: Record<string, unknown> = {
    booking_id: bookingId,
    needs_power: needsPower,
    needs_table_chairs: needsTableChairs,
    signage_name: signageName,
    website_url: websiteUrl,
  };
  if (logoPath) row.logo_path = logoPath;

  const { error: upsertErr } = await supabase
    .from("exhibitor_requirements")
    .upsert(row, { onConflict: "booking_id" });
  if (upsertErr) {
    console.error("[requirements] upsert failed:", upsertErr.message);
    return { error: "Could not save your requirements. Try again." };
  }

  redirect(`/account/booking/${bookingId}?status=requirements_saved`);
}
