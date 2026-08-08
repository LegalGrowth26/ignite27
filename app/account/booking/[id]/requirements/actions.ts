"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchOwnBookingDetail, resolveOwnAppUserId } from "@/lib/account/queries";
import {
  pickStrandedLogo,
  publishLogoCopy,
  saveRequirementsRow,
} from "@/lib/exhibitors/save-requirements";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

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

// Saves the exhibitor requirements for a booking the caller owns.
//
// Ownership and content writes run on the USER-scoped client (RLS +
// column grants enforce booking ownership; the approval-era columns
// stay unreachable). Two steps intentionally use the service client,
// both AFTER ownership has been verified above:
//   - publishing the logo copy into the public bucket (nothing else may
//     write there),
//   - nothing else.
//
// The row write is update-then-insert via saveRequirementsRow, NOT
// upsert; see that module for why upsert breaks against the column
// grants. If no new logo is chosen and none is recorded, a stranded
// upload from the old bug is adopted from the private bucket so nobody
// has to upload twice.
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
  } else {
    // No new file chosen. If the row has no logo recorded, look for a
    // stranded upload from the old save bug and adopt it. The listing
    // uses the user client, so RLS keeps this to the caller's booking.
    const { data: existing } = await supabase
      .from("exhibitor_requirements")
      .select("logo_path")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!(existing as { logo_path: string | null } | null)?.logo_path) {
      const { data: files } = await supabase.storage
        .from("exhibitor-logos")
        .list(bookingId);
      const stranded = pickStrandedLogo(files ?? []);
      if (stranded) {
        logoPath = `${bookingId}/${stranded}`;
        console.info("[requirements] adopting stranded logo upload:", logoPath);
      }
    }
  }

  const row: Parameters<typeof saveRequirementsRow>[2] = {
    needs_power: needsPower,
    needs_table_chairs: needsTableChairs,
    signage_name: signageName,
    website_url: websiteUrl,
  };
  if (logoPath) row.logo_path = logoPath;

  const { error: saveErr } = await saveRequirementsRow(supabase, bookingId, row);
  if (saveErr) {
    console.error("[requirements] save failed:", saveErr);
    return { error: "Could not save your requirements. Try again." };
  }

  // Publish the logo to the public bucket so the /exhibit listing (which
  // never reads the private bucket) can show it. Ownership was verified
  // above; the service client is needed because only it may write the
  // public bucket. A copy failure does not fail the save: the listing
  // simply shows the name until the next save retries the copy.
  if (logoPath) {
    const { error: copyErr } = await publishLogoCopy(
      createSupabaseServiceClient(),
      logoPath,
    );
    if (copyErr) {
      console.error("[requirements] public logo copy failed:", copyErr);
    }
  }

  revalidatePath("/exhibit");
  redirect(`/account/booking/${bookingId}?status=requirements_saved`);
}
