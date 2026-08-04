import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Reserve your stand · IGNITE! 27",
  description:
    "Reserve your exhibitor stand at IGNITE! 27. £189 + VAT launch price, includes 2 attendee places and 2 lunches. Email us and we'll hold your stand at launch pricing.",
};

// STOPGAP page. The online exhibitor checkout is being built this week;
// until it ships, this page catches the live "Reserve your stand" CTAs
// (and a 300-person email campaign) that previously 404'd. Reservation
// happens by email to Tom. Replace the mailto flow with the real
// checkout when the exhibitor booking flow lands.

const RESERVATION_EMAIL = "tom@lincolnshiremarketing.co.uk";
const RESERVATION_SUBJECT = "IGNITE! 27 stand reservation";
const RESERVATION_BODY = [
  "Hi Tom,",
  "",
  "We'd like to reserve a stand at IGNITE! 27.",
  "",
  "Company name:",
  "Contact name:",
  "Phone:",
  "",
  "Thanks,",
].join("\r\n");

const MAILTO_HREF = `mailto:${RESERVATION_EMAIL}?subject=${encodeURIComponent(
  RESERVATION_SUBJECT,
)}&body=${encodeURIComponent(RESERVATION_BODY)}`;

export default function ExhibitBookPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionHeader
              eyebrow="Exhibit"
              heading="Reserve your stand."
              lede="£189 + VAT (£226.80) launch price. Includes 2 attendee places and 2 lunches."
              as="h1"
            />

            <div className="mt-10 rounded-2xl border border-ignite-line bg-ignite-white p-6 sm:p-8">
              <p className="text-body">
                Online stand booking is coming this week. Email us now and
                we&apos;ll hold your stand at launch pricing.
              </p>
              <p className="mt-6">
                <Button href={MAILTO_HREF} variant="primary" size="lg">
                  Email us to reserve your stand
                </Button>
              </p>
              <p className="mt-4 text-small text-ignite-muted">
                The email opens pre-filled. Just add your company name,
                contact name, and phone number, and send. We usually reply
                within one working day.
              </p>
              <p className="mt-2 text-small text-ignite-muted">
                Prefer to write your own? Send your details to{" "}
                <Link
                  href={MAILTO_HREF}
                  className="font-semibold text-ignite-red underline underline-offset-4"
                >
                  {RESERVATION_EMAIL}
                </Link>
                .
              </p>
            </div>

            <p className="mt-8 text-small text-ignite-muted">
              Want the full package details first? See{" "}
              <Link
                href="/exhibit"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                why exhibit at IGNITE! 27
              </Link>{" "}
              or the{" "}
              <Link
                href="/refund-policy"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                refund policy
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
