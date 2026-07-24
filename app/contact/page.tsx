import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Contact · Ignite 27",
  description:
    "Get in touch about Ignite 27. Tom Stansfield at Lincolnshire Marketing and Paul Green at Business Unfinished handle everything: delegate, exhibitor, and sponsorship enquiries.",
};

const ENQUIRY_SUBJECT = "IGNITE 27 enquiry";
const EXHIBITOR_SUBJECT = "IGNITE 27 exhibitor enquiry";
const SPONSORSHIP_SUBJECT = "IGNITE 27 sponsorship enquiry";

interface Organiser {
  name: string;
  company: string;
  email: string;
}

const ORGANISERS: readonly Organiser[] = [
  {
    name: "Tom Stansfield",
    company: "Lincolnshire Marketing",
    email: "tom@lincolnshiremarketing.co.uk",
  },
  {
    name: "Paul Green",
    company: "Business Unfinished",
    email: "paul@businessunfinished.co.uk",
  },
];

function mailto(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export default function ContactPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Contact"
              heading="Talk to us."
              lede="Ignite 27 is run by Tom Stansfield at Lincolnshire Marketing and Paul Green at Business Unfinished. Either of us is happy to hear from you. Pick whoever, we sort it out from there."
              as="h1"
            />
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {ORGANISERS.map((o) => (
              <div
                key={o.email}
                className="rounded-2xl border border-ignite-line bg-ignite-white p-6"
              >
                <p className="text-eyebrow uppercase text-ignite-red">{o.company}</p>
                <p className="mt-3 text-h3">{o.name}</p>
                <p className="mt-4">
                  <Link
                    href={mailto(o.email, ENQUIRY_SUBJECT)}
                    className="text-body font-semibold text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                  >
                    {o.email}
                  </Link>
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Common enquiries"
              heading="What people usually get in touch about."
            />
            <ul className="mt-8 grid gap-6 md:grid-cols-2">
              <li className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
                <p className="text-h3">Exhibitor enquiries</p>
                <p className="mt-3 text-body text-ignite-muted">
                  Stand availability, kit details, invoicing for exhibitor
                  bookings. We usually reply within one working day.
                </p>
                <p className="mt-4 text-small">
                  <Link
                    href={mailto("tom@lincolnshiremarketing.co.uk", EXHIBITOR_SUBJECT)}
                    className="font-semibold text-ignite-red underline underline-offset-4"
                  >
                    Email Tom about exhibiting
                  </Link>
                </p>
              </li>
              <li className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
                <p className="text-h3">Sponsorship</p>
                <p className="mt-3 text-body text-ignite-muted">
                  Headline, Speakers Den, and Partner tiers. Enquiry-led,
                  bespoke. We&apos;ll walk you through what&apos;s available.
                </p>
                <p className="mt-4 text-small">
                  <Link
                    href={mailto("paul@businessunfinished.co.uk", SPONSORSHIP_SUBJECT)}
                    className="font-semibold text-ignite-red underline underline-offset-4"
                  >
                    Email Paul about sponsoring
                  </Link>
                </p>
              </li>
            </ul>
            <p className="mt-8 text-small text-ignite-muted">
              For refund or transfer requests, see the{" "}
              <Link
                href="/refund-policy"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                refund policy
              </Link>
              . For anything else, either address above is fine.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
