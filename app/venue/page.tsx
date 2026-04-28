import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Venue — Ignite 27",
  description:
    "Ignite 27 takes place at The Renaissance at Kelham Hall, Newark. Address, parking, accessibility, and getting here.",
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
    body: "Good road links via the A1 and A46. Around 90 minutes from London. Local hotels are available for delegates wanting to stay overnight (we'll publish a recommended list closer to the event).",
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
                We picked it deliberately. We wanted somewhere that didn't feel like a hotel
                chain meeting room. Somewhere that says we took the day seriously, not that we
                ticked a venue-booked box. Delegates notice.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-h3 text-ignite-ink">Ready to come along?</p>
              <p className="mt-2 text-body text-ignite-muted">
                Lock in your place at Ignite 27 at the current pricing window.
              </p>
            </div>
            <Button
              href="/attend"
              variant="primary"
              size="md"
              className="self-start md:self-auto"
            >
              Book your place
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
