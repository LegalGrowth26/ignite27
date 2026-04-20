import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { formatPoundsFromPence } from "@/lib/pricing";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booked — Ignite 27",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface BookingLookup {
  reference: string;
  ticketType: "regular" | "vip";
  firstName: string;
  surname: string;
  gross_amount_pence: number;
  lunch_included: boolean;
}

async function lookupBooking(sessionId: string): Promise<BookingLookup | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_reference, ticket_type, gross_amount_pence, lunch_included, booking_attendees!inner(first_name, surname, is_primary_contact)",
    )
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[attend/book/success] lookup error:", error);
    return null;
  }
  if (!data) return null;

  type AttendeeRow = { first_name: string; surname: string; is_primary_contact: boolean };
  const attendees = (data.booking_attendees ?? []) as AttendeeRow[];
  const primary = attendees.find((a) => a.is_primary_contact) ?? attendees[0];
  if (!primary) return null;

  return {
    reference: data.booking_reference ?? "I27-PENDING",
    ticketType: data.ticket_type as "regular" | "vip",
    firstName: primary.first_name,
    surname: primary.surname,
    gross_amount_pence: data.gross_amount_pence as number,
    lunch_included: Boolean(data.lunch_included),
  };
}

export default async function BookingSuccessPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const sessionIdRaw = searchParams.session_id;
  const sessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw;

  const booking = sessionId ? await lookupBooking(sessionId) : null;

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <p className="text-eyebrow uppercase text-ignite-red">Booked</p>
          <h1 className="mt-4 text-h1">You&apos;re in. Check your inbox.</h1>

          {booking ? (
            <div className="mt-8 rounded-3xl border border-ignite-line bg-ignite-white p-6">
              <dl className="space-y-3 text-body">
                <div className="flex flex-wrap justify-between gap-4">
                  <dt className="text-ignite-muted">Reference</dt>
                  <dd className="font-semibold text-ignite-ink">{booking.reference}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-4">
                  <dt className="text-ignite-muted">Name</dt>
                  <dd className="text-ignite-ink">
                    {booking.firstName} {booking.surname}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-4">
                  <dt className="text-ignite-muted">Ticket</dt>
                  <dd className="text-ignite-ink">
                    {booking.ticketType === "vip" ? "VIP" : "Regular"}
                    {booking.ticketType === "vip"
                      ? " (lunch included)"
                      : booking.lunch_included
                        ? " with lunch"
                        : ""}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-4">
                  <dt className="text-ignite-muted">Paid</dt>
                  <dd className="text-ignite-ink">
                    {formatPoundsFromPence(booking.gross_amount_pence)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="mt-6 text-body text-ignite-muted">
              Your booking is being finalised. The confirmation email is on its way.
            </p>
          )}

          <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-5">
            <p className="text-body text-ignite-ink">
              <strong>Set up your account.</strong> The confirmation email has a link to set a
              password. Once set, you can manage your booking at{" "}
              <Link
                href="/account"
                className="underline underline-offset-4 hover:text-ignite-red"
              >
                your account
              </Link>
              .
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/" variant="secondary" size="md">
              Back home
            </Button>
            <Button href="/attend" variant="secondary" size="md">
              Book another place
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
