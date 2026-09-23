"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import { validateWorkshopSchedule } from "@/lib/workshops/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Admin side of the workshop split (decision, September 2026): the
// HOST owns the content (title, description, takeaways, images) via
// their /speaker editor, which creates and auto-publishes the linked
// workshop in a "time and room to be confirmed" state. The admin owns
// the SCHEDULE: room and times, edited here and updating the published
// row in place. There is no admin create; unpublish stays as the
// safety net and publish brings a workshop back.

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

export async function updateWorkshopScheduleAction(
  workshopId: string,
  _prev: WorkshopFormState,
  formData: FormData,
): Promise<WorkshopFormState> {
  const ctx = await requireSuperAdmin();
  const validated = validateWorkshopSchedule({
    speakerName: formData.get("speakerName"),
    room: formData.get("room"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!validated.ok) return { error: validated.error, values: echoFormValues(formData) };
  const v = validated.value;

  const service = createSupabaseServiceClient();
  const host = await resolveHostProfileId(service, formData.get("hostProfileId"));
  if ("error" in host) return { error: host.error, values: echoFormValues(formData) };

  // Schedule columns only: content and capacity are never written here.
  const { error } = await service
    .from("workshops")
    .update({
      speaker_name: v.speakerName,
      host_profile_id: host.id,
      room: v.room,
      starts_at: v.startsAt ? v.startsAt.toISOString() : null,
      ends_at: v.endsAt ? v.endsAt.toISOString() : null,
    })
    .eq("id", workshopId);
  if (error) {
    console.error("[admin/workshops] schedule update failed:", error.message);
    return { error: "Could not save the schedule. Try again.", values: echoFormValues(formData) };
  }

  await logAdminAction(ctx.appUserId, "workshop.schedule", {
    workshop_id: workshopId,
    room: v.room,
    starts_at: v.startsAt?.toISOString() ?? null,
    ends_at: v.endsAt?.toISOString() ?? null,
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
