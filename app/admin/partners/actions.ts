"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { findCategoryClash, validatePartner } from "@/lib/partners/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Partner CRUD: offline deals recorded here, no checkout anywhere.
// Category exclusivity WARNS (never blocks): the first submit into an
// occupied category comes back with the clash named and an explicit
// "add anyway" tick is required. Everything audit-logged; no deletes,
// "ended" keeps the record and drops the partner off the site.

export interface PartnerFormState {
  error: string | null;
  clashWith: string | null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function revalidatePartnerSurfaces(): void {
  revalidatePath("/admin/partners");
  revalidatePath("/");
  revalidatePath("/exhibit");
}

// Shared by add and edit. partnerId null = create.
export async function savePartnerAction(
  partnerId: string | null,
  _prev: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const validated = validatePartner({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    tier: formData.get("tier"),
    agreedPricePounds: formData.get("agreedPricePounds"),
    category: formData.get("category"),
    status: formData.get("status"),
    notes: formData.get("notes"),
    websiteUrl: formData.get("websiteUrl"),
  });
  if (!validated.ok) return { error: validated.error, clashWith: null };
  const v = validated.value;

  // Exclusivity warn-not-block: name the clash and require the tick.
  const clashConfirmed = formData.get("confirmClash") === "on";
  if (!clashConfirmed) {
    const { data: existingRows, error: existingErr } = await service
      .from("partners")
      .select("id, company_name, category, status");
    if (existingErr) {
      console.error("[admin/partners] clash lookup failed:", existingErr.message);
      return { error: "Could not check category exclusivity. Try again.", clashWith: null };
    }
    const clash = findCategoryClash(
      (existingRows ?? []) as Array<{
        id: string;
        company_name: string;
        category: string;
        status: string;
      }>,
      v.category,
      partnerId ?? undefined,
    );
    if (clash) {
      return {
        error: null,
        clashWith: clash.companyName,
      };
    }
  }

  const row = {
    company_name: v.companyName,
    contact_name: v.contactName,
    contact_email: v.contactEmail,
    tier: v.tier,
    agreed_price_pence: v.agreedPricePence,
    category: v.category,
    status: v.status,
    notes: v.notes,
    website_url: v.websiteUrl,
  };

  let id = partnerId;
  if (id) {
    const { error } = await service.from("partners").update(row).eq("id", id);
    if (error) {
      console.error("[admin/partners] update failed:", error.message);
      return { error: "Could not save the partner. Try again.", clashWith: null };
    }
  } else {
    const { data, error } = await service
      .from("partners")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      console.error("[admin/partners] insert failed:", error?.message);
      return { error: "Could not add the partner. Try again.", clashWith: null };
    }
    id = (data as { id: string }).id;
  }

  // Optional logo straight into the PUBLIC bucket (admin-only uploads,
  // service role; no private/public dance needed here).
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_LOGO_TYPES[logo.type];
    if (!ext) return { error: "Logo must be a PNG, JPG, WebP, or SVG file.", clashWith: null };
    if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be 2MB or smaller.", clashWith: null };
    const logoPath = `${id}/logo.${ext}`;
    const { error: uploadErr } = await service.storage
      .from("partner-logos")
      .upload(logoPath, logo, { upsert: true, contentType: logo.type });
    if (uploadErr) {
      console.error("[admin/partners] logo upload failed:", uploadErr.message);
      return { error: "Partner saved, but the logo upload failed. Try the logo again.", clashWith: null };
    }
    const { error: linkErr } = await service
      .from("partners")
      .update({ logo_path: logoPath })
      .eq("id", id);
    if (linkErr) {
      console.error("[admin/partners] logo link failed:", linkErr.message);
    }
  }

  await logAdminAction(ctx.appUserId, partnerId ? "partner.update" : "partner.add", {
    partner_id: id,
    company_name: v.companyName,
    tier: v.tier,
    category: v.category,
    status: v.status,
    agreed_price_pence: v.agreedPricePence,
    clash_confirmed: clashConfirmed,
  });

  revalidatePartnerSurfaces();
  redirect(`/admin/partners?status=${partnerId ? "saved" : "added"}`);
}

export async function togglePartnerVisibilityAction(partnerId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("partners")
    .select("visible, company_name")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = data as { visible: boolean; company_name: string } | null;
  if (!partner) throw new Error("partner not found");

  const { error } = await service
    .from("partners")
    .update({ visible: !partner.visible })
    .eq("id", partnerId);
  if (error) throw new Error(`visibility toggle failed: ${error.message}`);

  await logAdminAction(
    ctx.appUserId,
    partner.visible ? "partner.hide" : "partner.show",
    { partner_id: partnerId, company_name: partner.company_name },
  );
  revalidatePartnerSurfaces();
}

export async function endPartnershipAction(partnerId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("partners")
    .select("company_name")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = data as { company_name: string } | null;
  if (!partner) throw new Error("partner not found");

  const { error } = await service
    .from("partners")
    .update({ status: "ended" })
    .eq("id", partnerId);
  if (error) throw new Error(`end partnership failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "partner.end", {
    partner_id: partnerId,
    company_name: partner.company_name,
  });
  revalidatePartnerSurfaces();
}
