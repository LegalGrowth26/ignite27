import { Container } from "./Container";
import { Section } from "./Section";
import { SectionHeader } from "./SectionHeader";

export type BookingStep = { label: string; body: string };

type HowBookingWorksProps = {
  eyebrow?: string;
  heading: string;
  steps: readonly BookingStep[];
  tone?: "light" | "cream";
};

export function HowBookingWorks({
  eyebrow = "How booking works",
  heading,
  steps,
  tone = "cream",
}: HowBookingWorksProps) {
  return (
    <Section tone={tone}>
      <Container>
        <SectionHeader eyebrow={eyebrow} heading={heading} />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {steps.map((step, index) => (
            <li key={step.label} className="flex flex-col gap-3">
              <span
                aria-hidden
                className="font-bold leading-none text-ignite-red"
                style={{ fontSize: "2.75rem", letterSpacing: "-0.03em" }}
              >
                {index + 1}
              </span>
              <p className="text-h3">{step.label}</p>
              <p className="text-body text-ignite-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
