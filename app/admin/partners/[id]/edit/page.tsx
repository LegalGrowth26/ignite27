import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  amountWithVatLabel,
  defaultRequestPence,
  derivePaymentState,
  paymentStateLabel,
  requestDisplayStatus,
  type PaymentRequestRow,
} from "@/lib/partners/payments";
import { PartnerForm } from "../../PartnerForm";
import { resendPartnerWelcomeAction } from "../../actions";
import {
  CancelPaymentRequestButton,
  ResendPaymentRequestButton,
  SendPaymentRequestForm,
} from "../../PaymentForms";

export const metadata: Metadata = {
  title: "Edit partner · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface Row {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  tier: string;
  agreed_price_pence: number;
  comp_allowance: number;
  status: string;
  notes: string;
  website_url: string | null;
  logo_path: string | null;
}

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { id } = await params;

  const { data, error } = await client
    .from("partners")
    .select(
      `id, company_name, contact_name, contact_email, tier,
       agreed_price_pence, comp_allowance, status, notes, website_url, logo_path`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <p className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6 font-mono text-small">
        {error.message}
      </p>
    );
  }
  const partner = data as unknown as Row | null;
  if (!partner) notFound();

  // Payment ledger: every request, its state, and the running total
  // against the agreed price. Reads under the admin RLS policy.
  const { data: requestData, error: requestsErr } = await client
    .from("partner_payment_requests")
    .select(
      "id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at, send_count, gross_paid_pence",
    )
    .eq("partner_id", id)
    .order("created_at", { ascending: false });
  const requests = ((requestData ?? []) as unknown) as Array<
    PaymentRequestRow & { send_count: number; gross_paid_pence: number | null }
  >;
  const derived = derivePaymentState(partner.agreed_price_pence, requests);
  const defaultPence = defaultRequestPence(partner.agreed_price_pence, requests);
  const now = new Date();
  const ukDate = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(iso));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/partners"
        className="text-small font-semibold text-ignite-red underline underline-offset-4"
      >
        Back to partners
      </Link>
      <h1 className="mt-4 text-h1">Edit partner</h1>
      <div className="mt-8">
        <PartnerForm
          partnerId={partner.id}
          submitLabel="Save partner"
          defaults={{
            companyName: partner.company_name,
            contactName: partner.contact_name,
            contactEmail: partner.contact_email,
            tier: partner.tier,
            agreedPricePounds: String(partner.agreed_price_pence / 100),
            compAllowance: String(partner.comp_allowance ?? 2),
            notes: partner.notes,
            websiteUrl: partner.website_url ?? "",
            hasLogo: Boolean(partner.logo_path),
          }}
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-ignite-muted">
          Package welcome (places, guest ticket link, share link, code) went
          out when the partner was provisioned.
        </p>
        <form action={resendPartnerWelcomeAction.bind(null, partner.id)}>
          <button
            type="submit"
            className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
          >
            Resend welcome
          </button>
        </form>
      </div>

      <h2 className="mt-8 text-h2">Payments</h2>
      {requestsErr ? (
        <p className="mt-2 rounded-xl border-2 border-ignite-red bg-ignite-red/5 p-3 text-small text-ignite-red">
          Payment ledger unavailable ({requestsErr.message}). If this mentions
          a missing table, the 20260515 migration has not been applied here.
        </p>
      ) : null}
      <p className="mt-2 text-small text-ignite-muted">
        {paymentStateLabel(derived)} against the agreed{" "}
        {amountWithVatLabel(partner.agreed_price_pence)}. Status follows the
        money: it flips when Stripe confirms a payment, never by hand.
        {partner.status === "ended" ? " This partnership has ended; links are cancelled." : ""}
      </p>

      {partner.status !== "ended" ? (
        <div className="mt-4 rounded-2xl border border-ignite-line bg-ignite-white p-5">
          <SendPaymentRequestForm
            partnerId={partner.id}
            defaultAmountPounds={defaultPence > 0 ? String(defaultPence / 100) : ""}
            vatPreviewNote={
              defaultPence > 0
                ? `Remaining balance: ${amountWithVatLabel(defaultPence)}.`
                : "Fully covered; enter an amount only for a deliberate extra request."
            }
          />
        </div>
      ) : null}

      {requests.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {requests.map((r) => {
            const state = requestDisplayStatus(r, now);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ignite-line bg-ignite-white p-4"
              >
                <div>
                  <p className="text-body font-semibold text-ignite-ink">
                    {amountWithVatLabel(r.amount_ex_vat_pence)}
                  </p>
                  <p className="mt-1 text-small text-ignite-muted">
                    {state === "paid" && r.paid_at
                      ? `Paid ${ukDate(r.paid_at)}`
                      : state === "pending"
                        ? `${r.sent_at ? `Sent ${ukDate(r.sent_at)}` : "Not emailed yet"} · expires ${ukDate(r.expires_at)}${r.send_count > 1 ? ` · sent ${r.send_count} times` : ""}`
                        : state === "expired"
                          ? `Expired ${ukDate(r.expires_at)}${r.sent_at ? ` · last sent ${ukDate(r.sent_at)}` : ""}`
                          : "Cancelled"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(state === "pending" || state === "expired") && partner.status !== "ended" ? (
                    <>
                      <ResendPaymentRequestButton requestId={r.id} />
                      <CancelPaymentRequestButton requestId={r.id} />
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-ignite-line bg-ignite-white p-5 text-small text-ignite-muted">
          No payment requests yet. Send the first one above; the partner gets
          an email with a secure pay link, and payment flips the status here
          automatically.
        </p>
      )}
    </div>
  );
}
