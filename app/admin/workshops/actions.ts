"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { validateWorkshop } from "@/lib/workshops/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin workshop CRUD. Draft/published via published_at; unpublish
// hides a workshop from the public list but keeps its bookings, so it
// can come back without anyone losing a place. Every action lands in
// admin_audit.

export interface WorkshopFormState {
  error: string | null;
}

function workshopRowFromForm(formData: FormData) {
  return validateWorkshop({
    title: formData.get("title"),
    description: formData.get("description"),
    speakerName: formData.get("speakerName"),
    room: formData.get("room"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    capacity: formData.get("capacity"),
  });
}

export async function createWorkshopAction(
  _prev: WorkshopFormState,
  formData: FormData,
): Promise<WorkshopFormState> {
  const ctx = await requireSuperAdmin();
  const validated = workshopRowFromForm(formData);
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("workshops")
    .insert({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      room: v.room,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      capacity: v.capacity,
      published_at: null, // created as draft; publish is explicit
    })
    .select("id")
    .single();
  if (error) {
    console.error("[admin/workshops] create failed:", error.message);
    return { error: "Could not create the workshop. Try again." };
  }

  await logAdminAction(ctx.appUserId, "workshop.create", {
    workshop_id: (data as { id: string }).id,
    title: v.title,
  });
  revalidatePath("/admin/workshops");
  redirect("/admin/workshops?status=created");
}

export async function updateWorkshopAction(
  workshopId: string,
  _prev: WorkshopFormState,
  formData: FormData,
): Promise<WorkshopFormState> {
  const ctx = await requireSuperAdmin();
  const validated = workshopRowFromForm(formData);
  if (!validated.ok) return { error: validated.error };
  const v = validated.value;

  const service = createSupabaseServiceClient();

  // Never shrink a room below the people already booked into it.
  const { count } = await service
    .from("workshop_bookings")
    .select("id", { count: "exact", head: true })
    .eq("workshop_id", workshopId);
  if ((count ?? 0) > v.capacity) {
    return {
      error: `${count} people are already booked; capacity cannot go below that.`,
    };
  }

  const { error } = await service
    .from("workshops")
    .update({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      room: v.room,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      capacity: v.capacity,
    })
    .eq("id", workshopId);
  if (error) {
    console.error("[admin/workshops] update failed:", error.message);
    return { error: "Could not save the workshop. Try again." };
  }

  await logAdminAction(ctx.appUserId, "workshop.update", {
    workshop_id: workshopId,
    title: v.title,
  });
  revalidatePath("/admin/workshops");
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
  redirect("/admin/workshops?status=saved");
}

export async function publishWorkshopAction(workshopId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("workshops")
    .update({ published_at: new Date().toISOString() })
    .eq("id", workshopId);
  if (error) throw new Error(`publish failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "workshop.publish", { workshop_id: workshopId });
  revalidatePath("/admin/workshops");
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
}

export async function unpublishWorkshopAction(workshopId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("workshops")
    .update({ published_at: null })
    .eq("id", workshopId);
  if (error) throw new Error(`unpublish failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "workshop.unpublish", { workshop_id: workshopId });
  revalidatePath("/admin/workshops");
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${workshopId}`);
}
