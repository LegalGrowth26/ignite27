"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { validateAgendaItem } from "@/lib/agenda/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin CRUD for the main-stage running order. Draft/published via
// published_at; published items appear on /my-day for everyone.

export interface AgendaItemFormState {
  error: string | null;
}

function itemFromForm(formData: FormData) {
  return validateAgendaItem({
    title: formData.get("title"),
    description: formData.get("description"),
    speakerName: formData.get("speakerName"),
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
}

function revalidatePlanner(): void {
  revalidatePath("/admin/agenda");
  revalidatePath("/my-day");
}

export async function createAgendaItemAction(
  _prev: AgendaItemFormState,
  formData: FormData,
): Promise<AgendaItemFormState> {
  const ctx = await requireSuperAdmin();
  const validated = itemFromForm(formData);
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("agenda_items")
    .insert({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      location: v.location,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      published_at: null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[admin/agenda] create failed:", error.message);
    return { error: "Could not create the agenda item. Try again." };
  }

  await logAdminAction(ctx.appUserId, "agenda.create", {
    agenda_item_id: (data as { id: string }).id,
    title: v.title,
  });
  revalidatePlanner();
  redirect("/admin/agenda?status=created");
}

export async function updateAgendaItemAction(
  itemId: string,
  _prev: AgendaItemFormState,
  formData: FormData,
): Promise<AgendaItemFormState> {
  const ctx = await requireSuperAdmin();
  const validated = itemFromForm(formData);
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("agenda_items")
    .update({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      location: v.location,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
    })
    .eq("id", itemId);
  if (error) {
    console.error("[admin/agenda] update failed:", error.message);
    return { error: "Could not save the agenda item. Try again." };
  }

  await logAdminAction(ctx.appUserId, "agenda.update", {
    agenda_item_id: itemId,
    title: v.title,
  });
  revalidatePlanner();
  redirect("/admin/agenda?status=saved");
}

export async function publishAgendaItemAction(itemId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("agenda_items")
    .update({ published_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(`publish failed: ${error.message}`);
  await logAdminAction(ctx.appUserId, "agenda.publish", { agenda_item_id: itemId });
  revalidatePlanner();
}

export async function unpublishAgendaItemAction(itemId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("agenda_items")
    .update({ published_at: null })
    .eq("id", itemId);
  if (error) throw new Error(`unpublish failed: ${error.message}`);
  await logAdminAction(ctx.appUserId, "agenda.unpublish", { agenda_item_id: itemId });
  revalidatePlanner();
}

export async function deleteAgendaItemAction(itemId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  // Nothing references agenda_items (display-only rows), so a hard
  // delete is safe; the audit row keeps the title for the record.
  const { data } = await service
    .from("agenda_items")
    .select("title")
    .eq("id", itemId)
    .maybeSingle();
  const { error } = await service.from("agenda_items").delete().eq("id", itemId);
  if (error) throw new Error(`delete failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "agenda.delete", {
    agenda_item_id: itemId,
    title: (data as { title: string } | null)?.title ?? null,
  });
  revalidatePlanner();
}
