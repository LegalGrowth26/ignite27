import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { resolveOwnAppUserId } from "@/lib/account/queries";
import type { SocialPlatform } from "@/lib/exhibitors/profile";
import { parseSocialLinks } from "@/lib/exhibitors/profiles";
import {
  parseStoredTakeaways,
  type SpeakerProfileType,
} from "@/lib/speakers/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SpeakerEditorForm, type SpeakerEditorDefaults } from "./SpeakerEditorForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your speaker page · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface ProfileRow {
  id: string;
  slug: string;
  display_name: string;
  photo_path: string | null;
  logo_path: string | null;
  bio: string;
  talk_title: string;
  talk_description: string;
  talk_takeaways: unknown;
  website_url: string | null;
  social_links: unknown;
  cta_label: string | null;
  cta_url: string | null;
  enquiries_email: string | null;
  profile_type: SpeakerProfileType;
  published_at: string | null;
}

export default async function SpeakerEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?return_to=${encodeURIComponent("/speaker")}`);
  }
  const appUserId = await resolveOwnAppUserId(supabase);

  // RLS owner_select: only the caller's own linked profile comes back,
  // published or not.
  const { data } = appUserId
    ? await supabase
        .from("speaker_profiles")
        .select(
          `id, slug, display_name, photo_path, logo_path, bio, talk_title,
           talk_description, talk_takeaways, website_url, social_links,
           cta_label, cta_url, enquiries_email, profile_type, published_at`,
        )
        .eq("user_id", appUserId)
        .maybeSingle()
    : { data: null };
  const profile = data as unknown as ProfileRow | null;

  if (!profile) {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Speaker page"
              heading="No speaker page on this account."
              lede="Speaker pages are set up by the IGNITE! team. If you are speaking at IGNITE! 27 and expected to land in your editor, get in touch and we will link your page to this login."
              as="h1"
            />
            <p className="mt-6 text-body">
              <a
                href="mailto:tom@lincolnshiremarketing.co.uk"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                tom@lincolnshiremarketing.co.uk
              </a>
            </p>
          </div>
        </Container>
      </Section>
    );
  }

  const socialUrls: Partial<Record<SocialPlatform, string>> = {};
  for (const link of parseSocialLinks(profile.social_links)) {
    socialUrls[link.platform] = link.url;
  }

  const defaults: SpeakerEditorDefaults = {
    displayName: profile.display_name,
    hasPhoto: Boolean(profile.photo_path),
    hasLogo: Boolean(profile.logo_path),
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
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <SectionHeader
            eyebrow="Your speaker page"
            heading="Make your page work for you."
            lede="Delegates browse the speaker pages before the day. Tell them what your session covers, what they'll walk away with, and where to find you."
            as="h1"
          />
          {status === "saved" ? (
            <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
              Saved. Your page is up to date.
            </p>
          ) : null}
          <p className="mt-4 text-small text-ignite-muted">
            {profile.published_at ? (
              <>
                Your page is live at{" "}
                <Link
                  href={`/speakers/${profile.slug}`}
                  className="font-semibold text-ignite-red underline underline-offset-4"
                >
                  /speakers/{profile.slug}
                </Link>
                . Changes appear as soon as you save.
              </>
            ) : (
              <>Your page is currently unpublished; you can still edit it.</>
            )}
          </p>
          <div className="mt-8">
            <SpeakerEditorForm defaults={defaults} profileType={profile.profile_type} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
