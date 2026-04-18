import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { HowBookingWorks, type BookingStep } from "@/components/HowBookingWorks";
import { PriceCard } from "@/components/PriceCard";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import {
  BookingsNotOpenError,
  formatPoundsFromPence,
  getCurrentPricing,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exhibit at Ignite 27",
  description:
    "Reserve one of 50 exhibitor stands at Ignite 27. Sunday 31 January 2027 at Kelham Hall, Newark.",
};

type ExhibitPricing =
  | { status: "pre_open" }
  | { status: "live"; pricing: CurrentPricing };

function resolveExhibitPricing(now: Date): ExhibitPricing {
  try {
    return { status: "live", pricing: getCurrentPricing(now) };
  } catch (err) {
    if (err instanceof BookingsNotOpenError) {
      return { status: "pre_open" };
    }
    throw err;
  }
}

const WINDOW_1_EXHIBITOR_PENCE = 20000;

const EXHIBITOR_INCLUDES: readonly string[] = [
  "1 exhibitor space",
  "2 attendee places",
  "2 lunches",
];

// TODO: wire this to the live count from the database once the exhibitor
// booking flow is built. For now the number is hardcoded.
const EXHIBITOR_SPACES_REMAINING = 50;
const EXHIBITOR_SPACES_TOTAL = 50;

const EXHIBIT_STEPS: readonly BookingStep[] = [
  {
    label: "Your details",
    body: "Company, main contact, two people attending, dietary.",
  },
  { label: "Pay", body: "Secure card payment via Stripe. VAT-inclusive." },
  {
    label: "We assign your stand",
    body: "Confirmed within a working day.",
  },
  { label: "Confirmed", body: "Details in your inbox, diary entry done." },
];

export default function ExhibitPage() {
  const pricing = resolveExhibitPricing(new Date());

  return (
    <>
      <Hero />
      <PricingSection pricing={pricing} />
      <WhyExhibit />
      <WhatsIncluded />
      <HowBookingWorks heading="How booking works." steps={EXHIBIT_STEPS} />
      <SponsorshipCallout />
      <ClosingCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ignite-black text-ignite-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 18% 10%, rgba(225,29,46,0.38), transparent 60%), radial-gradient(700px 500px at 88% 90%, rgba(225,29,46,0.24), transparent 65%)",
        }}
      />
      <Container className="relative py-20 sm:py-24 md:py-28">
        <div className="max-w-3xl">
          <p className="text-eyebrow uppercase text-ignite-red">Exhibit at Ignite 27</p>
          <h1 className="mt-5 text-h1">A room worth standing in.</h1>
          <p className="mt-5 max-w-2xl text-lead text-white/80">
            50 exhibitor stands at Kelham Hall on Sunday 31 January 2027. The delegates came to
            meet businesses like yours, not to collect pens.
          </p>
        </div>
      </Container>
    </section>
  );
}

function PricingSection({ pricing }: { pricing: ExhibitPricing }) {
  const isPreOpen = pricing.status === "pre_open";
  const isEventDayClosed =
    pricing.status === "live" && pricing.pricing.exhibitor === null;

  let heading: string;
  let lede: string;

  if (isPreOpen) {
    heading = "Bookings open 30 June.";
    lede =
      "Bookings open 09:00, Tuesday 30 June 2026. Below is the Window 1 preview price.";
  } else if (isEventDayClosed) {
    heading = "Exhibitor bookings are closed on the day.";
    lede = "See you next year. In the meantime, catch us at Ignite 27 as a delegate.";
  } else {
    heading = "Today's pricing.";
    lede = "Each exhibitor booking includes two attendee places and two lunches.";
  }

  const extraNote = isEventDayClosed
    ? undefined
    : `${EXHIBITOR_SPACES_REMAINING} of ${EXHIBITOR_SPACES_TOTAL} spaces remaining.`;

  let priceLabel = "Closed";
  if (isPreOpen) {
    priceLabel = formatPoundsFromPence(WINDOW_1_EXHIBITOR_PENCE);
  } else if (pricing.status === "live" && pricing.pricing.exhibitor !== null) {
    priceLabel = formatPoundsFromPence(pricing.pricing.exhibitor);
  }

  let cta: { label: string; href: string } | { disabledLabel: string };
  if (isPreOpen) {
    cta = { disabledLabel: "Bookings open 30 June" };
  } else if (isEventDayClosed) {
    cta = { disabledLabel: "Bookings closed" };
  } else {
    cta = { label: "Reserve your stand", href: "/exhibit/book" };
  }

  const chip = isPreOpen ? "Window 1 preview" : undefined;

  return (
    <Section tone="light">
      <Container>
        <SectionHeader eyebrow="Pricing" heading={heading} lede={lede} />
        <div className="mt-12 grid md:grid-cols-12">
          <div className="md:col-span-7 lg:col-span-6">
            <PriceCard
              tier="Exhibitor package"
              tierTone="accent"
              price={priceLabel}
              chip={chip}
              included={EXHIBITOR_INCLUDES}
              summaryLine="For one business, for the whole day."
              cta={cta}
              extraNote={extraNote}
              emphasised
            />
          </div>
        </div>
        <p className="mt-8 text-small text-ignite-muted">
          Prices are VAT-inclusive. See the{" "}
          <Link
            href="/refund-policy"
            className="underline underline-offset-4 hover:text-ignite-red"
          >
            refund policy
          </Link>{" "}
          for cancellation terms.
        </p>
      </Container>
    </Section>
  );
}

function WhyExhibit() {
  const items: ReadonlyArray<{ title: string; body: string }> = [
    {
      title: "Quality over volume",
      body: "A room of delegates who came ready to talk. Not a footfall metric, a conversation count.",
    },
    {
      title: "One focused day",
      body: "Not a week-long expo. Full delegate attention, compressed into Sunday 31 January 2027.",
    },
    {
      title: "Two people, two lunches",
      body: "Enough resource to work your stand properly, without hiring extras for the day.",
    },
    {
      title: "Designed for conversations",
      body: "Layout and timings built so delegates actually reach your stand, not just walk past it.",
    },
  ];

  return (
    <Section tone="cream">
      <Container>
        <SectionHeader eyebrow="Why exhibit" heading="Why Ignite 27, specifically." />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-ignite-line bg-ignite-white p-6"
            >
              <h3 className="text-h3">{item.title}</h3>
              <p className="mt-3 text-body text-ignite-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

function WhatsIncluded() {
  return (
    <Section tone="light">
      <Container>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionHeader
              eyebrow="What's included"
              heading="The exhibitor package, clearly."
            />
          </div>
          <div className="md:col-span-7 md:pt-2">
            <p className="text-lead text-ignite-ink">
              Each exhibitor booking covers one stand, two attendee places, and two lunches for
              the whole day.
            </p>
            {/*
              TODO: once the venue kit is confirmed (stand size, table, chairs,
              power, signage rules), replace this paragraph with a concrete list.
            */}
            <p className="mt-5 text-body text-ignite-muted">
              Stand kit details (size, table, chairs, power) are confirmed with exhibitors after
              booking.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function SponsorshipCallout() {
  return (
    <Section tone="cream">
      <Container>
        <div className="rounded-3xl border border-ignite-line bg-ignite-white p-8 md:p-12">
          <div className="grid gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-8">
              <p className="text-eyebrow uppercase text-ignite-red">More than a stand?</p>
              <p className="mt-3 text-h2">Sponsorship puts your brand at the front of the day.</p>
              <p className="mt-3 text-body text-ignite-muted">
                Headline and sector sponsorships are enquiry-led. Get in touch and we will talk
                through what's available.
              </p>
            </div>
            <div className="md:col-span-4 md:justify-self-end">
              <Button href="/sponsors" variant="primary" size="md">
                Sponsor Ignite 27
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-ignite-black text-ignite-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 80% 50%, rgba(225,29,46,0.38), transparent 60%), radial-gradient(700px 400px at 10% 100%, rgba(225,29,46,0.22), transparent 65%)",
        }}
      />
      <Container className="relative py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="text-eyebrow uppercase text-ignite-red">Sunday 31 January 2027</p>
          <p className="mt-4 text-h1">Reserve your stand.</p>
          <p className="mt-5 text-lead text-white/80">
            50 spaces at The Renaissance at Kelham Hall, Newark.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button href="/exhibit/book" variant="primary" size="lg">
              Reserve your stand
            </Button>
            <Link
              href="/venue"
              className="inline-flex items-center text-body text-white/80 underline-offset-4 hover:text-ignite-white hover:underline"
            >
              Find the venue
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
