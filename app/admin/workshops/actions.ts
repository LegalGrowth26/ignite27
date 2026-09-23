"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import { validateWorkshop } from "@/lib/workshops/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin workshop CRUD. Draft/published via published_at; unpublish
// hides a workshop from the public list but keeps its bookings, so it
// can come back without anyone losing a place. Every action lands in
// admin_audit.

export interface WorkshopFormState {
  error: string | null;
  // Echoed on error: React 19 resets the form after every action.
  values: EchoedValues | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Host link: empty = none; otherwise it must be a real speaker profile
// typed workshop_host or both (the dropdown only offers those, but a
// hand-crafted POST gets the same rule).
async function resolveHostProfileId(
  service: ReturnType<typeof createSupabaseServiceClient>,
  raw: FormDataEntryValue | null,
): Promise<{ id: string | null } | { error: string }> {
  const value = String(raw ?? "").trim();
  if (!value) return { id: null };
  if (!UUID_PATTERN.test(value)) return { error: "That host selection is not valid." };
  const { data, error } = await service
    .from("speaker_profiles")
    .select("id, profile_type")
    .eq("id", value)
    .maybeSingle();
  if (error || !data) return { error: "That host profile no longer exists." };
  const type = (data as { profile_type: string }).profile_type;
  if (type === "main_stage") {
    return {
      error:
        "That profile is main-stage only. Switch them to 'workshop host' or 'both' in /admin/speakers first.",
    };
  }
  return { id: value };
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
  if (!validated.ok) return { error: validated.error, values: echoFormValues(formData) };
  const v = validated.value;

  const service = createSupabaseServiceClient();
  const host = await resolveHostProfileId(service, formData.get("hostProfileId"));
  if ("error" in host) return { error: host.error, values: echoFormValues(formData) };

  const { data, error } = await service
    .from("workshops")
    .insert({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      host_profile_id: host.id,
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
    return { error: "Could not create the workshop. Try again.", values: echoFormValues(formData) };
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
  if (!validated.ok) return { error: validated.error, values: echoFormValues(formData) };
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
      values: echoFormValues(formData),
    };
  }

  const host = await resolveHostProfileId(service, formData.get("hostProfileId"));
  if ("error" in host) return { error: host.error, values: echoFormValues(formData) };

  const { error } = await service
    .from("workshops")
    .update({
      title: v.title,
      description: v.description,
      speaker_name: v.speakerName,
      host_profile_id: host.id,
      room: v.room,
      starts_at: v.startsAt.toISOString(),
      ends_at: v.endsAt.toISOString(),
      capacity: v.capacity,
    })
    .eq("id", workshopId);
  if (error) {
    console.error("[admin/workshops] update failed:", error.message);
    return { error: "Could not save the workshop. Try again.", values: echoFormValues(formData) };
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
