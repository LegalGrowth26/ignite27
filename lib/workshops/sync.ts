import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKSHOP_CAPACITY } from "./config";

// A workshop host's content lives on their speaker profile (the same
// talk_* columns the editor writes) and is mirrored onto their linked
// workshop row here, on every save: the host's editor for their own
// page, and the admin speaker editor for fixes.
//
// Rules (decision, September 2026):
//   - Applies to profile_type 'workshop_host' only. A 'both' profile's
//     talk fields ARE their main-stage talk, so their workshop stays
//     admin-managed (flagged limitation; no 'both' hosts exist today).
//   - First save with a title CREATES the workshop, capacity 24, room
//     and times empty, and PUBLISHES it immediately: it appears on
//     /workshops in the "time and room to be confirmed" state.
//   - Later saves update content only. published_at is never touched
//     again, so an admin unpublish (the safety net) sticks until an
//     admin republishes.
//   - Room, times, capacity are never written from here.

export interface HostContentSource {
  displayName: string;
  talkTitle: string;
  talkDescription: string;
}

export interface HostWorkshopContent {
  title: string;
  description: string;
  speaker_name: string;
}

// Pure and unit-tested: what the workshop row should say, or null when
// there is no title yet (nothing worth showing on /workshops).
export function buildHostWorkshopContent(
  source: HostContentSource,
): HostWorkshopContent | null {
  const title = source.talkTitle.trim();
  if (!title) return null;
  return {
    title,
    description: source.talkDescription.trim(),
    speaker_name: source.displayName.trim(),
  };
}

// Service-client write (ownership is established by the caller before
// this runs). Never throws: a failed sync is logged loudly and the
// profile save still succeeds; the next save retries it.
export async function syncHostWorkshopSafe(
  service: SupabaseClient,
  profile: { id: string; profileType: string } & HostContentSource,
  logContext: string,
): Promise<void> {
  try {
    if (profile.profileType !== "workshop_host") return;
    const content = buildHostWorkshopContent(profile);
    if (!content) return;

    const { data: existing, error: lookupErr } = await service
      .from("workshops")
      .select("id")
      .eq("host_profile_id", profile.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw new Error(`workshop lookup failed: ${lookupErr.message}`);

    if (existing) {
      const { error } = await service
        .from("workshops")
        .update(content)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(`workshop content update failed: ${error.message}`);
      return;
    }

    const { error: insertErr } = await service.from("workshops").insert({
      ...content,
      host_profile_id: profile.id,
      capacity: WORKSHOP_CAPACITY,
      room: null,
      starts_at: null,
      ends_at: null,
      // Auto-publish: host-completed workshops go straight onto
      // /workshops as "time and room to be confirmed".
      published_at: new Date().toISOString(),
    });
    if (insertErr) throw new Error(`workshop insert failed: ${insertErr.message}`);
  } catch (err) {
    console.error(`[workshop-sync] ${logContext}:`, err);
  }
}
