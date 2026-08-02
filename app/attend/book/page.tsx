import Link from "next/link";
import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import type { DelegateTicketType } from "@/lib/bookings/intent";
import {
  getBookingOverrideRaw,
  resolveBookingNow,
} from "@/lib/bookings/test-override";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book your place · IGNITE! 27",
  description:
    "Book your delegate place at IGNITE! 27. Thursday 21 January 2027 at Kelham Hall, Newark.",
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

function parseTicketType(value: string | string[] | undefined): DelegateTicketType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "vip") return "vip";
  return "regular";
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const ticketType = parseTicketType(searchParams.ticket);
  const overrideRaw = getBookingOverrideRaw();
  const state = resolvePricing(resolveBookingNow());

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
            eyebrow={ticketType === "vip" ? "VIP ticket" : "Regular ticket"}
            heading={
              state.status === "live"
                ? "Your details, then payment."
                : state.status === "pre_open"
                  ? "Bookings open 1 August 2026."
                  : "Bookings are closed."
            }
            lede={
              state.status === "live"
                ? "We will hold the price at checkout. Payment via Stripe. Your ticket arrives by email as soon as it clears."
                : undefined
            }
          />

          {state.status === "live" ? (
            <div className="mt-10">
              <BookingForm
                ticketType={ticketType}
                ticketExVatPence={
                  ticketType === "vip"
                    ? state.pricing.delegate.vip.exVatPence
                    : state.pricing.delegate.regular.exVatPence
                }
                ticketIncVatPence={
                  ticketType === "vip"
                    ? state.pricing.delegate.vip.incVatPence
                    : state.pricing.delegate.regular.incVatPence
                }
                lunchAddOnExVatPence={state.pricing.delegate.lunchAddOn.exVatPence}
                lunchAddOnIncVatPence={state.pricing.delegate.lunchAddOn.incVatPence}
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
