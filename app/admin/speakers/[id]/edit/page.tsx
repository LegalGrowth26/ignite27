import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import type { SocialPlatform } from "@/lib/exhibitors/profile";
import { parseSocialLinks } from "@/lib/exhibitors/profiles";
import { parseStoredTakeaways } from "@/lib/speakers/profile";
import { AdminSpeakerEditForm, type AdminSpeakerDefaults } from "./AdminSpeakerEditForm";

export const metadata: Metadata = {
  title: "Edit speaker page · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  slug: string;
  display_name: string;
  bio: string;
  talk_title: string;
  talk_description: string;
  talk_takeaways: unknown;
  website_url: string | null;
  social_links: unknown;
  cta_label: string | null;
  cta_url: string | null;
  enquiries_email: string | null;
  published_at: string | null;
}

export default async function AdminEditSpeakerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("speaker_profiles")
    .select(
      `id, slug, display_name, bio, talk_title, talk_description,
       talk_takeaways, website_url, social_links, cta_label, cta_url,
       enquiries_email, published_at`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const profile = data as unknown as Row | null;
  if (!profile) notFound();

  const socialUrls: Partial<Record<SocialPlatform, string>> = {};
  for (const link of parseSocialLinks(profile.social_links)) {
    socialUrls[link.platform] = link.url;
  }

  const defaults: AdminSpeakerDefaults = {
    slug: profile.slug,
    displayName: profile.display_name,
    bio: profile.bio,
    talkTitle: profile.talk_title,
    talkDescription: profile.talk_description,
    talkTakeaways: parseStoredTakeaways(profile.talk_takeaways).join("\n"),
    websiteUrl: profile.website_url ?? "",
    socialUrls,
    ctaLabel: profile.cta_label ?? "",
    ctaUrl: profile.cta_url ?? "",
    enquiriesEmail: profile.enquiries_email ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/speakers"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to speakers
      </Link>
      <h1 className="mt-4 text-h1">Edit speaker page</h1>
      <p className="mt-3 text-small text-ignite-muted">
        {profile.published_at ? (
          <>
            Live at{" "}
            <Link
              href={`/speakers/${profile.slug}`}
              className="underline underline-offset-4 hover:text-ignite-red"
            >
              /speakers/{profile.slug}
            </Link>
            . The speaker edits everything here except the slug from /speaker;
            their photo is uploaded from their own editor.
          </>
        ) : (
          <>Currently unpublished. Edits save but the page stays down until republished.</>
        )}
      </p>
      <div className="mt-8">
        <AdminSpeakerEditForm profileId={profile.id} defaults={defaults} />
      </div>
    </div>
  );
}
