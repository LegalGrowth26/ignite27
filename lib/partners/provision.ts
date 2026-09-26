import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePercentCode } from "@/lib/ambassadors/ensure-code";
import {
  ambassadorSlugFromProfileSlug,
  hostDiscountCode,
} from "@/lib/speakers/host-invite";
import { slugifyCompany } from "@/lib/exhibitors/profile";
import { PARTNER_DISCOUNT_PERCENT } from "./package";

// Built-in comps: the partner form owns ONE ambassador row per
// partner (ambassadors.partner_id). Saving the form provisions or
// syncs it; the NO-TRAMPLE rule (approved) means a contact who
// already has an unrelated ambassador row (say, a workshop host)
// keeps it untouched and the form shows a notice instead.

export type ProvisionState =
  | { state: "created"; slug: string; codeReady: boolean }
  | { state: "synced"; slug: string; clampedTo: number | null }
  | { state: "existing_other"; slug: string }
  | { state: "failed" };

// Pure and unit-tested: which way a save goes.
export function provisionDecision(input: {
  ownRow: { id: string } | null; // ambassadors row with THIS partner_id
  otherRow: { slug: string } | null; // any other row on the contact's user
}): "sync" | "no_trample" | "create" {
  if (input.ownRow) return "sync";
  if (input.otherRow) return "no_trample";
  return "create";
}

// Allowance sync can never go below comps already spent (same rule as
// the ambassador admin's allowance edits).
export function syncedAllowance(requested: number, spent: number): {
  allowance: number;
  clampedTo: number | null;
} {
  if (requested < spent) return { allowance: spent, clampedTo: spent };
  return { allowance: requested, clampedTo: null };
}

export async function ensurePartnerAmbassador(
  service: SupabaseClient,
  partner: { id: string; company_name: string; contact_name: string },
  appUserId: string,
  allowance: number,
): Promise<ProvisionState> {
  try {
    const { data: ownData } = await service
      .from("ambassadors")
      .select("id, slug")
      .eq("partner_id", partner.id)
      .maybeSingle();
    const ownRow = ownData as { id: string; slug: string } | null;

    const { data: userData } = await service
      .from("ambassadors")
      .select("id, slug, partner_id")
      .eq("user_id", appUserId)
      .maybeSingle();
    const userRow = userData as {
      id: string;
      slug: string;
      partner_id: string | null;
    } | null;
    const otherRow = userRow && userRow.partner_id !== partner.id ? userRow : null;

    const decision = provisionDecision({ ownRow, otherRow });

    if (decision === "no_trample") {
      return { state: "existing_other", slug: otherRow!.slug };
    }

    if (decision === "sync") {
      const { count } = await service
        .from("ambassador_comps")
        .select("id", { count: "exact", head: true })
        .eq("ambassador_id", ownRow!.id);
      const { allowance: next, clampedTo } = syncedAllowance(allowance, count ?? 0);
      const { error } = await service
        .from("ambassadors")
        .update({ comp_allowance: next })
        .eq("id", ownRow!.id);
      if (error) throw new Error(`allowance sync failed: ${error.message}`);
      return { state: "synced", slug: ownRow!.slug, clampedTo };
    }

    // Create: role upgrade (super admins keep their role, dual role
    // rides on the ambassadors row alone), slug from the company name,
    // fixed 20% code shared with the host pattern.
    const { data: roleData } = await service
      .from("users")
      .select("role")
      .eq("id", appUserId)
      .maybeSingle();
    if ((roleData as { role: string } | null)?.role !== "super_admin") {
      const { error: roleErr } = await service
        .from("users")
        .update({ role: "ambassador" })
        .eq("id", appUserId);
      if (roleErr) throw new Error(`role update failed: ${roleErr.message}`);
    }

    const companySlug = slugifyCompany(partner.company_name);
    const { data: takenRows } = await service
      .from("ambassadors")
      .select("slug")
      .like("slug", `${companySlug.slice(0, 20)}%`);
    const taken = new Set(
      ((takenRows ?? []) as Array<{ slug: string }>).map((r) => r.slug),
    );
    const slug = ambassadorSlugFromProfileSlug(companySlug, taken);

    const code = hostDiscountCode(companySlug);
    const codeReady = await ensurePercentCode(
      code,
      PARTNER_DISCOUNT_PERCENT,
      "partner package personal code",
      "partner-package",
    );

    const { error: insertErr } = await service.from("ambassadors").insert({
      user_id: appUserId,
      slug,
      display_name: partner.contact_name,
      company: partner.company_name,
      ambassador_type: "partner",
      comp_allowance: allowance,
      discount_percent: PARTNER_DISCOUNT_PERCENT,
      promo_code: codeReady ? code : null,
      partner_id: partner.id,
    });
    if (insertErr) throw new Error(`ambassadors insert failed: ${insertErr.message}`);
    return { state: "created", slug, codeReady };
  } catch (err) {
    console.error("[partner-package] ambassador provisioning failed:", err);
    return { state: "failed" };
  }
}
