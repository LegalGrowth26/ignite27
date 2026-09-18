import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { requireAmbassador } from "@/lib/ambassadors/guard";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import { env } from "@/lib/env";
import { GiveTicketForm } from "./GiveTicketForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ambassador dashboard · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface CompRow {
  recipient_name: string;
  recipient_email: string;
  created_at: string;
}

// Private ambassador dashboard. Same discipline as the customer
// account: their own numbers only, via RLS self-select policies and a
// counts-only definer function. No revenue, no other ambassadors.
export default async function AmbassadorPage() {
  const { client, ambassador } = await requireAmbassador();

  const shareUrl = ambassadorShareUrl(env.siteUrl(), ambassador.slug);

  // Attributed booking counts (definer fn verifies this caller owns
  // the ambassador row and returns counts only).
  let paidBookings = 0;
  const { data: counts, error: countsErr } = await client.rpc(
    "ambassador_booking_counts",
    { p_ambassador_id: ambassador.id },
  );
  if (countsErr) {
    console.error("[ambassador] counts error:", countsErr.message);
  } else {
    const row = (counts as Array<{ paid_bookings: number }> | null)?.[0];
    paidBookings = Number(row?.paid_bookings ?? 0);
  }

  const { data: compData } = await client
    .from("ambassador_comps")
    .select("recipient_name, recipient_email, created_at")
    .eq("ambassador_id", ambassador.id)
    .order("created_at", { ascending: false });
  const comps = (compData ?? []) as CompRow[];
  const compsRemaining = Math.max(0, ambassador.comp_allowance - comps.length);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            eyebrow="Ambassador"
            heading={`Hello, ${ambassador.display_name.split(" ")[0]}.`}
            lede="Your link, your numbers, and your guest tickets. Thanks for helping us pack the room."
            as="h1"
          />

          <div className="mt-10 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
            <h2 className="text-h3">Your share link</h2>
            <p className="mt-2 text-small text-ignite-muted">
              Anyone who books after following this link counts as yours.
            </p>
            <div className="mt-4">
              <ShareLinkCard shareUrl={shareUrl} />
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <dt className="text-eyebrow uppercase text-ignite-muted">Link clicks</dt>
              <dd className="mt-2 text-h2">{ambassador.link_clicks}</dd>
            </div>
            <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <dt className="text-eyebrow uppercase text-ignite-muted">Tickets sold via your link</dt>
              <dd className="mt-2 text-h2">{paidBookings}</dd>
            </div>
            <div className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <dt className="text-eyebrow uppercase text-ignite-muted">Guest tickets left</dt>
              <dd className="mt-2 text-h2">
                {compsRemaining} <span className="text-small text-ignite-muted">of {ambassador.comp_allowance}</span>
              </dd>
            </div>
          </dl>

          {ambassador.discount_percent ? (
            <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
              <h2 className="text-h3">Your personal discount</h2>
              <p className="mt-2 text-body text-ignite-ink">
                {ambassador.promo_code ? (
                  <>
                    Share code{" "}
                    <span className="font-mono font-semibold">{ambassador.promo_code}</span>{" "}
                    for {ambassador.discount_percent}% off.
                  </>
                ) : (
                  <>
                    A {ambassador.discount_percent}% personal code is being set up
                    for you. It will appear here when it goes live.
                  </>
                )}
              </p>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
            <h2 className="text-h3">Give a ticket</h2>
            <p className="mt-2 text-small text-ignite-muted">
              A full delegate ticket on us, sent straight to their inbox.
              You have {compsRemaining} left.
            </p>
            <div className="mt-4">
              <GiveTicketForm disabled={compsRemaining === 0} />
            </div>
          </div>

          {comps.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-ignite-line bg-ignite-white p-6">
              <h2 className="text-h3">Tickets you have given</h2>
              <ul className="mt-4 divide-y divide-ignite-line/60">
                {comps.map((c) => (
                  <li key={`${c.recipient_email}-${c.created_at}`} className="flex flex-wrap justify-between gap-2 py-2 text-small">
                    <span className="font-semibold text-ignite-ink">{c.recipient_name}</span>
                    <span className="text-ignite-muted">{c.recipient_email}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
