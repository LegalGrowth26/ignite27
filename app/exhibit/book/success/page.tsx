import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";
import { formatPoundsFromPence } from "@/lib/pricing";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stand booked · IGNITE! 27",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface ExhibitorBookingLookup {
  reference: string;
  bookingId: string;
  company: string | null;
  grossAmountPence: number;
  attendees: string[];
}

async function lookupBooking(sessionId: string): Promise<ExhibitorBookingLookup | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_reference, gross_amount_pence, booking_attendees!inner(first_name, surname, company, attendee_index)",
    )
    .eq("stripe_checkout_session_id", sessionId)
    .eq("booking_type", "exhibitor")
    .maybeSingle();

  if (error) {
    console.error("[exhibit/book/success] lookup error:", error);
    return null;
  }
  if (!data) return null;

  type AttendeeRow = {
    first_name: string;
    surname: string;
    company: string | null;
    attendee_index: number;
  };
  const attendees = ((data.booking_attendees ?? []) as AttendeeRow[])
    .slice()
    .sort((a, b) => a.attendee_index - b.attendee_index);

  return {
    reference: data.booking_reference ?? "I27-PENDING",
    bookingId: data.id as string,
    company: attendees[0]?.company ?? null,
    grossAmountPence: data.gross_amount_pence as number,
    attendees: attendees.map((a) =>
      isTbcAttendeeName(a.first_name, a.surname)
        ? "To be confirmed"
        : `${a.first_name} ${a.surname}`,
    ),
  };
}

export default async function ExhibitorSuccessPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const sessionIdRaw = searchParams.session_id;
  const sessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw;

  // The webhook writes the booking; on a fast redirect it may not have
  // landed yet. Show the generic confirmation rather than an error.
  const booking = sessionId ? await lookupBooking(sessionId) : null;

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow uppercase text-ignite-red">Stand booked</p>
          <h1 className="mt-4 text-h1">
            {booking?.company ? `${booking.company} is exhibiting.` : "You're exhibiting."}
          </h1>
          <p className="mt-4 text-lead text-ignite-muted">
            Payment confirmed. Your confirmation email is on its way with a link to
            set your account password and fill in your stand requirements.
          </p>

          {booking ? (
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-ignite-line bg-ignite-cream p-6 text-left">
              <p className="text-small text-ignite-muted">Reference</p>
              <p className="text-h3">{booking.reference}</p>
              <p className="mt-4 text-small text-ignite-muted">Attendees</p>
              <p className="text-body text-ignite-ink">{booking.attendees.join(" and ")}</p>
              <p className="mt-4 text-small text-ignite-muted">Paid</p>
              <p className="text-body text-ignite-ink">
                {formatPoundsFromPence(booking.grossAmountPence)}
              </p>
            </div>
          ) : (
            <p className="mx-auto mt-8 max-w-md rounded-2xl border border-ignite-line bg-ignite-cream p-6 text-small text-ignite-muted">
              Your booking reference is in the confirmation email, which usually
              arrives within a couple of minutes.
            </p>
          )}

          <p className="mt-8 text-body text-ignite-ink">
            <strong>Next step:</strong> set your password from the email, then tell us
            what your stand needs (power, table, signage, logo).
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/account" variant="primary" size="lg">
              Go to your account
            </Button>
            <Button href="/exhibit" variant="secondary" size="lg">
              Back to exhibiting
            </Button>
          </div>

          <p className="mt-8 text-small text-ignite-muted">
            No email after 15 minutes? Check spam, then contact{" "}
            <Link
              href="/contact"
              className="font-semibold text-ignite-red underline underline-offset-4"
            >
              the organisers
            </Link>
            .
          </p>
        </div>
      </Container>
    </Section>
  );
}
