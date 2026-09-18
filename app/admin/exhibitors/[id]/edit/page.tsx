import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import type { SocialPlatform } from "@/lib/exhibitors/profile";
import { parseSocialLinks } from "@/lib/exhibitors/profiles";
import { AdminProfileForm, type AdminProfileDefaults } from "./AdminProfileForm";

export const metadata: Metadata = {
  title: "Edit exhibitor page · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface ProfileRow {
  slug: string;
  display_name: string;
  description: string | null;
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

export default async function AdminEditExhibitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("exhibitor_profiles")
    .select(
      `slug, display_name, description, website_url, social_links,
       cta_primary_label, cta_primary_url, cta_secondary_label,
       cta_secondary_url, show_contact_email, contact_email, published_at`,
    )
    .eq("booking_id", id)
    .maybeSingle();
  if (error) {
    return (
      <div>
        <h1 className="text-h1">Edit exhibitor page</h1>
        <p className="mt-6 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
          {error.message}
        </p>
      </div>
    );
  }
  const profile = data as unknown as ProfileRow | null;
  if (!profile) notFound();

  const socialUrls: Partial<Record<SocialPlatform, string>> = {};
  for (const link of parseSocialLinks(profile.social_links)) {
    socialUrls[link.platform] = link.url;
  }

  const defaults: AdminProfileDefaults = {
    slug: profile.slug,
    displayName: profile.display_name,
    description: profile.description ?? "",
    websiteUrl: profile.website_url ?? "",
    socialUrls,
    ctaPrimaryLabel: profile.cta_primary_label ?? "",
    ctaPrimaryUrl: profile.cta_primary_url ?? "",
    ctaSecondaryLabel: profile.cta_secondary_label ?? "",
    ctaSecondaryUrl: profile.cta_secondary_url ?? "",
    showContactEmail: profile.show_contact_email,
    contactEmail: profile.contact_email ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/exhibitors"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to exhibitors
      </Link>
      <h1 className="mt-4 text-h1">Edit exhibitor page</h1>
      <p className="mt-3 text-small text-ignite-muted">
        {profile.published_at ? (
          <>
            Live at{" "}
            <Link
              href={`/exhibitors/${profile.slug}`}
              className="underline underline-offset-4 hover:text-ignite-red"
            >
              /exhibitors/{profile.slug}
            </Link>
            . The exhibitor can edit everything here except the slug from
            their account; edits land immediately either way.
          </>
        ) : (
          <>Currently unpublished. Edits save but the page stays down until republished.</>
        )}
      </p>
      <div className="mt-8">
        <AdminProfileForm bookingId={id} defaults={defaults} />
      </div>
    </div>
  );
}
