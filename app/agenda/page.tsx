import type { Metadata } from "next";
import { AgendaSignupForm } from "@/components/AgendaSignupForm";
import { BookingCta } from "@/components/BookingCta";
import { Container } from "@/components/Container";
import { PhotoBand } from "@/components/PhotoBand";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

const AGENDA_PHOTOS: ReadonlyArray<{ src: string; alt: string }> = [
  { src: "/images/photos/photo-02.webp", alt: "A keynote in progress at IGNITE! 26" },
  { src: "/images/photos/photo-07.webp", alt: "A workshop session mid-flow at IGNITE! 26" },
  { src: "/images/photos/photo-13.webp", alt: "Delegates comparing notes between agenda slots at IGNITE! 26" },
];

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda · IGNITE! 27",
  description:
    "The full IGNITE! 27 agenda is on the way. Leave your email and we will tell you the moment it is announced.",
};

export default function AgendaPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Agenda"
              heading="The full IGNITE! 27 lineup is on the way."
              lede="We're locking in speakers, workshops, and the running order. Drop your email and we'll let you know the moment it's announced."
              as="h1"
            />
            <div className="mt-10">
              <AgendaSignupForm />
            </div>
            <p className="mt-6 text-small text-ignite-muted">
              One email, once the agenda is live.
            </p>
          </div>
        </Container>
      </Section>

      <PhotoBand photos={AGENDA_PHOTOS} tone="light" />

      <BookingCta />
    </>
  );
}
