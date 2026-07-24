import type { Metadata } from "next";
import { BookingCta } from "@/components/BookingCta";
import { Container } from "@/components/Container";
import { PhotoBand } from "@/components/PhotoBand";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { SpeakerCard } from "@/components/SpeakerCard";
import { SpeakersSignupForm } from "@/components/SpeakersSignupForm";

const SPEAKERS_PHOTOS: ReadonlyArray<{ src: string; alt: string }> = [
  { src: "/images/photos/photo-06.webp", alt: "A speaker on the Ignite 26 main stage mid-sentence" },
  { src: "/images/photos/photo-09.webp", alt: "Delegates leaning in during a keynote at Ignite 26" },
  { src: "/images/photos/photo-17.webp", alt: "Speaker Q and A after a session at Ignite 26" },
];

// Same three named speakers as the home Speakers section. Kept in sync
// by hand for now; move to a shared module if a third page ever needs it.
const NAMED_SPEAKERS: ReadonlyArray<
  | { name: string; topic: string; media: { variant: "photo"; src: string; alt: string } }
  | { name: string; topic: string; media: { variant: "initials"; initials: string } }
> = [
  {
    name: "Stephine Robinson",
    topic: "Practical AI for small businesses",
    media: { variant: "initials", initials: "SR" },
  },
  {
    name: "Nathan Littleton",
    topic: "Email marketing that wins customers",
    media: {
      variant: "photo",
      src: "/images/speakers/nathan-littleton.webp",
      alt: "Portrait of Nathan Littleton",
    },
  },
  {
    name: "Mark Saxby",
    topic: "Social media that actually works",
    media: { variant: "initials", initials: "MS" },
  },
];

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Speakers · Ignite 27",
  description:
    "Speakers for Ignite 27 are being announced. Leave your email and we will tell you each time one is confirmed.",
};

export default function SpeakersPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Speakers"
              heading="Sneak peek: first speakers announced."
              lede="Three names confirmed, more national-quality speakers to follow. Drop your email and you will hear as each one lands."
              as="h1"
            />
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NAMED_SPEAKERS.map((s) => (
              <SpeakerCard key={s.name} name={s.name} topic={s.topic} media={s.media} />
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
