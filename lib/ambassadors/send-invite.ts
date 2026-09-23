import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  AmbassadorInviteEmail,
  renderAmbassadorInvitePlainText,
  type AmbassadorInviteProps,
} from "@/emails/ambassador-invite";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { getStripe } from "@/lib/stripe/client";
import { ambassadorShareUrl } from "./attribution";
import { claimUrl } from "./claim";
import {
  claimLinkLine,
  compTicketsLine,
  discountLines,
  type AmbassadorPromoDetails,
} from "./welcome";

// The ambassador welcome, built from the ambassador's ACTUAL record so
// the create flow and any resend produce the same email: comps block
// only when they have an allowance, discount block only when they have
// a code (limits confirmed against Stripe when possible), share link
// always, then the set-password + dashboard links.

interface AmbassadorRecord {
  slug: string;
  display_name: string;
  comp_allowance: number;
  discount_percent: number | null;
  promo_code: string | null;
  comp_claim_token: string | null;
  users: { email: string; first_name: string | null } | null;
}

// The code's real limits live on the Stripe promotion code. A failed
// lookup degrades to limits: null, which the copy builder renders as
// code + percent with NO claim about limits (never a "no limit" we
// cannot back).
async function resolvePromoDetails(
  record: AmbassadorRecord,
): Promise<AmbassadorPromoDetails | null> {
  if (!record.promo_code) return null;
  const fallbackPercent = record.discount_percent ?? 0;
  try {
    const stripe: Stripe = getStripe();
    const { data } = await stripe.promotionCodes.list({
      code: record.promo_code,
      limit: 1,
    });
    const promo = data[0];
    if (!promo) {
      return { code: record.promo_code, percentOff: fallbackPercent, limits: null };
    }
    return {
      code: promo.code,
      percentOff: promo.coupon?.percent_off ?? fallbackPercent,
      limits: {
        maxRedemptions: promo.max_redemptions ?? null,
        expiresAt: promo.expires_at ? new Date(promo.expires_at * 1000) : null,
      },
    };
  } catch (err) {
    console.error("[ambassador-welcome] promo lookup failed (sending without limits):", err);
    return { code: record.promo_code, percentOff: fallbackPercent, limits: null };
  }
}

export async function sendAmbassadorWelcome(
  service: SupabaseClient,
  ambassadorId: string,
): Promise<void> {
  const { data, error } = await service
    .from("ambassadors")
    .select(
      "slug, display_name, comp_allowance, discount_percent, promo_code, comp_claim_token, users ( email, first_name )",
    )
    .eq("id", ambassadorId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`ambassador lookup failed: ${error?.message ?? "not found"}`);
  }
  const record = data as unknown as AmbassadorRecord;
  const email = record.users?.email;
  if (!email) throw new Error("ambassador has no account email");

  const firstName =
    record.users?.first_name?.trim() || record.display_name.split(/\s+/)[0] || "there";
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  const props: AmbassadorInviteProps = {
    firstName,
    shareUrl: ambassadorShareUrl(siteUrl, record.slug),
    dashboardUrl: `${siteUrl}/ambassador`,
    setPasswordUrl: await generateSetPasswordLink(email),
    compLine: compTicketsLine(record.comp_allowance),
    discountLines: discountLines(await resolvePromoDetails(record)),
    claimUrl:
      record.comp_allowance > 0 && record.comp_claim_token
        ? claimUrl(siteUrl, record.comp_claim_token)
        : null,
    claimLine: claimLinkLine(record.comp_allowance),
  };

  const html = await render(AmbassadorInviteEmail(props));
  const text = renderAmbassadorInvitePlainText(props);
  await sendTransactionalEmail({
    to: email,
    subject: "Welcome aboard: your IGNITE! 27 ambassador dashboard",
    html,
    text,
    tag: "ambassador-invite",
  });
}
