import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidRefSlug } from "./attribution";

// Resolve a checkout session's ref_slug metadata to an ACTIVE
// ambassador id at booking-write time (webhook). Deactivated or
// unknown slugs resolve to null: attribution silently degrades, the
// booking is never affected.
export async function resolveAmbassadorIdForSlug(
  client: SupabaseClient,
  rawSlug: string | null | undefined,
): Promise<string | null> {
  if (!isValidRefSlug(rawSlug)) return null;
  const { data, error } = await client
    .from("ambassadors")
    .select("id")
    .eq("slug", rawSlug)
    .is("deactivated_at", null)
    .maybeSingle();
  if (error) {
    console.error("[ambassador] slug resolve failed (continuing unattributed):", error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}
