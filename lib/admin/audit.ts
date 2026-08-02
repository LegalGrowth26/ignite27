import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Append a row to admin_audit. Service-role write (the table has no
// insert policy for API roles, making the log effectively append-only
// from the app's perspective). Failures are logged but never break the
// action they are auditing; the action itself already succeeded.
export async function logAdminAction(
  actorUserId: string,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.from("admin_audit").insert({
      actor_user_id: actorUserId,
      action,
      detail,
    });
    if (error) {
      console.error("[admin-audit] insert failed:", action, error.message);
    }
  } catch (err) {
    console.error("[admin-audit] insert threw:", action, err);
  }
}
