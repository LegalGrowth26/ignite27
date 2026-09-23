import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PartnerPaymentRequestEmail,
  renderPartnerPaymentRequestPlainText,
} from "@/emails/partner-payment-request";
import {
  PartnerPaymentConfirmationEmail,
  renderPartnerPaymentConfirmationPlainText,
} from "@/emails/partner-payment-confirmation";
import { formatUkDate } from "@/lib/ambassadors/welcome";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { PARTNER_TIER_META, type PartnerTier } from "./validate";
import {
  amountWithVatLabel,
  derivePaymentState,
  payUrl,
  type PaymentRequestRow,
} from "./payments";

// Email side of partner payments, through the standard choke point
// (Tom's from-address, allowlist in non-prod).

interface PartnerContact {
  company_name: string;
  contact_name: string;
  contact_email: string;
  tier: PartnerTier;
}

function firstName(contactName: string): string {
  return contactName.trim().split(/\s+/)[0] ?? contactName;
}

export async function sendPartnerPaymentRequestEmail(opts: {
  partner: PartnerContact;
  amountExVatPence: number;
  token: string;
  expiresAt: Date;
  isResend: boolean;
}): Promise<void> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const props = {
    contactFirstName: firstName(opts.partner.contact_name),
    companyName: opts.partner.company_name,
    tierLabel: PARTNER_TIER_META[opts.partner.tier].label,
    amountLabel: amountWithVatLabel(opts.amountExVatPence),
    payUrl: payUrl(siteUrl, opts.token),
    expiresOn: formatUkDate(opts.expiresAt),
    isResend: opts.isResend,
  };
  const html = await render(PartnerPaymentRequestEmail(props));
  await sendTransactionalEmail({
    to: opts.partner.contact_email,
    subject: `Your IGNITE! 27 partnership payment (${props.amountLabel})`,
    html,
    text: renderPartnerPaymentRequestPlainText(props),
    tag: "partner-payment-request",
  });
}

// Success confirmation, 3-branch idempotent like the booking emails:
// the caller only invokes this when confirmation_email_sent_at is
// null, and marks it on success.
export async function sendPartnerPaymentConfirmationEmail(opts: {
  service: SupabaseClient;
  requestId: string;
  partner: PartnerContact & { agreed_price_pence: number; id: string };
  grossPaidPence: number;
  vatAmountPence: number;
}): Promise<void> {
  const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

  // Running position AFTER this payment, from the ledger.
  const { data: rows } = await opts.service
    .from("partner_payment_requests")
    .select("id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at")
    .eq("partner_id", opts.partner.id);
  const derived = derivePaymentState(
    opts.partner.agreed_price_pence,
    (rows ?? []) as PaymentRequestRow[],
  );
  const remainingPence = Math.max(0, derived.agreedPence - derived.paidPence);

  const props = {
    contactFirstName: firstName(opts.partner.contact_name),
    companyName: opts.partner.company_name,
    tierLabel: PARTNER_TIER_META[opts.partner.tier].label,
    paidLabel:
      opts.vatAmountPence > 0
        ? `${pounds(opts.grossPaidPence)} (including ${pounds(opts.vatAmountPence)} VAT)`
        : pounds(opts.grossPaidPence),
    remainingLabel:
      derived.state === "paid_in_full"
        ? null
        : `That leaves ${pounds(remainingPence)} + VAT outstanding on the agreed package; we will send the next payment link when the time comes.`,
  };
  const html = await render(PartnerPaymentConfirmationEmail(props));
  await sendTransactionalEmail({
    to: opts.partner.contact_email,
    subject: "Payment received: thank you from IGNITE! 27",
    html,
    text: renderPartnerPaymentConfirmationPlainText(props),
    tag: "partner-payment-confirmation",
  });

  const { error } = await opts.service
    .from("partner_payment_requests")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", opts.requestId);
  if (error) {
    console.error(
      "[partner-payments] confirmation sent but flag update failed:",
      error.message,
    );
  }
}
