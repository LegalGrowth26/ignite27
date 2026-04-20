import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";

export const metadata: Metadata = {
  title: "Booking cancelled — Ignite 27",
};

export default function BookingCancelPage() {
  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow uppercase text-ignite-red">Not booked</p>
          <h1 className="mt-4 text-h1">Your booking isn&apos;t complete.</h1>
          <p className="mt-4 text-lead text-ignite-muted">
            Nothing has been charged. If that was not what you meant, try again below.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/attend/book" variant="primary" size="lg">
              Try again
            </Button>
            <Button href="/attend" variant="secondary" size="lg">
              Back to attend
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
