import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "./client";
import { ensureStripeProducts, STRIPE_PRODUCT_IDS } from "./products";

// Partner payment Checkout Sessions. The emailed link is OUR stable
// /pay/<token> page; each "Pay now" click mints a fresh session here
// (Stripe caps a session's own life at 24 hours, so the session is
// never the thing that has to stay valid for 30 days). Ex-VAT amount
// with tax_behavior "exclusive" and automatic_tax, identical to the
// booking checkouts: Stripe adds 20% UK VAT on top and itemises it on
// the receipt.

export const PARTNER_PAYMENT_METADATA_TYPE = "partner_payment";

export interface PartnerPaymentSessionInput {
  requestId: string;
  partnerId: string;
  token: string;
  amountExVatPence: number;
  companyName: string;
  contactEmail: string;
}

export function buildPartnerPaymentMetadata(
  input: Pick<PartnerPaymentSessionInput, "requestId" | "partnerId">,
): Record<string, string> {
  return {
    booking_type: PARTNER_PAYMENT_METADATA_TYPE,
    partner_payment_request_id: input.requestId,
    partner_id: input.partnerId,
  };
}

export async function createPartnerPaymentSession(
  input: PartnerPaymentSessionInput,
): Promise<{ url: string; sessionId: string }> {
  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const stripe = getStripe();
  await ensureStripeProducts(stripe, ["partner"]);

  const metadata = buildPartnerPaymentMetadata(input);
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    currency: "gbp",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: input.amountExVatPence,
          tax_behavior: "exclusive",
          product: STRIPE_PRODUCT_IDS.partner,
        },
      },
    ],
    customer_email: input.contactEmail,
    client_reference_id: `partner-${input.token}`,
    metadata,
    payment_intent_data: {
      statement_descriptor_suffix: "IGNITE 27",
      metadata,
      description: `IGNITE! 27 partnership: ${input.companyName}`,
    },
    automatic_tax: { enabled: true },
    success_url: `${siteUrl}/pay/${input.token}?status=paid`,
    cancel_url: `${siteUrl}/pay/${input.token}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  };
  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
