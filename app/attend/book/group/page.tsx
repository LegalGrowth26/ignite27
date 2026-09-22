import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { GroupBookingForm } from "@/components/GroupBookingForm";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { resolveBookingNow } from "@/lib/bookings/test-override";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book for your team · IGNITE! 27",
  description:
    "Bring the team to IGNITE! 27: 3 or more tickets save 10%, 5 or more save 25%. Thursday 21 January 2027 at Kelham Hall, Newark.",
};

type PricingState =
  | { status: "live"; pricing: CurrentPricing }
  | { status: "pre_open" }
  | { status: "closed" };

function resolvePricing(now: Date): PricingState {
  try {
    return { status: "live", pricing: getCurrentPricing(now) };
  } catch (err) {
    if (err instanceof BookingsNotOpenError) return { status: "pre_open" };
    if (err instanceof BookingsClosedError) return { status: "closed" };
    throw err;
  }
}

function formatPeriodLabel(period: CurrentPricing["period"]): string {
  switch (period) {
    case "launch":
      return "Launch pricing";
    case "standard":
      return "Standard pricing";
    case "late":
      return "Late pricing";
  }
}

export default async function GroupBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const state = resolvePricing(resolveBookingNow());

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Group booking"
            heading={
              state.status === "live"
                ? "Bring the team. Save while you're at it."
                : state.status === "pre_open"
                  ? "Bookings open 1 August 2026."
                  : "Bookings are closed."
            }
            lede={
              state.status === "live"
                ? "2 to 10 tickets in one payment. 3 or more save 10% on tickets, 5 or more save 25%. Regular and VIP both count, and you can leave names as TBC for now."
                : undefined
            }
          />

          <p className="mt-4 text-small text-ignite-muted">
            Just booking for yourself?{" "}
            <Link
              href="/attend/book"
              className="font-semibold text-ignite-red underline underline-offset-4"
            >
              Use the standard form
            </Link>
            .
          </p>

          {status === "cancelled" ? (
            <p className="mt-6 rounded-xl border border-ignite-line bg-ignite-cream p-4 text-body text-ignite-ink">
              Payment cancelled. Nothing was charged; your details are still
              below if you want to try again.
            </p>
          ) : null}

          {state.status === "live" ? (
            <div className="mt-10">
              <GroupBookingForm
                regularExVatPence={state.pricing.delegate.regular.exVatPence}
                vipExVatPence={state.pricing.delegate.vip.exVatPence}
                lunchIncVatPence={state.pricing.delegate.lunchAddOn.incVatPence}
                periodLabel={formatPeriodLabel(state.pricing.period)}
              />
            </div>
          ) : state.status === "pre_open" ? (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                Bookings open 09:00, Saturday 1 August 2026. Come back then.
              </p>
              <div className="mt-4">
                <Button href="/attend" variant="secondary" size="md">
                  Back to attend
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                Bookings for IGNITE! 27 are closed. See you in 2028.
              </p>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
