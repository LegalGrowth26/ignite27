"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { normaliseRefSlug } from "@/lib/ambassadors/attribution";
import { sendAmbassadorInvite } from "@/lib/ambassadors/send-invite";
import { ensureAuthUser, upsertAppUser } from "@/lib/bookings/create";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export interface AmbassadorActionState {
  error: string | null;
  created: string | null;
}

// Provision an ambassador: auth account + users row (role upgraded to
// 'ambassador' unless they are a super admin, whose role is NEVER
// touched: dual role rides on the ambassadors row alone), ambassadors
// row, invite email with a set-password link. Existing customers
// upgrade and keep their bookings; existing ambassadors are refused as
// duplicates.
export async function createAmbassadorAction(
  _prev: AmbassadorActionState,
  formData: FormData,
): Promise<AmbassadorActionState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const firstName = String(formData.get("firstName") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const type = formData.get("type") === "partner" ? "partner" : "speaker";
  const slug = normaliseRefSlug(formData.get("slug"));
  const allowanceRaw = String(formData.get("compAllowance") ?? "0").trim();
  const allowance = Number.parseInt(allowanceRaw || "0", 10);
  const discountRaw = String(formData.get("discountPercent") ?? "").trim();
  const discountPercent = discountRaw ? Number.parseInt(discountRaw, 10) : null;

  if (!firstName || !surname) return { error: "First name and surname are required.", created: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email does not look right.", created: null };
  if (!slug) return { error: "Link slug must be 2-30 characters: lowercase letters, numbers, hyphens.", created: null };
  if (!Number.isInteger(allowance) || allowance < 0) return { error: "Comp allowance must be 0 or more.", created: null };
  if (discountPercent !== null && (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100)) {
    return { error: "Discount percent must be between 1 and 100.", created: null };
  }

  const { data: existingUser } = await service
    .from("users")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();
  const existing = existingUser as { id: string; role: string } | null;
  if (existing?.role === "ambassador") {
    return { error: "That email is already an ambassador.", created: null };
  }
  const isSuperAdmin = existing?.role === "super_admin";
  if (isSuperAdmin) {
    const { data: existingAmb } = await service
      .from("ambassadors")
      .select("id")
      .eq("user_id", existing!.id)
      .maybeSingle();
    if (existingAmb) {
      return { error: "That email is already an ambassador.", created: null };
    }
  }

  try {
    const authUserId = await ensureAuthUser(service, email, {
      first_name: firstName,
      surname,
      company,
    });
    const appUserId = await upsertAppUser(service, email, authUserId, {
      firstName,
      surname,
      mobile: "",
      company,
      jobTitle: "",
      marketingOptIn: false,
    });

    // Dual role: a super admin keeps super_admin; the ambassadors row
    // alone grants them the dashboard. Everyone else upgrades.
    if (!isSuperAdmin) {
      const { error: roleErr } = await service
        .from("users")
        .update({ role: "ambassador" })
        .eq("id", appUserId);
      if (roleErr) throw new Error(`role update failed: ${roleErr.message}`);
    }

    const { error: insertErr } = await service.from("ambassadors").insert({
      user_id: appUserId,
      slug,
      display_name: `${firstName} ${surname}`,
      company: company || null,
      ambassador_type: type,
      comp_allowance: allowance,
      discount_percent: discountPercent,
    });
    if (insertErr) {
      if (/slug/.test(insertErr.message)) {
        return { error: "That link slug is already taken.", created: null };
      }
      throw new Error(`ambassadors insert failed: ${insertErr.message}`);
    }

    try {
      await sendAmbassadorInvite({ firstName, email, slug, compAllowance: allowance });
    } catch (err) {
      // The ambassador exists; a failed invite is recoverable from the
      // login page's forgot-password flow. Log loudly, don't roll back.
      console.error("[admin/ambassadors] invite email failed:", err);
    }

    await logAdminAction(ctx.appUserId, "ambassador.create", {
      slug,
      ambassador_type: type,
      comp_allowance: allowance,
      discount_percent: discountPercent,
    });

    revalidatePath("/admin/ambassadors");
    return { error: null, created: slug };
  } catch (err) {
    console.error("[admin/ambassadors] create failed:", err);
    return { error: "Could not create the ambassador. Check the details and try again.", created: null };
  }
}

export async function adjustAllowanceAction(
  ambassadorId: string,
  formData: FormData,
): Promise<void> {
  const ctx = await requireSuperAdmin();
  const allowance = Number.parseInt(String(formData.get("compAllowance") ?? ""), 10);
  if (!Number.isInteger(allowance) || allowance < 0) return;

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("ambassadors")
    .update({ comp_allowance: allowance })
    .eq("id", ambassadorId);
  if (error) throw new Error(`allowance update failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "ambassador.adjust_allowance", {
    ambassador_id: ambassadorId,
    comp_allowance: allowance,
  });
  revalidatePath("/admin/ambassadors");
}

// Deactivate = link stops attributing, dashboard locks, history kept.
export async function toggleAmbassadorActiveAction(ambassadorId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("ambassadors")
    .select("deactivated_at")
    .eq("id", ambassadorId)
    .maybeSingle();
  const isDeactivated = Boolean((data as { deactivated_at: string | null } | null)?.deactivated_at);

  const { error } = await service
    .from("ambassadors")
    .update({ deactivated_at: isDeactivated ? null : new Date().toISOString() })
    .eq("id", ambassadorId);
  if (error) throw new Error(`toggle failed: ${error.message}`);

  await logAdminAction(
    ctx.appUserId,
    isDeactivated ? "ambassador.reactivate" : "ambassador.deactivate",
    { ambassador_id: ambassadorId },
  );
  revalidatePath("/admin/ambassadors");
  revalidatePath("/ambassador");
}
