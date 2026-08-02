import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export interface AdminContext {
  client: SupabaseClient;
  appUserId: string;
  authUserId: string;
}

// Server-side breadcrumb for denied admin access. Deliberately terse
// and PII-free (UUIDs, error codes, role names; never emails or
// tokens): visitors still see a bare 404, but Vercel logs show exactly
// which branch denied, so "/admin 404s for a real super admin" is
// diagnosable instead of silent.
function logAdminDenied(reason: string, detail: Record<string, unknown> = {}) {
  console.warn(`[admin-gate] denied: ${reason}`, JSON.stringify(detail));
}

// Core check, separated from the Next-specific guard so it can be unit
// tested with a stub client. Returns null unless the signed-in user's
// app row exists AND carries role 'super_admin'. Every failure mode
// (no session, no users row, wrong role, query error) collapses to null
// so callers can 404 without leaking whether /admin exists.
export async function resolveAdminContext(
  client: SupabaseClient,
): Promise<AdminContext | null> {
  const { data: userData, error: authError } = await client.auth.getUser();
  if (authError || !userData?.user) {
    logAdminDenied("no-session", { authError: authError?.message ?? null });
    return null;
  }

  const { data, error } = await client
    .from("users")
    .select("id, role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (error) {
    logAdminDenied("users-query-error", {
      authUserId: userData.user.id,
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return null;
  }
  if (!data) {
    logAdminDenied("no-users-row", { authUserId: userData.user.id });
    return null;
  }
  if ((data as { role: string }).role !== "super_admin") {
    logAdminDenied("role-mismatch", {
      authUserId: userData.user.id,
      appUserId: (data as { id: string }).id,
      role: (data as { role: string }).role,
    });
    return null;
  }

  return {
    client,
    appUserId: (data as { id: string }).id,
    authUserId: userData.user.id,
  };
}

// Page/action guard: non-admins get a 404 (NOT a login redirect; the
// brief is explicit that /admin should not advertise its existence).
export async function requireSuperAdmin(): Promise<AdminContext> {
  const client = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(client);
  if (!ctx) notFound();
  return ctx;
}

// Non-throwing variant for UI decisions (e.g. whether to show the Admin
// nav link). Never throws; false on any error.
export async function getIsSuperAdmin(): Promise<boolean> {
  try {
    const client = await createSupabaseServerClient();
    const ctx = await resolveAdminContext(client);
    return ctx !== null;
  } catch {
    return false;
  }
}
