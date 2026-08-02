import Image from "next/image";
import type { Metadata } from "next";
import { BookingCta } from "@/components/BookingCta";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

// Three landscape venue-appropriate shots from the photo library. Wide
// interior scenes read best here.
//
// WAITING ON ASSETS: Kelham Hall images from Toby's library (drone +
// room shots). When supplied, optimise to 1600px webp into
// public/images/photos/ and extend or replace this array; the grid
// below handles any count (2-col on sm, 3-col on md+).
const VENUE_PHOTOS: ReadonlyArray<{ src: string; alt: string }> = [
  {
    src: "/images/photos/photo-04.webp",
    alt: "The Victorian Great Hall at The Renaissance at Kelham Hall, set for a session",
  },
  {
    src: "/images/photos/photo-20.webp",
    alt: "High-ceilinged interior at Kelham Hall with delegates in conversation",
  },
  {
    src: "/images/photos/photo-35.webp",
    alt: "Ornate plasterwork detail from The Renaissance at Kelham Hall",
  },
];

export const metadata: Metadata = {
  title: "Venue · IGNITE! 27",
  description:
    "IGNITE! 27 takes place at The Renaissance at Kelham Hall, Newark. Address, parking, accessibility, and getting here.",
};

const PRACTICAL_INFO: ReadonlyArray<{ label: string; body: string }> = [
  {
    label: "Address",
    body: "The Renaissance at Kelham Hall, Main Road, Kelham, Newark-on-Trent, Nottinghamshire, NG23 5QX.",
  },
  {
    label: "Parking",
    body: "Free on-site parking. Plenty of spaces, no need to book.",
  },
  {
    label: "Accessibility",
    body: "Fully accessible throughout. Lift, ramps, accessible WCs.",
  },
  {
    label: "Getting here",
    body: "Good road links via the A1 and A46. Around 90 minutes from London. Local hotels are available for delegates wanting to stay overnight.",
  },
];

export default function VenuePage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Venue"
              heading="The Renaissance at Kelham Hall."
              lede="A Victorian stately home with 42 acres of grounds, just outside Newark. A long way from a beige conference centre."
              as="h1"
            />
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <dl className="grid gap-10 md:grid-cols-2 md:gap-12">
              {PRACTICAL_INFO.map((item) => (
                <div key={item.label}>
                  <dt className="text-eyebrow uppercase text-ignite-red">
                    {item.label}
                  </dt>
                  <dd className="mt-3 text-body text-ignite-ink">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionHeader
                eyebrow="Why Kelham Hall"
                heading="Not your average conference room."
              />
            </div>
            <div className="md:col-span-7 md:pt-2">
              <p className="text-lead text-ignite-ink">
                Kelham Hall was built in the 19th century. The Renaissance has restored it as
                a working venue while keeping the Victorian architecture intact: high ceilings,
                ornate plasterwork, the ornate Victorian Great Hall.
              </p>
              <p className="mt-5 text-body text-ignite-muted">
                Fun fact for a building this grand: Kelham Hall has burned down three
                times in its history. We are bringing IGNITE! back to relight it,
                carefully.
              </p>
              <p className="mt-5 text-body text-ignite-muted">
                We picked it deliberately. We wanted somewhere that didn&apos;t feel like a hotel
                chain meeting room. Somewhere that says we took the day seriously, not that we
                ticked a venue-booked box. Delegates notice.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {VENUE_PHOTOS.map((p) => (
              <figure
                key={p.src}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ignite-line"
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  loading="lazy"
                  sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </figure>
            ))}
          </div>
        </Container>
      </Section>

      <BookingCta tone="light" />
    </>
  );
}
