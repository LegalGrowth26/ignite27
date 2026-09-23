import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAuthUserWithStatus, upsertAppUser } from "@/lib/bookings/create";
import { pickAvailableSlug, slugifyCompany } from "@/lib/exhibitors/profile";
import type { SpeakerProfileType } from "./profile";

// Speaker creation, used by the admin add-speaker action and the
// one-off seed backfill. Two halves that compose:
//   - ensureSpeakerProfile: mint the page (slug from the name),
//     published immediately (adding = announcing). Idempotent by slug
//     collision handling; the caller decides identity.
//   - attachSpeakerAccount: create/find the auth + app user for an
//     email and link it to a profile whose user_id is null. Used at
//     add time when an email is known, or later from admin for pages
//     seeded account-less.

export interface CreateSpeakerInput {
  displayName: string;
  talkTitle: string;
  photoPath?: string | null;
  bio?: string;
  // main_stage (default) | workshop_host | both.
  profileType?: SpeakerProfileType;
  // Draft invitees (host invite list): page exists but stays
  // unpublished until the person is actually invited.
  startUnpublished?: boolean;
}

export interface CreateSpeakerResult {
  profileId: string;
  slug: string;
}

// Pure row builder, unit-tested: a draft invitee carries an EXPLICIT
// published_at null (overriding the column default of now()); the
// normal add omits the key so the default publishes immediately.
// Requires published_at to be nullable (migration 20260513).
export function speakerProfileInsertRow(
  input: CreateSpeakerInput,
  slug: string,
): Record<string, unknown> {
  return {
    slug,
    display_name: input.displayName.trim().slice(0, 120),
    talk_title: (input.talkTitle ?? "").trim().slice(0, 200),
    bio: (input.bio ?? "").slice(0, 2000),
    photo_path: input.photoPath ?? null,
    profile_type: input.profileType ?? "main_stage",
    ...(input.startUnpublished ? { published_at: null } : {}),
  };
}

export async function ensureSpeakerProfile(
  service: SupabaseClient,
  input: CreateSpeakerInput,
): Promise<CreateSpeakerResult> {
  const name = input.displayName.trim();
  if (!name) throw new Error("speaker needs a name");

  const base = slugifyCompany(name);
  const { data: takenRows, error: takenErr } = await service
    .from("speaker_profiles")
    .select("slug")
    .like("slug", `${base}%`);
  if (takenErr) throw new Error(`speaker slug lookup failed: ${takenErr.message}`);
  const taken = new Set(
    ((takenRows ?? []) as Array<{ slug: string }>).map((r) => r.slug),
  );
  const slug = pickAvailableSlug(base, taken);

  const { data, error } = await service
    .from("speaker_profiles")
    .insert(speakerProfileInsertRow(input, slug))
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`speaker profile insert failed: ${error?.message}`);
  }
  return { profileId: (data as { id: string }).id, slug };
}

export interface AttachAccountResult {
  appUserId: string;
  created: boolean; // false = the profile already had this account linked
  // True when the email matched an EXISTING IGNITE! account (a past
  // booker, ambassador, or earlier invite): the profile attaches to it
  // and the invite email says to log in with it rather than sending a
  // set-password link that would reset their live password.
  accountExisted: boolean;
}

export async function attachSpeakerAccount(
  service: SupabaseClient,
  profileId: string,
  email: string,
  displayName: string,
): Promise<AttachAccountResult> {
  const [firstName, ...rest] = displayName.trim().split(/\s+/);
  const { authUserId, accountExisted } = await ensureAuthUserWithStatus(service, email, {
    first_name: firstName ?? "",
    surname: rest.join(" "),
  });
  const appUserId = await upsertAppUser(service, email, authUserId, {
    firstName: firstName ?? "",
    surname: rest.join(" "),
    mobile: "",
    company: "",
    jobTitle: "Speaker",
    marketingOptIn: false,
  });

  // Link only when unlinked or already this user; never silently
  // re-point a profile at a different account.
  const { data: existing, error: readErr } = await service
    .from("speaker_profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (readErr || !existing) {
    throw new Error(`speaker profile lookup failed: ${readErr?.message ?? "not found"}`);
  }
  const currentUserId = (existing as { user_id: string | null }).user_id;
  if (currentUserId === appUserId) return { appUserId, created: false, accountExisted };
  if (currentUserId !== null) {
    throw new Error("this speaker page is already linked to a different account");
  }

  const { error: linkErr } = await service
    .from("speaker_profiles")
    .update({ user_id: appUserId })
    .eq("id", profileId)
    .is("user_id", null);
  if (linkErr) throw new Error(`speaker account link failed: ${linkErr.message}`);
  return { appUserId, created: true, accountExisted };
}
