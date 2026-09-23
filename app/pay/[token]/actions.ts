"use server";

import { redirect } from "next/navigation";
import { canPayRequest } from "@/lib/partners/payments";
import { createPartnerPaymentSession } from "@/lib/stripe/partner-checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Pay now": re-checks the request server-side, then mints a fresh
// Checkout Session for THIS request's snapshotted amount and sends
// the browser to Stripe. Every refusal lands back on the /pay page,
// which renders the right state.
export async function startPartnerPaymentAction(token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) redirect("/");

  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("partner_payment_requests")
    .select(
      `id, partner_id, amount_ex_vat_pence, status, expires_at, sent_at, paid_at,
       partners ( company_name, contact_email, status )`,
    )
    .eq("token", token)
    .maybeSingle();
  const request = data as unknown as {
    id: string;
    partner_id: string;
    amount_ex_vat_pence: number;
    status: "pending" | "paid" | "cancelled";
    expires_at: string;
    sent_at: string | null;
    paid_at: string | null;
    partners: {
      company_name: string;
      contact_email: string;
      status: string;
    } | null;
  } | null;
  if (!request || !request.partners) redirect("/");

  const partnerEnded = request.partners.status === "ended";
  if (!canPayRequest(request, partnerEnded, new Date())) {
    redirect(`/pay/${token}`);
  }

  let url: string;
  try {
    const session = await createPartnerPaymentSession({
      requestId: request.id,
      partnerId: request.partner_id,
      token,
      amountExVatPence: request.amount_ex_vat_pence,
      companyName: request.partners.company_name,
      contactEmail: request.partners.contact_email,
    });
    url = session.url;
  } catch (err) {
    console.error("[partner-pay] session creation failed:", err);
    redirect(`/pay/${token}?status=error`);
  }
  redirect(url!);
}
