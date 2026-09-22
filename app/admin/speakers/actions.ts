"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { SOCIAL_PLATFORMS } from "@/lib/exhibitors/profile";
import {
  attachSpeakerAccount,
  ensureSpeakerProfile,
} from "@/lib/speakers/create-profile";
import { publishSpeakerPhotoCopy } from "@/lib/speakers/photo";
import { validateSpeakerContent } from "@/lib/speakers/profile";
import { sendSpeakerInvite } from "@/lib/speakers/send-invite";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin speaker management: add (page live immediately, adding =
// announcing), attach an account to an account-less page (creates the
// login + sends the invite), full edit including the slug,
// unpublish/republish (with the public photo copy pulled/restored).
// Everything audit-logged; service role only after the admin gate.

export interface SpeakerAdminFormState {
  error: string | null;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function revalidateSpeakerSurfaces(slug: string | null): void {
  if (slug) revalidatePath(`/speakers/${slug}`);
  revalidatePath("/speakers");
  revalidatePath("/");
  revalidatePath("/admin/speakers");
}

export async function addSpeakerAction(
  _prev: SpeakerAdminFormState,
  formData: FormData,
): Promise<SpeakerAdminFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const talkTitle = String(formData.get("talkTitle") ?? "").trim();

  if (!name || name.length > 120) return { error: "Speaker name is required (max 120 characters)." };
  if (talkTitle.length > 200) return { error: "Talk title is too long (max 200 characters)." };
  if (email && !isEmail(email)) {
    return { error: "That email does not look right. Leave it blank to attach one later." };
  }

  let created;
  try {
    created = await ensureSpeakerProfile(service, { displayName: name, talkTitle });
  } catch (err) {
    console.error("[admin/speakers] create failed:", err);
    return { error: "Could not create the speaker page. Try again." };
  }

  let invited = false;
  if (email) {
    try {
      await attachSpeakerAccount(service, created.profileId, email, name);
      await sendSpeakerInvite({
        firstName: name.split(/\s+/)[0] ?? name,
        email,
        slug: created.slug,
      });
      invited = true;
    } catch (err) {
      // The page exists; the account/invite can be retried from admin.
      console.error("[admin/speakers] account/invite failed after create:", err);
    }
  }

  await logAdminAction(ctx.appUserId, "speaker.add", {
    speaker_profile_id: created.profileId,
    slug: created.slug,
    with_account: Boolean(email),
    invited,
  });
  revalidateSpeakerSurfaces(created.slug);
  redirect(
    `/admin/speakers?status=${email ? (invited ? "added_invited" : "added_invite_failed") : "added_no_account"}`,
  );
}

// Attach an email to an account-less page (or retry a failed invite):
// creates/finds the account, links it, sends the invite.
export async function attachSpeakerEmailAction(
  profileId: string,
  _prev: SpeakerAdminFormState,
  formData: FormData,
): Promise<SpeakerAdminFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "That email does not look right." };

  const { data } = await service
    .from("speaker_profiles")
    .select("slug, display_name")
    .eq("id", profileId)
    .maybeSingle();
  const profile = data as { slug: string; display_name: string } | null;
  if (!profile) return { error: "Speaker page not found." };

  try {
    await attachSpeakerAccount(service, profileId, email, profile.display_name);
  } catch (err) {
    console.error("[admin/speakers] attach failed:", err);
    return {
      error:
        err instanceof Error && /different account/.test(err.message)
          ? "This page is already linked to a different account."
          : "Could not attach the account. Try again.",
    };
  }

  let invited = false;
  try {
    await sendSpeakerInvite({
      firstName: profile.display_name.split(/\s+/)[0] ?? profile.display_name,
      email,
      slug: profile.slug,
    });
    invited = true;
  } catch (err) {
    console.error("[admin/speakers] invite failed after attach:", err);
  }

  await logAdminAction(ctx.appUserId, "speaker.attach_account", {
    speaker_profile_id: profileId,
    invited,
  });
  revalidatePath("/admin/speakers");
  redirect(`/admin/speakers?status=${invited ? "attached_invited" : "attached_invite_failed"}`);
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,49}$/;

export async function adminSaveSpeakerAction(
  profileId: string,
  _prev: SpeakerAdminFormState,
  formData: FormData,
): Promise<SpeakerAdminFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data: existingData } = await service
    .from("speaker_profiles")
    .select("slug")
    .eq("id", profileId)
    .maybeSingle();
  const existing = existingData as { slug: string } | null;
  if (!existing) return { error: "Speaker page not found." };

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Slug must be 2 to 50 characters of lowercase letters, numbers, and hyphens.",
    };
  }

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

  const { error } = await service
    .from("speaker_profiles")
    .update({
      slug,
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
    })
    .eq("id", profileId);
  if (error) {
    if (/duplicate key|unique/.test(error.message)) {
      return { error: "That slug is already taken by another speaker." };
    }
    console.error("[admin/speakers] save failed:", error.message);
    return { error: "Could not save the page. Try again." };
  }

  await logAdminAction(ctx.appUserId, "speaker.edit", {
    speaker_profile_id: profileId,
    slug,
    slug_changed: slug !== existing.slug,
    previous_slug: existing.slug,
  });
  if (slug !== existing.slug) revalidatePath(`/speakers/${existing.slug}`);
  revalidateSpeakerSurfaces(slug);
  redirect("/admin/speakers?status=saved");
}

export async function unpublishSpeakerAction(profileId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("speaker_profiles")
    .select("slug, photo_path")
    .eq("id", profileId)
    .maybeSingle();
  const profile = data as { slug: string; photo_path: string | null } | null;
  if (!profile) throw new Error("speaker page not found");

  const { error } = await service
    .from("speaker_profiles")
    .update({ published_at: null })
    .eq("id", profileId);
  if (error) throw new Error(`unpublish failed: ${error.message}`);

  // Pull the public photo copy down with the page; the private
  // original stays for republish.
  if (profile.photo_path) {
    await service.storage.from("speaker-photos-public").remove([profile.photo_path]);
  }

  await logAdminAction(ctx.appUserId, "speaker.unpublish", {
    speaker_profile_id: profileId,
    slug: profile.slug,
  });
  revalidateSpeakerSurfaces(profile.slug);
}

export async function republishSpeakerAction(profileId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("speaker_profiles")
    .select("slug, photo_path")
    .eq("id", profileId)
    .maybeSingle();
  const profile = data as { slug: string; photo_path: string | null } | null;
  if (!profile) throw new Error("speaker page not found");

  const { error } = await service
    .from("speaker_profiles")
    .update({ published_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(`republish failed: ${error.message}`);

  if (profile.photo_path) {
    const { error: copyErr } = await publishSpeakerPhotoCopy(service, profile.photo_path);
    if (copyErr) console.error("[admin/speakers] photo restore failed:", copyErr);
  }

  await logAdminAction(ctx.appUserId, "speaker.republish", {
    speaker_profile_id: profileId,
    slug: profile.slug,
  });
  revalidateSpeakerSurfaces(profile.slug);
}
