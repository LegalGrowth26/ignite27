import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";

export const metadata: Metadata = {
  title: "Stand not booked · IGNITE! 27",
};

export default function ExhibitorCancelPage() {
  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow uppercase text-ignite-red">Not booked</p>
          <h1 className="mt-4 text-h1">Your stand isn&apos;t booked.</h1>
          <p className="mt-4 text-lead text-ignite-muted">
            Nothing has been charged and no stand is held. If that was not what you
            meant, try again below.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/exhibit/book" variant="primary" size="lg">
              Try again
            </Button>
            <Button href="/exhibit" variant="secondary" size="lg">
              Back to exhibiting
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
