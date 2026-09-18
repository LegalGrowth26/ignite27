import type { SupabaseClient } from "@supabase/supabase-js";
import { pickAvailableSlug, slugifyCompany } from "./profile";

// Auto-creation of exhibitor profile pages: paid (or comp) exhibitor
// booking = page exists, no approval step. Called from the webhook
// right after the booking is written, and from the one-off admin
// backfill. Idempotent: the unique booking_id means an existing
// profile short-circuits, and a create race resolves to the winner.

export interface EnsureProfileInput {
  bookingId: string;
  companyName: string | null;
  fallbackName: string | null; // attendee company / contact name for old rows
  contactEmail: string | null;
  logoPath?: string | null; // inherited from an existing requirements row
  websiteUrl?: string | null; // from checkout or an existing requirements row
  // Backfill only: a booking the admin had hidden under the old
  // listing model gets its page created UNPUBLISHED, so the hide
  // survives the switch to profile-based listings.
  startUnpublished?: boolean;
}

export interface EnsureProfileResult {
  created: boolean;
  slug: string | null;
}

export async function ensureExhibitorProfile(
  service: SupabaseClient,
  input: EnsureProfileInput,
): Promise<EnsureProfileResult> {
  const { data: existing, error: existingErr } = await service
    .from("exhibitor_profiles")
    .select("slug")
    .eq("booking_id", input.bookingId)
    .maybeSingle();
  if (existingErr) {
    throw new Error(`profile lookup failed: ${existingErr.message}`);
  }
  if (existing) {
    return { created: false, slug: (existing as { slug: string }).slug };
  }

  const displayName = (input.companyName ?? input.fallbackName ?? "").trim();
  if (!displayName) {
    // A booking with no usable name anywhere cannot have a page yet;
    // the backfill reports these instead of inventing names.
    return { created: false, slug: null };
  }

  const base = slugifyCompany(displayName);
  const { data: takenRows, error: takenErr } = await service
    .from("exhibitor_profiles")
    .select("slug")
    .like("slug", `${base}%`);
  if (takenErr) throw new Error(`slug lookup failed: ${takenErr.message}`);
  const taken = new Set(
    ((takenRows ?? []) as Array<{ slug: string }>).map((r) => r.slug),
  );
  const slug = pickAvailableSlug(base, taken);

  const { error: insertErr } = await service.from("exhibitor_profiles").insert({
    booking_id: input.bookingId,
    slug,
    display_name: displayName.slice(0, 120),
    contact_email: input.contactEmail,
    logo_path: input.logoPath ?? null,
    website_url: input.websiteUrl ?? null,
    ...(input.startUnpublished ? { published_at: null } : {}),
  });
  if (insertErr) {
    // Unique-violation race on booking_id: someone else created it
    // between our check and insert. That is success.
    if (/duplicate key|unique/.test(insertErr.message)) {
      return { created: false, slug };
    }
    throw new Error(`profile insert failed: ${insertErr.message}`);
  }
  return { created: true, slug };
}

// Webhook wrapper: a profile failure must never affect the booking.
export async function ensureExhibitorProfileSafe(
  service: SupabaseClient,
  input: EnsureProfileInput,
  context: string,
): Promise<void> {
  try {
    const result = await ensureExhibitorProfile(service, input);
    if (result.created) {
      console.info(`[exhibitor-pages] created /exhibitors/${result.slug}: ${context}`);
    }
  } catch (err) {
    console.error(`[exhibitor-pages] profile creation FAILED (booking unaffected): ${context}`, err);
  }
}
