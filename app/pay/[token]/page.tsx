import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import {
  amountWithVatLabel,
  requestDisplayStatus,
} from "@/lib/partners/payments";
import { PARTNER_TIER_META, type PartnerTier } from "@/lib/partners/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { startPartnerPaymentAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partnership payment · IGNITE! 27",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}

// Public partner payment page. The token is the whole secret; every
// decision is re-checked when Pay now is pressed, and the webhook is
// the source of truth for paid-ness. Statuses cover: pending (pay
// button), just-back-from-Stripe (optimistic thanks while the webhook
// lands), paid, expired, cancelled or ended.
export default async function PartnerPayPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { status } = await searchParams;
  if (!TOKEN_PATTERN.test(token)) notFound();

  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("partner_payment_requests")
    .select(
      `id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at, gross_paid_pence,
       partners ( company_name, tier, status )`,
    )
    .eq("token", token)
    .maybeSingle();
  const request = data as unknown as {
    id: string;
    amount_ex_vat_pence: number;
    status: "pending" | "paid" | "cancelled";
    expires_at: string;
    sent_at: string | null;
    paid_at: string | null;
    gross_paid_pence: number | null;
    partners: { company_name: string; tier: PartnerTier; status: string } | null;
  } | null;
  if (!request || !request.partners) notFound();

  const partner = request.partners;
  const tierLabel = PARTNER_TIER_META[partner.tier].label;

  if (request.status === "paid" || status === "paid") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="IGNITE! 27 partnership"
              heading="Payment received. Thank you."
              lede={
                request.status === "paid"
                  ? `${partner.company_name}'s payment is in. Stripe's receipt and our confirmation are on their way to your inbox.`
                  : "Your payment has gone through. The receipt and our confirmation are on their way to your inbox."
              }
              as="h1"
            />
          </div>
        </Container>
      </Section>
    );
  }

  const displayStatus =
    partner.status === "ended"
      ? "cancelled"
      : requestDisplayStatus(request, new Date());

  if (displayStatus === "cancelled") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="IGNITE! 27 partnership"
              heading="This payment link is no longer active."
              lede="No payment is due through it. If that seems wrong, reply to the email it arrived in and we will sort it."
              as="h1"
            />
          </div>
        </Container>
      </Section>
    );
  }

  if (displayStatus === "expired") {
    return (
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            <SectionHeader
              eyebrow="IGNITE! 27 partnership"
              heading="This payment link has expired."
              lede="They last 30 days. Reply to the email it arrived in and we will send a fresh one."
              as="h1"
            />
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-2xl">
          <SectionHeader
            eyebrow="IGNITE! 27 partnership"
            heading={`${partner.company_name}'s partnership payment.`}
            lede={`${tierLabel} at IGNITE! 27, Thursday 21 January 2027 at Kelham Hall, Newark.`}
            as="h1"
          />
          <div className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6">
            <p className="text-eyebrow uppercase text-ignite-muted">Amount</p>
            <p className="mt-2 text-h2">{amountWithVatLabel(request.amount_ex_vat_pence)}</p>
            <p className="mt-2 text-small text-ignite-muted">
              Card payment handled securely by Stripe. VAT is calculated and
              itemised on your receipt.
            </p>
            {status === "error" ? (
              <p className="mt-4 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
                Something went wrong starting the payment. Try again in a
                moment.
              </p>
            ) : null}
            <form action={startPartnerPaymentAction.bind(null, token)} className="mt-6">
              <button
                type="submit"
                className="rounded-full bg-ignite-red px-8 py-3 text-body font-semibold text-ignite-white hover:bg-ignite-red/90"
              >
                Pay now
              </button>
            </form>
          </div>
        </div>
      </Container>
    </Section>
  );
}
