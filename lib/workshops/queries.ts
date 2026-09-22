import type { SupabaseClient } from "@supabase/supabase-js";

// Workshop reads. Public listing runs on the service client
// (consistent with the other public reads; only published rows and
// aggregate counts leave this module). Per-user reads (my bookings,
// eligibility) run on the caller's own client under RLS.

export interface WorkshopRow {
  id: string;
  title: string;
  description: string;
  speaker_name: string | null;
  room: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  published_at: string | null;
}

// The host's public identity, when the workshop is linked to a
// PUBLISHED speaker profile (host_profile_id). The free-text
// speaker_name stays as the fallback for unlinked hosts.
export interface WorkshopHost {
  slug: string;
  displayName: string;
}

export interface PublicWorkshop extends WorkshopRow {
  booked: number;
  spacesLeft: number;
  host: WorkshopHost | null;
}

interface HostEmbedRow {
  slug: string;
  display_name: string;
  published_at: string | null;
}

// Pure and unit-tested: a linked UNPUBLISHED profile must not leak a
// dead link; it falls back to the plain text name like an unlinked
// workshop.
export function resolveWorkshopHost(
  embed: HostEmbedRow | null | undefined,
): WorkshopHost | null {
  if (!embed || !embed.published_at) return null;
  return { slug: embed.slug, displayName: embed.display_name };
}

const PUBLIC_WORKSHOP_COLUMNS =
  "id, title, description, speaker_name, room, starts_at, ends_at, capacity, published_at, " +
  "workshop_bookings(count), speaker_profiles ( slug, display_name, published_at )";

type RawPublicWorkshop = WorkshopRow & {
  workshop_bookings: Array<{ count: number }>;
  speaker_profiles: HostEmbedRow | null;
};

function toPublicWorkshop(w: RawPublicWorkshop): PublicWorkshop {
  const booked = w.workshop_bookings?.[0]?.count ?? 0;
  return {
    ...w,
    booked,
    spacesLeft: Math.max(0, w.capacity - booked),
    host: resolveWorkshopHost(w.speaker_profiles),
  };
}

export async function fetchPublishedWorkshops(
  client: SupabaseClient,
): Promise<PublicWorkshop[]> {
  const { data, error } = await client
    .from("workshops")
    .select(PUBLIC_WORKSHOP_COLUMNS)
    .not("published_at", "is", null)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`workshops query failed: ${error.message}`);
  return ((data ?? []) as unknown as RawPublicWorkshop[]).map(toPublicWorkshop);
}

export async function fetchPublishedWorkshop(
  client: SupabaseClient,
  id: string,
): Promise<PublicWorkshop | null> {
  const { data, error } = await client
    .from("workshops")
    .select(PUBLIC_WORKSHOP_COLUMNS)
    .eq("id", id)
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(`workshop query failed: ${error.message}`);
  if (!data) return null;
  return toPublicWorkshop(data as unknown as RawPublicWorkshop);
}

// The signed-in user's booked workshop ids (RLS: own rows only).
export async function fetchMyWorkshopIds(
  client: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("workshop_bookings")
    .select("workshop_id");
  if (error) {
    console.error("[workshops] my-bookings query failed:", error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as Array<{ workshop_id: string }>).map((r) => r.workshop_id),
  );
}

export interface WorkshopEligibility {
  hasBooking: boolean;
  isVip: boolean;
}

// Whether the signed-in user holds a completed event booking, and a VIP
// one. Backed by the workshop_eligibility() definer function so the
// answer matches what book_workshop will enforce.
export async function fetchWorkshopEligibility(
  client: SupabaseClient,
): Promise<WorkshopEligibility> {
  const { data, error } = await client.rpc("workshop_eligibility");
  if (error) {
    console.error("[workshops] eligibility query failed:", error.message);
    return { hasBooking: false, isVip: false };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { has_booking: boolean; is_vip: boolean }
    | undefined;
  return {
    hasBooking: Boolean(row?.has_booking),
    isVip: Boolean(row?.is_vip),
  };
}
