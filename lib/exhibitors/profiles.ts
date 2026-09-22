import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialLink } from "./profile";
import { SOCIAL_PLATFORMS } from "./profile";
import { publicLogoUrl } from "./listing";

// Reads for the exhibitor profile pages. exhibitor_profiles is the
// SINGLE source for everything public-facing: the /exhibitors index,
// the /exhibitors/<slug> pages, and the /exhibit strip all show
// published profiles and nothing else. Published = published_at set;
// admin unpublish nulls it and the page drops everywhere at once.
//
// The service client is used for consistency with the other public
// reads (the anon public_select RLS policy would also work); only
// content the exhibitor intends to be public leaves this module.

export interface ExhibitorProfileRow {
  slug: string;
  display_name: string;
  description: string | null;
  logo_path: string | null;
  website_url: string | null;
  social_links: unknown;
  cta_primary_label: string | null;
  cta_primary_url: string | null;
  cta_secondary_label: string | null;
  cta_secondary_url: string | null;
  show_contact_email: boolean;
  contact_email: string | null;
  published_at: string | null;
}

export interface ExhibitorProfileCard {
  slug: string;
  displayName: string;
  logoUrl: string | null;
}

export interface ExhibitorProfilePage extends ExhibitorProfileCard {
  description: string | null;
  websiteUrl: string | null;
  socialLinks: SocialLink[];
  ctas: Array<{ label: string; url: string }>;
  contactEmail: string | null; // only when show_contact_email is true
}

// Stored social_links come from our own validated writes, but parse
// defensively anyway: bad shapes render as no links, never a crash.
export function parseSocialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  const links: SocialLink[] = [];
  for (const entry of raw) {
    const platform = (entry as { platform?: unknown })?.platform;
    const url = (entry as { url?: unknown })?.url;
    if (
      typeof platform === "string" &&
      (SOCIAL_PLATFORMS as readonly string[]).includes(platform) &&
      typeof url === "string" &&
      /^https?:\/\//.test(url) &&
      !links.some((l) => l.platform === platform)
    ) {
      links.push({ platform: platform as SocialLink["platform"], url });
    }
  }
  return links;
}

export function toProfilePage(row: ExhibitorProfileRow): ExhibitorProfilePage {
  const ctas: Array<{ label: string; url: string }> = [];
  if (row.cta_primary_label && row.cta_primary_url) {
    ctas.push({ label: row.cta_primary_label, url: row.cta_primary_url });
  }
  if (row.cta_secondary_label && row.cta_secondary_url) {
    ctas.push({ label: row.cta_secondary_label, url: row.cta_secondary_url });
  }
  return {
    slug: row.slug,
    displayName: row.display_name,
    logoUrl: row.logo_path ? publicLogoUrl(row.logo_path) : null,
    description: row.description,
    websiteUrl: row.website_url,
    socialLinks: parseSocialLinks(row.social_links),
    ctas,
    contactEmail: row.show_contact_email ? row.contact_email : null,
  };
}

const PROFILE_COLUMNS =
  "slug, display_name, description, logo_path, website_url, social_links, " +
  "cta_primary_label, cta_primary_url, cta_secondary_label, cta_secondary_url, " +
  "show_contact_email, contact_email, published_at";

export async function fetchPublishedProfileCards(
  client: SupabaseClient,
): Promise<ExhibitorProfileCard[]> {
  const { data, error } = await client
    .from("exhibitor_profiles")
    .select("slug, display_name, logo_path")
    .not("published_at", "is", null)
    .order("display_name", { ascending: true });
  if (error) throw new Error(`profile cards query failed: ${error.message}`);
  return ((data ?? []) as Array<Pick<ExhibitorProfileRow, "slug" | "display_name" | "logo_path">>).map(
    (r) => ({
      slug: r.slug,
      displayName: r.display_name,
      logoUrl: r.logo_path ? publicLogoUrl(r.logo_path) : null,
    }),
  );
}

export async function fetchPublishedProfileBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<ExhibitorProfilePage | null> {
  const { data, error } = await client
    .from("exhibitor_profiles")
    .select(PROFILE_COLUMNS)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(`profile query failed: ${error.message}`);
  if (!data) return null;
  return toProfilePage(data as unknown as ExhibitorProfileRow);
}
