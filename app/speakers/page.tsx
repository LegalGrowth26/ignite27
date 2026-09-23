import Link from "next/link";
import type { Metadata } from "next";
import { BookingCta } from "@/components/BookingCta";
import { Container } from "@/components/Container";
import { PhotoBand } from "@/components/PhotoBand";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { SpeakerCard } from "@/components/SpeakerCard";
import { SpeakersSignupForm } from "@/components/SpeakersSignupForm";
import {
  fetchPublishedSpeakerCards,
  speakerInitials,
  type SpeakerCardData,
} from "@/lib/speakers/queries";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

const SPEAKERS_PHOTOS: ReadonlyArray<{ src: string; alt: string }> = [
  { src: "/images/photos/photo-06.webp", alt: "A speaker on the IGNITE! 26 main stage mid-sentence" },
  { src: "/images/photos/photo-09.webp", alt: "Delegates leaning in during a keynote at IGNITE! 26" },
  { src: "/images/photos/photo-17.webp", alt: "Speaker Q and A after a session at IGNITE! 26" },
];

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Speakers · IGNITE! 27",
  description:
    "The IGNITE! 27 speaker line-up. Leave your email and we will tell you each time a new speaker is confirmed.",
};

// Published speaker profiles are the single source for this page, the
// home cards, and /speakers/<slug>. The hardcoded NAMED_SPEAKERS
// arrays are gone; speakers now manage their own pages.
export default async function SpeakersPage() {
  let speakers: SpeakerCardData[] = [];
  try {
    speakers = await fetchPublishedSpeakerCards(createSupabaseServiceClient());
  } catch (err) {
    console.error("[speakers] listing failed:", err);
  }

  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Speakers"
              heading={
                speakers.length > 0
                  ? "On the main stage."
                  : "Speakers are being announced."
              }
              lede="National-quality speakers, brought to you. Tap any speaker for their session, and drop your email below to hear as each new name lands. Workshop hosts live on the workshops page."
              as="h1"
            />
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {speakers.map((s) => (
              <Link
                key={s.slug}
                href={`/speakers/${s.slug}`}
                className="block transition-transform hover:-translate-y-0.5"
              >
                <SpeakerCard
                  name={s.displayName}
                  topic={s.talkTitle || undefined}
                  media={
                    s.photoUrl
                      ? {
                          variant: "photo",
                          src: s.photoUrl,
                          alt: `Portrait of ${s.displayName}`,
                        }
                      : { variant: "initials", initials: speakerInitials(s.displayName) }
                  }
                />
              </Link>
            ))}
            <SpeakerCard
              media={{
                variant: "placeholder",
                label: "More national-quality speakers, announcements coming.",
              }}
            />
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-xl">
            <SpeakersSignupForm />
            <p className="mt-6 text-small text-ignite-muted">
              One email, when each new speaker is confirmed.
            </p>
          </div>
        </Container>
      </Section>

      <PhotoBand photos={SPEAKERS_PHOTOS} tone="light" />

      <BookingCta />
    </>
  );
}
