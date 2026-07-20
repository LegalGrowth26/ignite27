import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import {
  BookingsNotOpenError,
  formatExVatWithGross,
  getCurrentPricing,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

type PricingPreview =
  | { status: "pre_open" }
  | { status: "live"; pricing: CurrentPricing };

function resolvePricingPreview(now: Date): PricingPreview {
  try {
    return { status: "live", pricing: getCurrentPricing(now) };
  } catch (err) {
    if (err instanceof BookingsNotOpenError) {
      return { status: "pre_open" };
    }
    throw err;
  }
}

const VALUE_PROPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Speakers",
    body: "People who've built things worth listening to. New voices for 2027, announced soon.",
  },
  {
    title: "Workshops",
    body: "Practical sessions, not talking shops. Leave with something you can use on Monday.",
  },
  {
    title: "Exhibitors",
    body: "Up to 50 businesses showing what they do. Worth a proper conversation, not a lanyard scan.",
  },
  {
    title: "Food and coffee",
    body: "Proper lunch, good coffee, real breaks. The background bits that decide how a day feels.",
  },
];

// TODO: replace with real Ignite 26 photography before the site goes live.
// Eight highlights chosen from the 38-photo library in
// public/images/photos/. All landscape aspect (1600x1067). The first
// entry spans a 2x2 tile on desktop so the grid reads as a proper
// gallery, not eight equal cells. Swap in a different set by editing
// the src values — the display srcs live next to their -thumb
// counterparts, so `photo-05.webp` and `photo-05-thumb.webp` are the
// same image at 1600px and 400px.
const LAST_YEAR_PHOTOS: ReadonlyArray<{ src: string; alt: string; span?: string }> = [
  {
    src: "/images/photos/photo-01.webp",
    alt: "Delegates gathered in the main hall at Ignite 26, mid-session",
    span: "md:col-span-2 md:row-span-2",
  },
  { src: "/images/photos/photo-06.webp", alt: "A speaker on stage at Ignite 26 addressing the room" },
  { src: "/images/photos/photo-10.webp", alt: "Delegates in conversation during a coffee break at Ignite 26" },
  { src: "/images/photos/photo-14.webp", alt: "Exhibitors speaking with a delegate at a stand at Ignite 26" },
  { src: "/images/photos/photo-18.webp", alt: "A small group of delegates in conversation in the Kelham Hall foyer" },
  { src: "/images/photos/photo-23.webp", alt: "Interior of The Renaissance at Kelham Hall set for Ignite 26" },
  { src: "/images/photos/photo-27.webp", alt: "Delegates networking between sessions at Ignite 26" },
  { src: "/images/photos/photo-32.webp", alt: "Wide view of the Ignite 26 main hall from the balcony" },
];

// Eight partner logos from the site's existing partners strip. Files
// live in public/images/partners/ and are padded to a consistent aspect
// so the strip lines up. href stays "#" until real destinations arrive.
const PARTNER_LOGOS: ReadonlyArray<{ src: string; alt: string; href: string }> = [
  { src: "/images/partners/partner-01.webp", alt: "Partner 1 logo", href: "#" },
  { src: "/images/partners/partner-02.webp", alt: "Partner 2 logo", href: "#" },
  { src: "/images/partners/partner-03.webp", alt: "Partner 3 logo", href: "#" },
  { src: "/images/partners/partner-04.webp", alt: "Partner 4 logo", href: "#" },
  { src: "/images/partners/partner-05.webp", alt: "Partner 5 logo", href: "#" },
  { src: "/images/partners/partner-06.webp", alt: "Partner 6 logo", href: "#" },
  { src: "/images/partners/partner-07.webp", alt: "Partner 7 logo", href: "#" },
  { src: "/images/partners/partner-08.webp", alt: "Partner 8 logo", href: "#" },
];

export default function HomePage() {
  const preview = resolvePricingPreview(new Date());

  return (
    <>
      <Hero />
      <WhatIsIgnite />
      <ValueProps />
      <LastYear />
      <Speakers />
      <AgendaTeaser />
      <PartnersStrip />
      <PricingPreview preview={preview} />
      <ClosingCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ignite-black text-ignite-white">
      {/* Real photography behind the red wash. next/image with priority
          + fill so the LCP element loads early and the layout doesn't
          shift when it arrives. */}
      <Image
        src="/images/brand/hero-main.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none absolute inset-0 -z-10 object-cover opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 12% 8%, rgba(225,29,46,0.45), transparent 60%), radial-gradient(900px 600px at 92% 88%, rgba(225,29,46,0.30), transparent 65%), radial-gradient(600px 400px at 60% 40%, rgba(225,29,46,0.12), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <Container className="relative py-24 sm:py-28 md:py-36 lg:py-44">
        <div className="max-w-4xl">
          <p className="text-eyebrow uppercase text-ignite-red">
            Thursday 21 January 2027. Kelham Hall, Newark.
          </p>
          <h1 className="mt-6 text-display">
            A business day worth turning up for.
          </h1>
          <p className="mt-6 max-w-2xl text-lead text-white/80">
            Speakers you&apos;ll quote. Workshops that teach you something useful. A room full of
            people who came to actually do something with their day.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button href="/attend" variant="primary" size="lg">
              Book your place
            </Button>
            <Button href="/exhibit" variant="secondary" size="lg" tone="dark">
              Reserve your stand
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

function WhatIsIgnite() {
  return (
    <Section tone="light">
      <Container>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionHeader
              eyebrow="What is Ignite 27"
              heading={<span className="normal-case">One day. Kelham Hall. The people who do.</span>}
            />
          </div>
          <div className="md:col-span-7 md:pt-2">
            <p className="text-lead text-ignite-ink">
              Ignite 27 is a one-day business event in Newark for people building and growing
              things. Speakers you&apos;ll quote on Monday. Workshops that teach you something.
              Exhibitors worth your time. A room of people who came to do something with their day,
              not to collect a lanyard.
            </p>
            <p className="mt-5 text-body text-ignite-muted">
              No panels for the sake of panels. No sponsor pitches dressed up as talks. A day that
              earns its place in your diary.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ValueProps() {
  return (
    <Section tone="cream">
      <Container>
        <SectionHeader
          eyebrow="What you get"
          heading="A day built around four things."
          lede="Enough speakers to fill your notes app. Enough time to actually meet people. Enough coffee to keep it all moving."
        />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-ignite-line bg-ignite-white p-6 transition-colors hover:border-ignite-red/40"
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

function LastYear() {
  return (
    <Section tone="light">
      <Container>
        <SectionHeader
          eyebrow="Last year at Ignite"
          heading="Ignite 26, in pictures."
          lede="The room, the stands, the conversations. Ignite 27 builds on this, turned up a notch."
        />
        <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] md:grid-cols-4">
          {LAST_YEAR_PHOTOS.map((photo) => (
            <figure
              key={photo.src}
              className={`relative overflow-hidden rounded-xl bg-ignite-line ${photo.span ?? ""}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover"
              />
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function Speakers() {
  return (
    <Section tone="cream">
      <Container>
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <SectionHeader
              eyebrow="Speakers"
              heading="Speakers, announced soon."
              lede="The 2027 line-up is being finalised. New voices, people you haven't heard at every other event this year. Watch this space."
            />
          </div>
          <div className="md:col-span-5 md:text-right">
            <Button href="/speakers" variant="secondary" size="md">
              See the speakers page
            </Button>
          </div>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              className="flex aspect-[4/5] flex-col justify-end rounded-2xl border border-dashed border-ignite-line bg-ignite-white p-5"
            >
              <p className="text-eyebrow uppercase text-ignite-muted">To be announced</p>
              <p className="mt-2 text-h3 text-ignite-ink/60">Speaker reveal coming soon.</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function AgendaTeaser() {
  return (
    <Section tone="light">
      <Container>
        <div className="grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <SectionHeader
              eyebrow="Agenda"
              heading="The agenda is taking shape."
              lede="Keynotes, workshops, exhibition time, proper breaks. Full running order lands with the speaker announcements."
            />
          </div>
          <div className="md:col-span-5 md:flex md:justify-end">
            <Button href="/agenda" variant="secondary" size="lg">
              See the agenda
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function PartnersStrip() {
  return (
    <Section tone="cream">
      <Container>
        <SectionHeader
          eyebrow="Sponsors and partners"
          heading="Backed by businesses that build."
          lede="Ignite 27 is made possible by sponsors and partners you'll recognise. Full line-up announced closer to the day."
        />
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
          {PARTNER_LOGOS.map((p) => (
            <li key={p.src}>
              <a
                href={p.href}
                className="flex aspect-[3/2] items-center justify-center rounded-lg border border-ignite-line bg-ignite-white p-3 transition-colors hover:border-ignite-red/40"
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  width={200}
                  height={120}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Button href="/sponsors" variant="secondary" size="md">
            Sponsor Ignite
          </Button>
          <Button href="/partners" variant="secondary" size="md">
            Become a partner
          </Button>
        </div>
      </Container>
    </Section>
  );
}

function PricingPreview({ preview }: { preview: PricingPreview }) {
  return (
    <Section tone="light">
      <Container>
        <SectionHeader
          eyebrow="Pricing"
          heading="Today's prices."
          lede="Prices rise as we get closer to the day. Book early, pay less."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {preview.status === "pre_open" ? (
            <PreOpenPricing />
          ) : (
            <LivePricing pricing={preview.pricing} />
          )}
        </div>
        <div className="mt-10">
          <Button href="/attend" variant="primary" size="md">
            See all pricing
          </Button>
        </div>
      </Container>
    </Section>
  );
}

function PreOpenPricing() {
  return (
    <>
      <div className="rounded-2xl border border-ignite-line p-6 md:col-span-2">
        <p className="text-eyebrow uppercase text-ignite-red">Bookings open soon</p>
        <p className="mt-3 text-h2 font-semibold">
          Bookings open 09:00, Saturday 1 August 2026.
        </p>
        <p className="mt-3 text-body text-ignite-muted">
          Launch pricing runs for 72 hours from open, then standard pricing until
          Christmas. Late pricing runs 1 to 18 January 2027. Bookings close 17:00,
          Monday 18 January 2027.
        </p>
      </div>
      <div className="rounded-2xl border border-ignite-line p-6">
        <p className="text-eyebrow uppercase text-ignite-red">Launch preview</p>
        <dl className="mt-4 space-y-3 text-body">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ignite-ink">Regular</dt>
            <dd className="text-h3">£25 + VAT (£30)</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ignite-ink">VIP, lunch included</dt>
            <dd className="text-h3">£69 + VAT (£82.80)</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-ignite-muted">
            <dt>Add lunch to Regular</dt>
            <dd>£15</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

function LivePricing({ pricing }: { pricing: CurrentPricing }) {
  const regular = formatExVatWithGross(
    pricing.delegate.regular.exVatPence,
    pricing.delegate.regular.incVatPence,
  );
  const vip = formatExVatWithGross(
    pricing.delegate.vip.exVatPence,
    pricing.delegate.vip.incVatPence,
  );
  const exhibitor = formatExVatWithGross(
    pricing.exhibitor.exVatPence,
    pricing.exhibitor.incVatPence,
  );

  return (
    <>
      <PricingCard title="Regular" price={regular} note="Add lunch for £15." />
      <PricingCard title="VIP" price={vip} note="Lunch included." />
      <PricingCard
        title="Exhibitor"
        price={exhibitor}
        note="Two people, two lunches."
      />
    </>
  );
}

function PricingCard({
  title,
  price,
  note,
}: {
  title: string;
  price: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-ignite-line p-6">
      <p className="text-eyebrow uppercase text-ignite-muted">{title}</p>
      <p className="mt-4 text-h1">{price}</p>
      <p className="mt-3 text-body text-ignite-muted">{note}</p>
    </div>
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
      <Container className="relative py-24 md:py-32">
        <div className="max-w-3xl">
          <p className="text-eyebrow uppercase text-ignite-red">Thursday 21 January 2027</p>
          <p className="mt-4 text-h1">
            Kelham Hall, Newark. Book your place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button href="/attend" variant="primary" size="lg">
              Book your place
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
