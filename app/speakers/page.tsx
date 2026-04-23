import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { SpeakersSignupForm } from "@/components/SpeakersSignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Speakers — Ignite 27",
  description:
    "Speakers for Ignite 27 are being announced. Leave your email and we will tell you each time one is confirmed.",
};

export default function SpeakersPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Speakers"
              heading="Speakers being announced."
              lede="We're booking the lineup for Ignite 27. Drop your email and you'll be the first to hear when each speaker is confirmed."
              as="h1"
            />
            <div className="mt-10">
              <SpeakersSignupForm />
            </div>
            <p className="mt-6 text-small text-ignite-muted">
              One email, when speakers are confirmed.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-h3 text-ignite-ink">Don&apos;t want to wait?</p>
              <p className="mt-2 text-body text-ignite-muted">
                You can book your place at Ignite 27 now and lock in the current pricing.
              </p>
            </div>
            <Button href="/attend" variant="primary" size="md" className="self-start md:self-auto">
              Book your place
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
