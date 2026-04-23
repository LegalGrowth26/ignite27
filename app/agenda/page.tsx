import type { Metadata } from "next";
import { AgendaSignupForm } from "@/components/AgendaSignupForm";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda — Ignite 27",
  description:
    "The full Ignite 27 agenda is on the way. Leave your email and we will tell you the moment it is announced.",
};

export default function AgendaPage() {
  return (
    <>
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Agenda"
              heading="The full Ignite 27 lineup is on the way."
              lede="We're locking in speakers, workshops, and the running order. Drop your email and we'll let you know the moment it's announced."
              as="h1"
            />
            <div className="mt-10">
              <AgendaSignupForm />
            </div>
            <p className="mt-6 text-small text-ignite-muted">
              One email, once the agenda is live.
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
            <Button href="/attend" variant="primary" size="md">
              Book your place
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
