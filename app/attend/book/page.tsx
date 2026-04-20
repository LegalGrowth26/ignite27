import Link from "next/link";
import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import type { DelegateTicketType } from "@/lib/bookings/intent";
import {
  BookingsClosedError,
  BookingsNotOpenError,
  getCurrentPricing,
  type CurrentPricing,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book your place — Ignite 27",
  description:
    "Book your delegate place at Ignite 27. Thursday 21 January 2027 at Kelham Hall, Newark.",
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
  const state = resolvePricing(new Date());

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow={ticketType === "vip" ? "VIP ticket" : "Regular ticket"}
            heading={
              state.status === "live"
                ? "Your details, then payment."
                : state.status === "pre_open"
                  ? "Bookings open 30 June."
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
                ticketPricePence={
                  ticketType === "vip"
                    ? state.pricing.delegate.vip
                    : state.pricing.delegate.regular
                }
                lunchAddOnPence={state.pricing.delegate.lunchAddOn}
                charityUpliftPence={state.pricing.charityUplift}
                windowLabel={formatWindowLabel(state.pricing.window)}
              />
            </div>
          ) : state.status === "pre_open" ? (
            <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-6">
              <p className="text-body text-ignite-ink">
                Bookings open 09:00, Tuesday 30 June 2026. Come back then.
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
                Bookings for Ignite 27 are closed. See you in 2028.
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

function formatWindowLabel(window: CurrentPricing["window"]): string {
  switch (window) {
    case "window_1":
      return "Window 1 pricing";
    case "window_2":
      return "Window 2 pricing";
    case "window_3":
      return "Window 3 pricing";
    case "christmas_drop":
      return "Window 2 pricing";
    case "window_4":
      return "Window 4 pricing";
    case "event_day":
      return "Event-day pricing";
  }
}
