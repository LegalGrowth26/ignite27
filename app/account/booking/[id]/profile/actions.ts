"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchOwnBookingDetail, resolveOwnAppUserId } from "@/lib/account/queries";
import { SOCIAL_PLATFORMS, validateProfileContent } from "@/lib/exhibitors/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export interface ProfileFormState {
  error: string | null;
}

// Saves the exhibitor's public page content. Runs entirely on the
// USER-scoped client: RLS owner_update restricts the write to the
// caller's own booking, and the column grants stop this action ever
// touching slug, booking_id, or published_at. The logo is deliberately
// not handled here: uploads stay on the requirements form (one upload
// flow), which syncs logo_path onto the profile after publishing it.
//
// Plain UPDATE with booking_id ONLY in the filter, never the payload.
// The row always exists before editing (webhook/backfill creates it),
// so there is deliberately no insert path and no upsert; see the
// requirements-form incident for why upsert breaks column grants.
export async function saveExhibitorProfileAction(
  bookingId: string,
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createSupabaseServerClient();
  const appUserId = await resolveOwnAppUserId(supabase);
  if (!appUserId) return { error: "You need to be signed in." };

  const { data: booking } = await fetchOwnBookingDetail(supabase, appUserId, bookingId);
  if (!booking || (booking as { booking_type: string }).booking_type !== "exhibitor") {
    return { error: "This booking is not an exhibitor booking." };
  }

  const validated = validateProfileContent({
    displayName: formData.get("displayName"),
    description: formData.get("description"),
    websiteUrl: formData.get("websiteUrl"),
    socialLinks: SOCIAL_PLATFORMS.map((platform) => ({
      platform,
      url: formData.get(`social_${platform}`),
    })),
    ctaPrimaryLabel: formData.get("ctaPrimaryLabel"),
    ctaPrimaryUrl: formData.get("ctaPrimaryUrl"),
    ctaSecondaryLabel: formData.get("ctaSecondaryLabel"),
    ctaSecondaryUrl: formData.get("ctaSecondaryUrl"),
    showContactEmail: formData.get("showContactEmail"),
    contactEmail: formData.get("contactEmail"),
  });
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  const { data: updated, error: updateErr } = await supabase
    .from("exhibitor_profiles")
    .update({
      display_name: v.displayName,
      description: v.description,
      website_url: v.websiteUrl,
      social_links: v.socialLinks,
      cta_primary_label: v.ctaPrimaryLabel,
      cta_primary_url: v.ctaPrimaryUrl,
      cta_secondary_label: v.ctaSecondaryLabel,
      cta_secondary_url: v.ctaSecondaryUrl,
      show_contact_email: v.showContactEmail,
      contact_email: v.contactEmail,
    })
    .eq("booking_id", bookingId)
    .select("slug");
  if (updateErr) {
    console.error("[exhibitor-profile] save failed:", updateErr.message);
    return { error: "Could not save your page. Try again." };
  }
  const slug = (updated as Array<{ slug: string }> | null)?.[0]?.slug;
  if (!slug) {
    return {
      error:
        "Your page has not been set up yet. Refresh this page to create it, or contact us if that does not work.",
    };
  }

  revalidatePath(`/exhibitors/${slug}`);
  revalidatePath("/exhibitors");
  revalidatePath("/exhibit");
  redirect(`/account/booking/${bookingId}?status=profile_saved`);
}
