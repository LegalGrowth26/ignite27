"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { SOCIAL_PLATFORMS, validateProfileContent } from "@/lib/exhibitors/profile";
import { publishLogoCopy } from "@/lib/exhibitors/save-requirements";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin levers for exhibitor pages (the profile-based model that
// replaced the listing hide toggle): unpublish/republish a page, and
// edit any page's content, slug included. Unpublish, not delete: the
// row keeps its content, published_at is nulled, the page 404s and
// every listing drops it in one move. This is also the manual step for
// a cancelled or refunded stand.
//
// Service-role client server-side only; requireSuperAdmin gates every
// action, and every action lands in admin_audit.

async function revalidateExhibitorSurfaces(slug: string | null): Promise<void> {
  if (slug) revalidatePath(`/exhibitors/${slug}`);
  revalidatePath("/exhibitors");
  revalidatePath("/exhibit");
  revalidatePath("/admin/exhibitors");
}

async function fetchProfileForAdmin(
  bookingId: string,
): Promise<{ slug: string; logo_path: string | null } | null> {
  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("exhibitor_profiles")
    .select("slug, logo_path")
    .eq("booking_id", bookingId)
    .maybeSingle();
  return (data as { slug: string; logo_path: string | null } | null) ?? null;
}

export async function unpublishExhibitorPageAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const profile = await fetchProfileForAdmin(bookingId);
  if (!profile) throw new Error("no exhibitor page exists for this booking");

  const { error } = await service
    .from("exhibitor_profiles")
    .update({ published_at: null })
    .eq("booking_id", bookingId);
  if (error) throw new Error(`unpublish failed: ${error.message}`);

  // Pull the public logo copy down with the page. The private original
  // stays, so republishing can restore it.
  if (profile.logo_path) {
    await service.storage.from("exhibitor-logos-public").remove([profile.logo_path]);
  }

  await logAdminAction(ctx.appUserId, "exhibitor.page_unpublish", {
    booking_id: bookingId,
    slug: profile.slug,
    public_logo_removed: Boolean(profile.logo_path),
  });

  await revalidateExhibitorSurfaces(profile.slug);
}

export async function republishExhibitorPageAction(bookingId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const profile = await fetchProfileForAdmin(bookingId);
  if (!profile) throw new Error("no exhibitor page exists for this booking");

  const { error } = await service
    .from("exhibitor_profiles")
    .update({ published_at: new Date().toISOString() })
    .eq("booking_id", bookingId);
  if (error) throw new Error(`republish failed: ${error.message}`);

  let logoRestored = false;
  if (profile.logo_path) {
    const { error: copyErr } = await publishLogoCopy(service, profile.logo_path);
    if (copyErr) {
      console.error("[admin/exhibitors] logo restore failed:", copyErr);
    } else {
      logoRestored = true;
    }
  }

  await logAdminAction(ctx.appUserId, "exhibitor.page_republish", {
    booking_id: bookingId,
    slug: profile.slug,
    public_logo_restored: logoRestored,
  });

  await revalidateExhibitorSurfaces(profile.slug);
}

export interface AdminProfileFormState {
  error: string | null;
  // Echoed on error so React 19's form reset never wipes typed work.
  values: EchoedValues | null;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,49}$/;

// Full edit of any exhibitor page, including the slug (slugs are
// stable for exhibitors; only admins can change one, e.g. after a
// company rename). Runs on the service client, so this is the one
// write path that can touch slug.
export async function adminSaveExhibitorProfileAction(
  bookingId: string,
  _prev: AdminProfileFormState,
  formData: FormData,
): Promise<AdminProfileFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const existing = await fetchProfileForAdmin(bookingId);
  if (!existing) return { error: "No exhibitor page exists for this booking.", values: echoFormValues(formData) };

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Slug must be 2 to 50 characters of lowercase letters, numbers, and hyphens, starting with a letter or number.",
      values: echoFormValues(formData),
    };
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
  if (!validated.ok) return { error: validated.error, values: echoFormValues(formData) };
  const v = validated.value;

  const { error: updateErr } = await service
    .from("exhibitor_profiles")
    .update({
      slug,
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
    .eq("booking_id", bookingId);
  if (updateErr) {
    if (/duplicate key|unique/.test(updateErr.message)) {
      return { error: "That slug is already taken by another exhibitor.", values: echoFormValues(formData) };
    }
    console.error("[admin/exhibitors] page edit failed:", updateErr.message);
    return { error: "Could not save the page. Try again.", values: echoFormValues(formData) };
  }

  await logAdminAction(ctx.appUserId, "exhibitor.page_edit", {
    booking_id: bookingId,
    slug,
    slug_changed: slug !== existing.slug,
    previous_slug: existing.slug,
  });

  // Revalidate the old slug's path too when it changed (it now 404s).
  if (slug !== existing.slug) revalidatePath(`/exhibitors/${existing.slug}`);
  await revalidateExhibitorSurfaces(slug);
  redirect("/admin/exhibitors?status=page_saved");
}
