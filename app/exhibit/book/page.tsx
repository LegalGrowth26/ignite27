import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { ExhibitorBookingForm } from "@/components/ExhibitorBookingForm";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { countCompletedExhibitorBookings } from "@/lib/bookings/exhibitor-count";
import {
  getBookingOverrideRaw,
  resolveBookingNow,
} from "@/lib/bookings/test-override";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  exhibitorStandsRemaining,
  getCurrentPricing,
  isExhibitorAvailable,
  type CurrentPricing,
} from "@/lib/pricing";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve your stand · IGNITE! 27",
  description:
    "Book your exhibitor stand at IGNITE! 27. Includes 2 attendee places and 2 lunches. Thursday 21 January 2027 at Kelham Hall, Newark.",
};

const RESERVATION_EMAIL = "tom@lincolnshiremarketing.co.uk";

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
      return "Standard pricing"; // exhibitors have no separate late price
  }
}

export default async function ExhibitorBookingPage() {
  const overrideRaw = getBookingOverrideRaw();
  const state = resolvePricing(resolveBookingNow());

  // Live stand count decides the sold-out state. Counted server-side
  // with the service client (anonymous visitors have no RLS read on
  // bookings); the checkout action re-checks before creating a session.
  let standsSold = 0;
  if (state.status === "live") {
    try {
      standsSold = await countCompletedExhibitorBookings(createSupabaseServiceClient());
    } catch (err) {
      // If the count fails, let the form render; the server action
      // re-checks the cap before any money moves.
      console.error("[exhibit/book] stand count failed (rendering form anyway):", err);
    }
  }
  const soldOut = state.status === "live" && !isExhibitorAvailable(standsSold);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          {overrideRaw ? (
            <div
              role="status"
              className="mb-6 rounded-xl border-2 border-ignite-red bg-ignite-red/10 p-4 text-small text-ignite-ink"
            >
              <p className="font-semibold text-ignite-red">
                TEST MODE: using override date {overrideRaw}.
              </p>
              <p className="mt-1">
                Remove <code className="font-mono">BOOKING_TEST_OVERRIDE_DATE</code> env
                var to disable.
              </p>
            </div>
          ) : null}
          <SectionHeader
            eyebrow="Exhibitor stand"
            heading={
              state.status === "live"
                ? soldOut
                  ? "Stands are sold out."
                  : "Your stand, then payment."
                : state.status === "pre_open"
                  ? "Bookings open 1 August 2026."
                  : "Bookings are closed."
            }
            lede={
              state.status === "live" && !soldOut
                ? "Company details, your two attendees, then secure payment via Stripe. Your confirmation and stand requirements form arrive by email as soon as it clears."
                : undefined
            }
            as="h1"
          />

          {state.status === "live" && !soldOut ? (
            <div className="mt-10">
              <ExhibitorBookingForm
                standExVatPence={state.pricing.exhibitor.exVatPence}
                standIncVatPence={state.pricing.exhibitor.incVatPence}
                periodLabel={formatPeriodLabel(state.pricing.period)}
                standsRemaining={exhibitorStandsRemaining(standsSold)}
              />
            </div>
          ) : state.status === "live" && soldOut ? (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                All 50 stands are taken. Email{" "}
                <Link
                  href={`mailto:${RESERVATION_EMAIL}?subject=${encodeURIComponent("IGNITE! 27 stand waiting list")}`}
                  className="font-semibold text-ignite-red underline underline-offset-4"
                >
                  {RESERVATION_EMAIL}
                </Link>{" "}
                to join the waiting list and we will contact you if one frees up.
              </p>
              <div className="mt-4">
                <Button href="/exhibit" variant="secondary" size="md">
                  Back to exhibiting
                </Button>
              </div>
            </div>
          ) : state.status === "pre_open" ? (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                Bookings open 09:00, Saturday 1 August 2026. Come back then.
              </p>
              <div className="mt-4">
                <Button href="/exhibit" variant="secondary" size="md">
                  Back to exhibiting
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                Exhibitor bookings for IGNITE! 27 are closed. See you in 2028.
              </p>
              <div className="mt-4">
                <Link
                  href="/"
                  className="text-small font-semibold text-ignite-red underline underline-offset-4"
                >
                  Back home
                </Link>
              </div>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
