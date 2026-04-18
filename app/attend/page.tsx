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
  LUNCH_ADDON_PENCE,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attend Ignite 27",
  description:
    "Book your place at Ignite 27. Sunday 31 January 2027 at Kelham Hall, Newark.",
};

type AttendPricing =
  | { status: "pre_open" }
  | { status: "live"; pricing: CurrentPricing };

function resolveAttendPricing(now: Date): AttendPricing {
  try {
    return { status: "live", pricing: getCurrentPricing(now) };
  } catch (err) {
    if (err instanceof BookingsNotOpenError) {
      return { status: "pre_open" };
    }
    throw err;
  }
}

// Window 1 previews, used only when bookings have not opened yet.
const WINDOW_1_REGULAR_PENCE = 3900;
const WINDOW_1_VIP_PENCE = 9900;

const REGULAR_INCLUDES: readonly string[] = [
  "Full-day access, Sunday 31 January 2027",
  "Keynotes, main-stage sessions and workshops",
  "Exhibitor zone and networking throughout",
  "Coffee and refreshments on the house",
];

const VIP_INCLUDES: readonly string[] = [
  "Everything in Regular",
  "Priority workshop access (from phase 2)",
  "Premium badge treatment",
  "[TODO: confirm fourth VIP perk with Tom]",
];

const ATTEND_STEPS: readonly BookingStep[] = [
  { label: "Choose", body: "Regular or VIP. Add lunch if you want it." },
  { label: "Your details", body: "Name, email, company, dietary. Quick form." },
  { label: "Pay", body: "Secure card payment via Stripe. VAT-inclusive." },
  { label: "Confirmed", body: "Ticket in your inbox, diary entry done." },
];

const FAQS: ReadonlyArray<{ q: string; a: React.ReactNode }> = [
  {
    q: "Can I bring a guest?",
    a: "Every delegate needs their own ticket. Booking for a colleague? Book one for them too.",
  },
  {
    q: "What's in the lunch?",
    a: "Venue catering, details confirmed closer to the event.",
  },
  {
    q: "When do I get my ticket?",
    a: "Immediately by email once payment clears. Your booking also lives in your account area.",
  },
  {
    q: "Can I cancel?",
    a: (
      <>
        Yes, up to 30 December 2026, minus Stripe&apos;s processing fee. See the{" "}
        <Link href="/refund-policy" className="underline underline-offset-4 hover:text-ignite-red">
          refund policy
        </Link>{" "}
        for the full detail.
      </>
    ),
  },
];

export default function AttendPage() {
  const pricing = resolveAttendPricing(new Date());

  return (
    <>
      <Hero />
      <PricingSection pricing={pricing} />
      <WhatYouGet />
      <HowBookingWorks heading="How booking works." steps={ATTEND_STEPS} />
      <FaqPreview />
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
          <p className="text-eyebrow uppercase text-ignite-red">Attend Ignite 27</p>
          <h1 className="mt-5 text-h1">Your place at Ignite 27.</h1>
          <p className="mt-5 max-w-2xl text-lead text-white/80">
            Sunday 31 January 2027. Kelham Hall, Newark. Pick Regular or VIP below and book your
            place.
          </p>
        </div>
      </Container>
    </section>
  );
}

function PricingSection({ pricing }: { pricing: AttendPricing }) {
  const isPreOpen = pricing.status === "pre_open";

  const regularPrice = isPreOpen
    ? formatPoundsFromPence(WINDOW_1_REGULAR_PENCE)
    : formatPoundsFromPence(pricing.pricing.delegate.regular);
  const vipPrice = isPreOpen
    ? formatPoundsFromPence(WINDOW_1_VIP_PENCE)
    : formatPoundsFromPence(pricing.pricing.delegate.vip);
  const lunchLabel = formatPoundsFromPence(LUNCH_ADDON_PENCE);

  const chip = isPreOpen ? "Window 1 preview" : undefined;

  const regularCta = isPreOpen
    ? { disabledLabel: "Bookings open 30 June" as const }
    : { label: "Book your place", href: "/attend/book?ticket=regular" };
  const vipCta = isPreOpen
    ? { disabledLabel: "Bookings open 30 June" as const }
    : { label: "Book your place as VIP", href: "/attend/book?ticket=vip" };

  return (
    <Section tone="light">
      <Container>
        <SectionHeader
          eyebrow="Pricing"
          heading={isPreOpen ? "Bookings open 30 June." : "Today's pricing."}
          lede={
            isPreOpen
              ? "Bookings open 09:00, Tuesday 30 June 2026. Below are the Window 1 preview prices."
              : "Prices rise as we get closer to the day. Book early, pay less."
          }
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 md:items-stretch">
          <PriceCard
            tier="Regular"
            price={regularPrice}
            chip={chip}
            included={REGULAR_INCLUDES}
            summaryLine={`Add lunch for ${lunchLabel}.`}
            cta={regularCta}
          />
          <PriceCard
            tier="VIP"
            tierTone="accent"
            price={vipPrice}
            chip={chip}
            included={VIP_INCLUDES}
            summaryLine="Lunch included."
            cta={vipCta}
            emphasised
          />
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

function WhatYouGet() {
  const items: ReadonlyArray<{ title: string; body: string }> = [
    {
      title: "The speakers",
      body: "New voices for 2027, announced soon. People who have built things worth listening to.",
    },
    {
      title: "The workshops",
      body: "Practical sessions, not talking shops. Leave with something you can use on Monday.",
    },
    {
      title: "The room",
      body: "Up to 50 exhibitors and a couple of hundred delegates who came ready to talk.",
    },
    {
      title: "The breaks",
      body: "Proper coffee, real pauses, time to follow up a conversation without rushing.",
    },
  ];

  return (
    <Section tone="cream">
      <Container>
        <SectionHeader eyebrow="What you get" heading="A day built around four things." />
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

function FaqPreview() {
  return (
    <Section tone="light">
      <Container>
        <SectionHeader
          eyebrow="Frequently asked"
          heading="Before you book."
        />
        <dl className="mt-10 grid gap-8 md:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-h3">{f.q}</dt>
              <dd className="mt-2 text-body text-ignite-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10">
          <Button href="/faq" variant="secondary" size="md">
            See all questions
          </Button>
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
          <p className="mt-4 text-h1">Book your place at Ignite 27.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button href="/attend/book?ticket=regular" variant="primary" size="lg">
              Book your place
            </Button>
            <Button href="/attend/book?ticket=vip" variant="secondary" size="lg" tone="dark">
              Book as VIP
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
