"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveOwnAppUserId } from "@/lib/account/queries";
import { SOCIAL_PLATFORMS } from "@/lib/exhibitors/profile";
import { publishSpeakerPhotoCopy } from "@/lib/speakers/photo";
import {
  hostsWorkshops,
  validateSpeakerContent,
  type SpeakerProfileType,
} from "@/lib/speakers/profile";
import { syncHostWorkshopSafe } from "@/lib/workshops/sync";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB
// Photos, not logos: no SVG here.
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export interface SpeakerEditorState {
  error: string | null;
}

// Saves the speaker's own page. USER-scoped client throughout the row
// write: RLS owner_update restricts it to the caller's linked profile,
// and the column grants keep slug/user_id/published_at unreachable.
// Plain UPDATE, id only ever in the filter; the row always exists
// before editing (created by admin/backfill), so no insert path.
// The service client appears ONLY for the private->public photo copy,
// after ownership is already established.
export async function saveSpeakerProfileAction(
  _prev: SpeakerEditorState,
  formData: FormData,
): Promise<SpeakerEditorState> {
  const supabase = await createSupabaseServerClient();
  const appUserId = await resolveOwnAppUserId(supabase);
  if (!appUserId) return { error: "You need to be signed in." };

  // Own profile via RLS owner_select; also gives us the id for the
  // photo path.
  const { data: profileData, error: profileErr } = await supabase
    .from("speaker_profiles")
    .select("id, slug, photo_path, profile_type")
    .eq("user_id", appUserId)
    .maybeSingle();
  if (profileErr || !profileData) {
    return { error: "No speaker page is linked to this account." };
  }
  const profile = profileData as {
    id: string;
    slug: string;
    photo_path: string | null;
    profile_type: SpeakerProfileType;
  };
  // Everyone edits the talk fields now. For a main-stage speaker they
  // are the talk; for a workshop host they ARE the workshop (title,
  // what it covers, what you'll leave with), synced onto the linked
  // workshop row after the save below.
  const isHost = hostsWorkshops(profile.profile_type);

  const validated = validateSpeakerContent({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    talkTitle: formData.get("talkTitle"),
    talkDescription: formData.get("talkDescription"),
    talkTakeaways: formData.get("talkTakeaways"),
    websiteUrl: formData.get("websiteUrl"),
    socialLinks: SOCIAL_PLATFORMS.map((platform) => ({
      platform,
      url: formData.get(`social_${platform}`),
    })),
    ctaLabel: formData.get("ctaLabel"),
    ctaUrl: formData.get("ctaUrl"),
    enquiriesEmail: formData.get("enquiriesEmail"),
  });
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  // Optional photo upload into the PRIVATE bucket at {profileId}/photo.{ext};
  // storage RLS re-checks profile ownership on the path.
  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = ALLOWED_PHOTO_TYPES[photo.type];
    if (!ext) return { error: "Photo must be a JPG, PNG, or WebP file." };
    if (photo.size > MAX_PHOTO_BYTES) return { error: "Photo must be 2MB or smaller." };
    photoPath = `${profile.id}/photo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("speaker-photos")
      .upload(photoPath, photo, { upsert: true, contentType: photo.type });
    if (uploadErr) {
      console.error("[speaker-editor] photo upload failed:", uploadErr.message);
      return { error: "Photo upload failed. Try again or skip the photo for now." };
    }
  }

  // Hosts can also upload a company logo, same private bucket and
  // pipeline at {profileId}/logo.{ext}. Raster only (no SVG): logos
  // here are end-user uploads, and SVG is a stored-XSS vector when
  // fetched directly from the public bucket.
  let logoPath: string | null = null;
  const logo = formData.get("logo");
  if (isHost && logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_PHOTO_TYPES[logo.type];
    if (!ext) return { error: "Logo must be a JPG, PNG, or WebP file." };
    if (logo.size > MAX_PHOTO_BYTES) return { error: "Logo must be 2MB or smaller." };
    logoPath = `${profile.id}/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("speaker-photos")
      .upload(logoPath, logo, { upsert: true, contentType: logo.type });
    if (uploadErr) {
      console.error("[speaker-editor] logo upload failed:", uploadErr.message);
      return { error: "Logo upload failed. Try again or skip the logo for now." };
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from("speaker_profiles")
    .update({
      display_name: v.displayName,
      bio: v.bio,
      talk_title: v.talkTitle,
      talk_description: v.talkDescription,
      talk_takeaways: v.talkTakeaways,
      website_url: v.websiteUrl,
      social_links: v.socialLinks,
      cta_label: v.ctaLabel,
      cta_url: v.ctaUrl,
      enquiries_email: v.enquiriesEmail,
      ...(photoPath ? { photo_path: photoPath } : {}),
      ...(logoPath ? { logo_path: logoPath } : {}),
    })
    .eq("id", profile.id)
    .select("slug");
  if (updateErr) {
    console.error("[speaker-editor] save failed:", updateErr.message);
    return { error: "Could not save your page. Try again." };
  }
  const slug = (updated as Array<{ slug: string }> | null)?.[0]?.slug ?? profile.slug;

  // Publish the photo/logo copies so the public pages (which never
  // read the private bucket) can show them. A copy failure does not
  // fail the save.
  const service = createSupabaseServiceClient();
  for (const path of [photoPath, logoPath]) {
    if (!path) continue;
    const { error: copyErr } = await publishSpeakerPhotoCopy(service, path);
    if (copyErr) console.error("[speaker-editor] public image copy failed:", copyErr);
  }

  // Workshop hosts: mirror the saved content onto the linked workshop.
  // First complete save CREATES and auto-publishes it (time and room to
  // be confirmed); later saves update content in place. Never throws.
  if (profile.profile_type === "workshop_host") {
    await syncHostWorkshopSafe(
      service,
      {
        id: profile.id,
        profileType: profile.profile_type,
        displayName: v.displayName,
        talkTitle: v.talkTitle,
        talkDescription: v.talkDescription,
      },
      `host editor save ${profile.slug}`,
    );
    revalidatePath("/workshops");
  }

  revalidatePath(`/speakers/${slug}`);
  revalidatePath("/speakers");
  revalidatePath("/");
  redirect(`/speaker?status=saved`);
}
