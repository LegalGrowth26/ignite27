import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export interface AmbassadorRow {
  id: string;
  slug: string;
  display_name: string;
  company: string | null;
  ambassador_type: "speaker" | "partner";
  comp_allowance: number;
  discount_percent: number | null;
  promo_code: string | null;
  link_clicks: number;
  deactivated_at: string | null;
}

export interface AmbassadorContext {
  client: SupabaseClient;
  appUserId: string;
  ambassador: AmbassadorRow;
}

// Same observability rule as the admin gate: visitors only ever see a
// 404, so every denial logs a PII-free breadcrumb (UUIDs, roles, error
// codes; never emails or tokens) naming the failing branch.
function logAmbassadorDenied(reason: string, detail: Record<string, unknown> = {}) {
  console.warn(`[ambassador-gate] denied: ${reason}`, JSON.stringify(detail));
}

// Core check, unit-testable with a stub client. Null unless the signed
// in user's app row carries role 'ambassador' AND an ACTIVE ambassadors
// row exists for them. Deactivated ambassadors are locked out (their
// history is kept; reactivation restores access).
export async function resolveAmbassadorContext(
  client: SupabaseClient,
): Promise<AmbassadorContext | null> {
  const { data: userData, error: authError } = await client.auth.getUser();
  if (authError || !userData?.user) {
    logAmbassadorDenied("no-session", { authError: authError?.message ?? null });
    return null;
  }

  const { data: userRow, error: userErr } = await client
    .from("users")
    .select("id, role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (userErr || !userRow) {
    logAmbassadorDenied(userErr ? "users-query-error" : "no-users-row", {
      authUserId: userData.user.id,
      message: userErr?.message ?? null,
    });
    return null;
  }
  if ((userRow as { role: string }).role !== "ambassador") {
    logAmbassadorDenied("role-mismatch", {
      appUserId: (userRow as { id: string }).id,
      role: (userRow as { role: string }).role,
    });
    return null;
  }

  const appUserId = (userRow as { id: string }).id;
  const { data: ambassador, error: ambErr } = await client
    .from("ambassadors")
    .select(
      "id, slug, display_name, company, ambassador_type, comp_allowance, discount_percent, promo_code, link_clicks, deactivated_at",
    )
    .eq("user_id", appUserId)
    .maybeSingle();
  if (ambErr || !ambassador) {
    logAmbassadorDenied(ambErr ? "ambassador-query-error" : "no-ambassador-row", {
      appUserId,
      message: ambErr?.message ?? null,
    });
    return null;
  }
  if ((ambassador as AmbassadorRow).deactivated_at !== null) {
    logAmbassadorDenied("deactivated", { appUserId });
    return null;
  }

  return { client, appUserId, ambassador: ambassador as AmbassadorRow };
}

// Page/action guard: non-ambassadors get a 404 (not a login redirect;
// /ambassador does not advertise its existence, same as /admin).
export async function requireAmbassador(): Promise<AmbassadorContext> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAmbassadorContext(client);
  if (!ctx) notFound();
  return ctx;
}
