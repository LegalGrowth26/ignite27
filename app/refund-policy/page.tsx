import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Refund policy — Ignite 27",
  description:
    "Full refund on request until 31 December 2026. From 1 January 2027, no refunds. Tickets are transferable until bookings close.",
};

const REFUND_CONTACT_EMAIL = "tom@lincolnshiremarketing.co.uk";
const REFUND_MAILTO_SUBJECT = "IGNITE 27 refund or transfer request";

const KEY_POINTS: ReadonlyArray<{ label: string; body: string }> = [
  {
    label: "Full refund until 31 Dec 2026",
    body: "Email us any time up to Thursday 31 December 2026, 23:59 UK, and we will refund your ticket in full.",
  },
  {
    label: "No refunds from 1 Jan 2027",
    body: "From Friday 1 January 2027 onwards we cannot offer refunds. Tickets remain transferable — see below.",
  },
  {
    label: "Transfers welcome any time",
    body: "Cannot make it? Send someone in your place. Tickets are transferable to another named attendee at any time until bookings close (Monday 18 January 2027, 17:00 UK). Email us with the new attendee's name, email, company, job title, mobile, and dietary requirement.",
  },
  {
    label: "How refunds are processed",
    body: "Refunds go back to the original card or payment method via Stripe. Typically 5 to 10 working days depending on your bank.",
  },
];

export default function RefundPolicyPage() {
  const mailto = `mailto:${REFUND_CONTACT_EMAIL}?subject=${encodeURIComponent(
    REFUND_MAILTO_SUBJECT,
  )}`;

  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Refund policy"
              heading="Straightforward and fair."
              lede="Full refunds any time up to New Year's Eve. From January 2027 tickets stay transferable but not refundable."
              as="h1"
            />
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <dl className="grid gap-10 md:grid-cols-2 md:gap-12">
              {KEY_POINTS.map((item) => (
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
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Request a refund or transfer"
              heading="Email Tom."
              lede="One line is enough — your booking reference and whether you want a refund or a transfer."
            />
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-8">
              <p className="text-body text-ignite-ink">
                Email{" "}
                <Link
                  href={mailto}
                  className="font-semibold text-ignite-red underline underline-offset-4"
                >
                  {REFUND_CONTACT_EMAIL}
                </Link>{" "}
                with subject &ldquo;IGNITE 27 refund or transfer request&rdquo;.
              </p>
              <p className="mt-4 text-body text-ignite-muted">
                For transfers, include the new attendee&apos;s name, email,
                company, job title, mobile, and any dietary requirement. We
                will confirm the change and issue a new badge before the day.
              </p>
              <div className="mt-6">
                <Button href={mailto} variant="primary" size="md">
                  Email Tom
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="light">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-h3 text-ignite-ink">Not booked yet?</p>
              <p className="mt-2 text-body text-ignite-muted">
                Lock in your place at the current price.
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
