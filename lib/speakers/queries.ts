import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialLink } from "@/lib/exhibitors/profile";
import { parseSocialLinks } from "@/lib/exhibitors/profiles";
import { env } from "@/lib/env";
import { parseStoredTakeaways } from "./profile";

// Reads for the speaker pages. speaker_profiles is the SINGLE source
// for /speakers, /speakers/<slug>, and the home speaker cards.
// Published = published_at set. Service client for the public reads
// (consistency with the other public surfaces); only content the
// speaker intends to be public leaves this module — enquiries_email
// and user_id never do.

export interface SpeakerProfileRow {
  id: string;
  slug: string;
  display_name: string;
  photo_path: string | null;
  bio: string;
  talk_title: string;
  talk_description: string;
  talk_takeaways: unknown;
  website_url: string | null;
  social_links: unknown;
  cta_label: string | null;
  cta_url: string | null;
  published_at: string | null;
}

export interface SpeakerCardData {
  slug: string;
  displayName: string;
  talkTitle: string;
  photoUrl: string | null;
}

export interface SpeakerPageData extends SpeakerCardData {
  id: string;
  bio: string;
  talkDescription: string;
  talkTakeaways: string[];
  websiteUrl: string | null;
  socialLinks: SocialLink[];
  cta: { label: string; url: string } | null;
}

// Monogram fallback for speakers without a photo yet.
export function speakerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

// Public photos are served ONLY from the public bucket; the private
// original is copied over at save time (same pipeline as logos).
export function publicPhotoUrl(photoPath: string): string {
  return `${env.supabaseUrl()}/storage/v1/object/public/speaker-photos-public/${photoPath}`;
}

export function toSpeakerPage(row: SpeakerProfileRow): SpeakerPageData {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    talkTitle: row.talk_title,
    photoUrl: row.photo_path ? publicPhotoUrl(row.photo_path) : null,
    bio: row.bio,
    talkDescription: row.talk_description,
    talkTakeaways: parseStoredTakeaways(row.talk_takeaways),
    websiteUrl: row.website_url,
    socialLinks: parseSocialLinks(row.social_links),
    cta: row.cta_label && row.cta_url ? { label: row.cta_label, url: row.cta_url } : null,
  };
}

const PUBLIC_COLUMNS =
  "id, slug, display_name, photo_path, bio, talk_title, talk_description, " +
  "talk_takeaways, website_url, social_links, cta_label, cta_url, published_at";

export async function fetchPublishedSpeakerCards(
  client: SupabaseClient,
): Promise<SpeakerCardData[]> {
  const { data, error } = await client
    .from("speaker_profiles")
    .select("slug, display_name, talk_title, photo_path")
    .not("published_at", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`speaker cards query failed: ${error.message}`);
  return (
    (data ?? []) as Array<
      Pick<SpeakerProfileRow, "slug" | "display_name" | "talk_title" | "photo_path">
    >
  ).map((r) => ({
    slug: r.slug,
    displayName: r.display_name,
    talkTitle: r.talk_title,
    photoUrl: r.photo_path ? publicPhotoUrl(r.photo_path) : null,
  }));
}

export async function fetchPublishedSpeakerBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<SpeakerPageData | null> {
  const { data, error } = await client
    .from("speaker_profiles")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(`speaker query failed: ${error.message}`);
  if (!data) return null;
  return toSpeakerPage(data as unknown as SpeakerProfileRow);
}
