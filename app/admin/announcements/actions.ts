"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  computeReorderSwap,
  validateAnnouncement,
  type OrderedRow,
} from "@/lib/announcements/validate";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export interface AnnouncementActionState {
  error: string | null;
  ok: string | null;
  // Echoed back on error so a failed submit never wipes typed work
  // (React 19 resets uncontrolled form fields after every action).
  values: EchoedValues | null;
}

function parseForm(formData: FormData) {
  return validateAnnouncement({
    headline: formData.get("headline"),
    body: formData.get("body"),
    linkUrl: formData.get("linkUrl"),
    imageUrl: formData.get("imageUrl"),
  });
}

// New announcements start UNPUBLISHED so they can be proofed on the
// admin list before the publish toggle puts them on the homepage.
export async function createAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const ctx = await requireSuperAdmin();
  const validation = parseForm(formData);
  if (!validation.ok) {
    return { error: validation.error, ok: null, values: echoFormValues(formData) };
  }

  const service = createSupabaseServiceClient();
  // Append to the end of the current order.
  const { data: maxRow } = await service
    .from("announcements")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 10;

  const { error } = await service.from("announcements").insert({
    headline: validation.value.headline,
    body: validation.value.body,
    link_url: validation.value.linkUrl,
    image_url: validation.value.imageUrl,
    sort_order: nextOrder,
    created_by: ctx.appUserId,
  });
  if (error) {
    console.error("[admin/announcements] create failed:", error.message);
    return {
      error: "Could not create the announcement. Try again.",
      ok: null,
      values: echoFormValues(formData),
    };
  }

  await logAdminAction(ctx.appUserId, "announcement.create", {
    headline: validation.value.headline,
  });
  revalidatePath("/admin/announcements");
  return {
    error: null,
    ok: "Created as a draft. Publish it below when it reads right.",
    values: null,
  };
}

export async function updateAnnouncementAction(
  announcementId: string,
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const ctx = await requireSuperAdmin();
  const validation = parseForm(formData);
  if (!validation.ok) {
    return { error: validation.error, ok: null, values: echoFormValues(formData) };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("announcements")
    .update({
      headline: validation.value.headline,
      body: validation.value.body,
      link_url: validation.value.linkUrl,
      image_url: validation.value.imageUrl,
    })
    .eq("id", announcementId);
  if (error) {
    console.error("[admin/announcements] update failed:", error.message);
    return {
      error: "Could not save the changes. Try again.",
      ok: null,
      values: echoFormValues(formData),
    };
  }

  await logAdminAction(ctx.appUserId, "announcement.update", {
    announcement_id: announcementId,
  });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
  return { error: null, ok: "Saved.", values: null };
}

export async function togglePublishAction(announcementId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("announcements")
    .select("published_at")
    .eq("id", announcementId)
    .maybeSingle();
  const isPublished = Boolean((data as { published_at: string | null } | null)?.published_at);

  const { error } = await service
    .from("announcements")
    .update({ published_at: isPublished ? null : new Date().toISOString() })
    .eq("id", announcementId);
  if (error) throw new Error(`publish toggle failed: ${error.message}`);

  await logAdminAction(
    ctx.appUserId,
    isPublished ? "announcement.unpublish" : "announcement.publish",
    { announcement_id: announcementId },
  );
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function moveAnnouncementAction(
  announcementId: string,
  direction: "up" | "down",
): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("announcements")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as OrderedRow[];
  const updates = computeReorderSwap(rows, announcementId, direction);
  if (!updates) return; // already at the edge

  for (const update of updates) {
    const { error } = await service
      .from("announcements")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id);
    if (error) throw new Error(`reorder failed: ${error.message}`);
  }

  await logAdminAction(ctx.appUserId, "announcement.reorder", {
    announcement_id: announcementId,
    direction,
  });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}
