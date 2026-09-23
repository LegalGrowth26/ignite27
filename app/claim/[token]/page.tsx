import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import {
  CLAIM_TOKEN_PATTERN,
  claimPageState,
  claimsRemaining,
} from "@/lib/ambassadors/claim";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { ClaimForm } from "./ClaimForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim your ticket · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}

// Public claim page: the token is the whole secret. The states here
// are presentation only; the database function re-checks the
// allowance under a row lock at claim time, so a stale page can never
// overspend it.
export default async function ClaimPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { status } = await searchParams;
  if (!CLAIM_TOKEN_PATTERN.test(token)) notFound();

  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("ambassadors")
    .select("id, display_name, comp_allowance, deactivated_at")
    .eq("comp_claim_token", token)
    .maybeSingle();
  const ambassador = data as {
    id: string;
    display_name: string;
    comp_allowance: number;
    deactivated_at: string | null;
  } | null;
  if (!ambassador) notFound();

  const firstName = ambassador.display_name.split(/\s+/)[0] ?? ambassador.display_name;

  if (status === "claimed") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="You're in"
              heading="Your ticket is booked."
              lede={`A confirmation is on its way to your inbox. See you at IGNITE! 27 on Thursday 21 January 2027 at Kelham Hall, Newark. ${firstName} will be pleased.`}
              as="h1"
            />
          </div>
        </Container>
      </Section>
    );
  }

  const { count } = await service
    .from("ambassador_comps")
    .select("id", { count: "exact", head: true })
    .eq("ambassador_id", ambassador.id);
  const used = count ?? 0;
  const state = claimPageState(ambassador, used);

  if (state === "unavailable") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Guest tickets"
              heading="This link is taking a break."
              lede="It is not accepting claims right now. Tickets for IGNITE! 27 are still available on the booking page."
              as="h1"
            />
            <p className="mt-6">
              <a
                href="/attend"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                Book a ticket
              </a>
            </p>
          </div>
        </Container>
      </Section>
    );
  }

  if (state === "exhausted") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="Guest tickets"
              heading={`All of ${firstName}'s guest tickets have been claimed.`}
              lede="They went fast. The good news: tickets for IGNITE! 27 are still available, and they are worth every penny."
              as="h1"
            />
            <p className="mt-6">
              <a
                href="/attend"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                Book your IGNITE! 27 place
              </a>
            </p>
          </div>
        </Container>
      </Section>
    );
  }

  const remaining = claimsRemaining(ambassador, used);

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <SectionHeader
            eyebrow="You're invited"
            heading={`${firstName} has a free IGNITE! 27 ticket for you.`}
            lede="A full delegate ticket for Thursday 21 January 2027 at Kelham Hall, Newark: talks, workshops, and a room full of people worth meeting. Fill in your details and it lands in your inbox."
            as="h1"
          />
          {remaining === 1 ? (
            <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
              This is the last one, so no dawdling.
            </p>
          ) : null}
          <div className="mt-8">
            <ClaimForm token={token} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
