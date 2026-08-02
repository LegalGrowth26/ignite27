import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { HowBookingWorks, type BookingStep } from "@/components/HowBookingWorks";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { PhotoBand } from "@/components/PhotoBand";
import { PriceCard } from "@/components/PriceCard";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

const ATTEND_ATMOSPHERE: ReadonlyArray<{ src: string; alt: string }> = [
  { src: "/images/photos/photo-05.webp", alt: "Delegates listening intently to a speaker at IGNITE! 26" },
  { src: "/images/photos/photo-11.webp", alt: "Two delegates in conversation during a networking break at IGNITE! 26" },
  { src: "/images/photos/photo-25.webp", alt: "A workshop in progress at IGNITE! 26" },
];
import {
  BookingsNotOpenError,
  formatExVatWithGross,
  formatPoundsFromPence,
  getCurrentPricing,
  LUNCH_ADDON_INC_VAT_PENCE,
  PRICING_PERIODS,
  type CurrentPricing,
} from "@/lib/pricing";

const LAUNCH_PERIOD = PRICING_PERIODS.find((p) => p.period === "launch");
if (!LAUNCH_PERIOD) throw new Error("launch pricing period not defined");
const LAUNCH_OPENS_MS = LAUNCH_PERIOD.opensAt.getTime();
const LAUNCH_CLOSES_MS = LAUNCH_PERIOD.closesAt.getTime();

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attend IGNITE! 27",
  description:
    "Book your place at IGNITE! 27. Thursday 21 January 2027 at Kelham Hall, Newark.",
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

// Launch-period preview prices, shown when bookings have not opened yet.
// Both ex-VAT and inc-VAT are needed so we can render "£25 + VAT (£30)".
const LAUNCH_REGULAR_EX_VAT_PENCE = 2500;
const LAUNCH_REGULAR_INC_VAT_PENCE = 3000;
const LAUNCH_VIP_EX_VAT_PENCE = 6900;
const LAUNCH_VIP_INC_VAT_PENCE = 8280;

const REGULAR_INCLUDES: readonly string[] = [
  "Full-day access, Thursday 21 January 2027",
  "Keynotes, main-stage sessions and workshops",
  "Exhibitor zone and networking throughout",
  "Coffee and refreshments on the house",
];

const VIP_INCLUDES: readonly string[] = [
  "Everything in Regular",
  "Lunch included, with first access",
  "Priority seating at the front",
  "Special VIP lanyard",
  "QR code on your badge linking to your LinkedIn or website",
];

const ATTEND_STEPS: readonly BookingStep[] = [
  { label: "Choose", body: "Regular or VIP. Add lunch if you want it." },
  { label: "Your details", body: "Name, email, company, dietary. Quick form." },
  { label: "Pay", body: "Secure card payment via Stripe. VAT added at checkout." },
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
        Yes, full refund on request until 31 December 2026. From
        1 January 2027 tickets are non-refundable but freely transferable
        to a colleague. See the{" "}
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
      <PhotoBand photos={ATTEND_ATMOSPHERE} tone="light" />
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
          <p className="text-eyebrow uppercase text-ignite-red">Attend IGNITE! 27</p>
          <h1 className="mt-5 text-h1">Your place at IGNITE! 27.</h1>
          <p className="mt-5 max-w-2xl text-lead text-white/80">
            Thursday 21 January 2027. Kelham Hall, Newark. Pick Regular or VIP below and book your
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
    ? formatExVatWithGross(LAUNCH_REGULAR_EX_VAT_PENCE, LAUNCH_REGULAR_INC_VAT_PENCE)
    : formatExVatWithGross(
        pricing.pricing.delegate.regular.exVatPence,
        pricing.pricing.delegate.regular.incVatPence,
      );
  const vipPrice = isPreOpen
    ? formatExVatWithGross(LAUNCH_VIP_EX_VAT_PENCE, LAUNCH_VIP_INC_VAT_PENCE)
    : formatExVatWithGross(
        pricing.pricing.delegate.vip.exVatPence,
        pricing.pricing.delegate.vip.incVatPence,
      );
  const lunchLabel = formatPoundsFromPence(LUNCH_ADDON_INC_VAT_PENCE);

  const chip = isPreOpen ? "Launch preview" : undefined;

  const regularCta = isPreOpen
    ? { disabledLabel: "Bookings open 1 August 2026" as const }
    : { label: "Book your place", href: "/attend/book?ticket=regular" };
  const vipCta = isPreOpen
    ? { disabledLabel: "Bookings open 1 August 2026" as const }
    : { label: "Book your place as VIP", href: "/attend/book?ticket=vip" };

  return (
    <Section tone="light">
      <Container>
        <SectionHeader
          eyebrow="Pricing"
          heading={isPreOpen ? "Bookings open 1 August 2026." : "Today's pricing."}
          lede={
            isPreOpen
              ? "Bookings open 09:00, Saturday 1 August 2026. Below are the launch preview prices."
              : "Prices rise as we get closer to the day. Book early, pay less."
          }
        />
        <div className="mt-8">
          <LaunchCountdown
            launchOpensMs={LAUNCH_OPENS_MS}
            launchClosesMs={LAUNCH_CLOSES_MS}
          />
        </div>
        {/* VIP is rendered first so on both desktop (left column, with
            the emphasised border + translate-up) and mobile (first
            card) it reads as the featured option. Regular remains
            clearly and equally bookable, no dark patterns. */}
        <div className="mt-8 grid gap-6 md:grid-cols-2 md:items-stretch">
          <PriceCard
            tier="VIP"
            tierTone="accent"
            price={vipPrice}
            chip={chip ?? "Best value"}
            included={VIP_INCLUDES}
            summaryLine="Lunch included, front-row seat, VIP lanyard."
            cta={vipCta}
            emphasised
          />
          <PriceCard
            tier="Regular"
            price={regularPrice}
            chip={chip}
            included={REGULAR_INCLUDES}
            summaryLine={`Add lunch for ${lunchLabel}.`}
            cta={regularCta}
          />
        </div>
        <p className="mt-8 text-small text-ignite-muted">
          Prices shown are ex-VAT with the VAT-inclusive total in
          brackets. Lunch is £15 flat, already VAT-inclusive. See the{" "}
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
      body: "National quality speakers brought to you. People who have built things worth listening to.",
    },
    {
      title: "The workshops",
      body: "Practical sessions, not talking shops. Leave with something you can use on Monday.",
    },
    {
      title: "The room",
      body: "Over 50 exhibitors and delegates who came ready to talk.",
    },
    {
      title: "The food",
      body: "The famous IGNITE! grab bag is back, or upgrade your lunch to a burger from the IGNITE! FOOD TRUCK.",
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
        <p className="mt-10 text-small text-ignite-muted">
          Something else on your mind? Email{" "}
          <a
            href="mailto:tom@lincolnshiremarketing.co.uk"
            className="font-semibold text-ignite-red underline underline-offset-4"
          >
            tom@lincolnshiremarketing.co.uk
          </a>
          .
        </p>
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
          <p className="text-eyebrow uppercase text-ignite-red">Thursday 21 January 2027</p>
          <p className="mt-4 text-h1">Book your place at IGNITE! 27.</p>
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
