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
  title: "Booked · IGNITE! 27",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface GroupTicketRow {
  reference: string;
  ticketType: string;
  attendeeName: string;
  lunch: boolean;
  grossPence: number;
}

// The lead booking carries the session id; siblings share its
// group_intent_id. The webhook creates all of this asynchronously, so
// an empty result just means "still finalising".
async function lookupGroup(sessionId: string): Promise<GroupTicketRow[] | null> {
  const supabase = createSupabaseServiceClient();
  const { data: lead, error: leadErr } = await supabase
    .from("bookings")
    .select("group_intent_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (leadErr) {
    console.error("[group/success] lead lookup error:", leadErr);
    return null;
  }
  const groupIntentId = (lead as { group_intent_id: string | null } | null)
    ?.group_intent_id;
  if (!groupIntentId) return null;

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `booking_reference, ticket_type, lunch_included, gross_amount_pence,
       group_position,
       booking_attendees ( first_name, surname )`,
    )
    .eq("group_intent_id", groupIntentId)
    .order("group_position", { ascending: true });
  if (error) {
    console.error("[group/success] group lookup error:", error);
    return null;
  }

  type Row = {
    booking_reference: string | null;
    ticket_type: string;
    lunch_included: boolean;
    gross_amount_pence: number;
    booking_attendees: Array<{ first_name: string; surname: string }>;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const a = r.booking_attendees?.[0];
    const name =
      a && !isTbcAttendeeName(a.first_name, a.surname)
        ? `${a.first_name} ${a.surname}`
        : "Name TBC";
    return {
      reference: r.booking_reference ?? "I27-PENDING",
      ticketType: r.ticket_type === "vip" ? "VIP" : "Regular",
      attendeeName: name,
      lunch: r.lunch_included,
      grossPence: r.gross_amount_pence,
    };
  });
}

export default async function GroupSuccessPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const sessionIdRaw = searchParams.session_id;
  const sessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw;

  const tickets = sessionId ? await lookupGroup(sessionId) : null;
  const total = (tickets ?? []).reduce((s, t) => s + t.grossPence, 0);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <p className="text-eyebrow uppercase text-ignite-red">Booked</p>
          <h1 className="mt-4 text-h1">The team&apos;s in. Check your inbox.</h1>

          {tickets && tickets.length > 0 ? (
            <div className="mt-8 rounded-3xl border border-ignite-line bg-ignite-white p-6">
              <ul className="space-y-3 text-body">
                {tickets.map((t) => (
                  <li key={t.reference} className="flex flex-wrap justify-between gap-4">
                    <span className="text-ignite-ink">
                      <strong>{t.reference}</strong> · {t.ticketType} · {t.attendeeName}
                      {t.lunch ? " · lunch" : ""}
                    </span>
                    <span className="text-ignite-muted">
                      {formatPoundsFromPence(t.grossPence)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-ignite-line pt-4 text-body font-semibold text-ignite-ink">
                Total {formatPoundsFromPence(total)}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-body text-ignite-muted">
              Your bookings are being finalised. The confirmation email, with
              every ticket listed, is on its way to the lead booker.
            </p>
          )}

          <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-cream p-5">
            <p className="text-body text-ignite-ink">
              <strong>One email, all the tickets.</strong> The confirmation goes
              to the lead booker with a link to set a password; every booking
              then lives in{" "}
              <Link
                href="/account"
                className="underline underline-offset-4 hover:text-ignite-red"
              >
                your account
              </Link>
              . Any &quot;Name TBC&quot; places can be confirmed nearer the event.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/" variant="secondary" size="md">
              Back home
            </Button>
            <Button href="/workshops" variant="secondary" size="md">
              Browse the workshops
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
