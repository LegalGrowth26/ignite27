import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { ProfileForm, type ProfileDefaults } from "./ProfileForm";
import { resolveOwnAppUserId } from "@/lib/account/queries";
import { ensureExhibitorProfile } from "@/lib/exhibitors/create-profile";
import { attendeeFallbacks, isLivePaidSession } from "@/lib/exhibitors/listing";
import type { SocialPlatform } from "@/lib/exhibitors/profile";
import { parseSocialLinks } from "@/lib/exhibitors/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your exhibitor page · IGNITE! 27",
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

interface BookingRow {
  id: string;
  booking_type: string;
  payment_status: string;
  booking_status: string;
  stripe_checkout_session_id: string | null;
  company_name: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    company: string | null;
    attendee_index: number;
  }>;
}

export default async function ExhibitorProfileEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?return_to=${encodeURIComponent(`/account/booking/${id}/profile`)}`);
  }
  const appUserId = await resolveOwnAppUserId(supabase);
  if (!appUserId) notFound();

  // Scoped by user_id like every account query (see lib/account/queries):
  // super admins hold bookings_admin_all, so an unscoped read would let
  // an admin's own /account edit other people's pages by URL.
  const { data: bookingData } = await supabase
    .from("bookings")
    .select(
      `id, booking_type, payment_status, booking_status,
       stripe_checkout_session_id, company_name, company_contact_name,
       company_contact_email,
       booking_attendees ( first_name, surname, company, attendee_index )`,
    )
    .eq("id", id)
    .eq("user_id", appUserId)
    .maybeSingle();
  const booking = bookingData as unknown as BookingRow | null;
  if (!booking || booking.booking_type !== "exhibitor") notFound();

  // Owner select works whatever the publish state, so the editor keeps
  // working while an admin has the page unpublished.
  let { data: profileData } = await supabase
    .from("exhibitor_profiles")
    .select(
      `slug, display_name, description, website_url, social_links,
       cta_primary_label, cta_primary_url, cta_secondary_label,
       cta_secondary_url, show_contact_email, contact_email, published_at`,
    )
    .eq("booking_id", id)
    .maybeSingle();

  // Self-heal: a booking from before this feature (backfill not run
  // yet) has no profile row. Ownership is verified above, so create it
  // here with the service client under the same gate as the backfill:
  // a completed live payment, or a comp, on an active booking.
  if (
    !profileData &&
    booking.booking_status === "active" &&
    (booking.payment_status === "comp" ||
      (booking.payment_status === "paid" &&
        isLivePaidSession(booking.stripe_checkout_session_id)))
  ) {
    const fallback = attendeeFallbacks(booking.booking_attendees);
    try {
      await ensureExhibitorProfile(createSupabaseServiceClient(), {
        bookingId: id,
        companyName: booking.company_name,
        fallbackName:
          fallback.attendeeCompany ??
          booking.company_contact_name ??
          fallback.attendeeName,
        contactEmail: booking.company_contact_email,
      });
      const retry = await supabase
        .from("exhibitor_profiles")
        .select(
          `slug, display_name, description, website_url, social_links,
           cta_primary_label, cta_primary_url, cta_secondary_label,
           cta_secondary_url, show_contact_email, contact_email, published_at`,
        )
        .eq("booking_id", id)
        .maybeSingle();
      profileData = retry.data;
    } catch (err) {
      console.error("[exhibitor-profile] self-heal creation failed:", err);
    }
  }

  const profile = profileData as unknown as ProfileRow | null;

  if (!profile) {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <BackLink id={id} />
            <div className="mt-4">
              <SectionHeader
                eyebrow="Your exhibitor page"
                heading="Your page is not ready yet."
                lede="Pages are created automatically once a stand booking is confirmed. If your booking is confirmed and you are seeing this, get in touch and we will sort it."
                as="h1"
              />
            </div>
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

  const defaults: ProfileDefaults = {
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
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <BackLink id={id} />
          <div className="mt-4">
            <SectionHeader
              eyebrow="Your exhibitor page"
              heading="Make your page work for you."
              lede="This is your public page on the IGNITE! 27 site. Delegates browse these before the day, so tell them what you do and where to find out more."
              as="h1"
            />
          </div>
          <p className="mt-4 text-small text-ignite-muted">
            {profile.published_at ? (
              <>
                Your page is live at{" "}
                <Link
                  href={`/exhibitors/${profile.slug}`}
                  className="font-semibold text-ignite-red underline underline-offset-4"
                >
                  /exhibitors/{profile.slug}
                </Link>
                . Changes appear as soon as you save. Your logo comes from the{" "}
                <Link
                  href={`/account/booking/${id}/requirements`}
                  className="underline underline-offset-4 hover:text-ignite-red"
                >
                  stand requirements form
                </Link>
                .
              </>
            ) : (
              <>Your page is currently unpublished. You can still edit it; contact us if you were not expecting this.</>
            )}
          </p>
          <div className="mt-8">
            <ProfileForm bookingId={id} defaults={defaults} />
          </div>
        </div>
      </Container>
    </Section>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/account/booking/${id}`}
      className="text-small font-semibold text-ignite-red underline underline-offset-4"
    >
      Back to your booking
    </Link>
  );
}
