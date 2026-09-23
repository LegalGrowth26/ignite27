"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { ensureSpeakerProfile } from "@/lib/speakers/create-profile";
import { inviteWorkshopHost } from "@/lib/speakers/send-host-invite";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Workshop host invites live HERE, in the workshops admin (decision:
// the workshops section is the host entry point; /admin/speakers stays
// the main-stage one). Draft invitees are unpublished, account-less
// workshop_host profiles; attaching an email invites them properly:
// account + published page + ambassador perks (2 comps, 20% code) +
// the combined welcome email.

export interface HostFormState {
  error: string | null;
}

export async function addHostInviteeAction(
  _prev: HostFormState,
  formData: FormData,
): Promise<HostFormState> {
  const ctx = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const focus = String(formData.get("focus") ?? "").trim();
  if (!name || name.length > 120) {
    return { error: "Host name is required (max 120 characters)." };
  }
  if (focus.length > 200) {
    return { error: "Keep the focus note under 200 characters." };
  }

  try {
    const created = await ensureSpeakerProfile(createSupabaseServiceClient(), {
      displayName: name,
      // Internal note only: talk_title never renders for workshop
      // hosts (their session data comes from the linked workshop).
      talkTitle: focus,
      profileType: "workshop_host",
      startUnpublished: true,
    });
    await logAdminAction(ctx.appUserId, "host.add_invitee", {
      speaker_profile_id: created.profileId,
      slug: created.slug,
    });
  } catch (err) {
    console.error("[admin/hosts] add invitee failed:", err);
    return { error: "Could not add the invitee. Try again." };
  }

  revalidatePath("/admin/workshops");
  redirect("/admin/workshops?status=invitee_added");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export async function inviteHostAction(
  profileId: string,
  _prev: HostFormState,
  formData: FormData,
): Promise<HostFormState> {
  const ctx = await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "That email does not look right." };

  let result;
  try {
    result = await inviteWorkshopHost(profileId, email);
  } catch (err) {
    console.error("[admin/hosts] invite failed:", err);
    return {
      error:
        err instanceof Error && /different account/.test(err.message)
          ? "This page is already linked to a different account."
          : "Could not send the invite. Try again.",
    };
  }

  await logAdminAction(ctx.appUserId, "host.invite", {
    speaker_profile_id: profileId,
    email_sent: result.emailSent,
    ambassador_ready: result.ambassadorReady,
    code_ready: result.codeReady,
  });

  revalidatePath("/admin/workshops");
  revalidatePath("/speakers");
  const status = !result.emailSent
    ? "invited_email_failed"
    : !result.ambassadorReady || !result.codeReady
      ? "invited_perks_partial"
      : "invited";
  redirect(`/admin/workshops?status=${status}`);
}

// Resend to the email already on the account; the whole flow is
// idempotent (existing code and ambassador row are reused untouched).
export async function resendHostInviteAction(profileId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("speaker_profiles")
    .select("user_id, users ( email )")
    .eq("id", profileId)
    .maybeSingle();
  const email = (data as unknown as { users: { email: string } | null } | null)?.users
    ?.email;
  if (!email) throw new Error("host has no account email to resend to");

  const result = await inviteWorkshopHost(profileId, email);
  await logAdminAction(ctx.appUserId, "host.resend_invite", {
    speaker_profile_id: profileId,
    email_sent: result.emailSent,
  });
  revalidatePath("/admin/workshops");
}
