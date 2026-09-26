import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PartnerWelcomeEmail,
  renderPartnerWelcomePlainText,
  type PartnerWelcomeProps,
} from "@/emails/partner-welcome";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import { claimUrl } from "@/lib/ambassadors/claim";
import {
  claimLinkLine,
  compTicketsLine,
  discountLines,
} from "@/lib/ambassadors/welcome";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { inviteAccessBlock, loginUrl } from "@/lib/speakers/invite-access";
import { PARTNER_TIER_META, type PartnerTier } from "./validate";

// Partner welcome, built from the ACTUAL rows so first send and any
// resend read the same: package booking reference, the partner-owned
// ambassador row's numbers (absent on no-trample, so those blocks
// simply do not render), and the account access block.

export async function sendPartnerWelcome(
  service: SupabaseClient,
  partnerId: string,
  accountExisted: boolean,
): Promise<void> {
  const { data, error } = await service
    .from("partners")
    .select("id, company_name, contact_name, contact_email, tier, package_booking_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`partner lookup failed: ${error?.message ?? "not found"}`);
  }
  const partner = data as {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    tier: PartnerTier;
    package_booking_id: string | null;
  };

  let placesReference: string | null = null;
  if (partner.package_booking_id) {
    const { data: bookingRow } = await service
      .from("bookings")
      .select("booking_reference")
      .eq("id", partner.package_booking_id)
      .maybeSingle();
    placesReference =
      (bookingRow as { booking_reference: string | null } | null)?.booking_reference ?? null;
  }

  const { data: ambData } = await service
    .from("ambassadors")
    .select("slug, comp_allowance, discount_percent, promo_code, comp_claim_token")
    .eq("partner_id", partner.id)
    .maybeSingle();
  const amb = ambData as {
    slug: string;
    comp_allowance: number;
    discount_percent: number | null;
    promo_code: string | null;
    comp_claim_token: string | null;
  } | null;

  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const access = inviteAccessBlock(accountExisted);
  const firstName =
    partner.contact_name.trim().split(/\s+/)[0] ?? partner.contact_name;

  const props: PartnerWelcomeProps = {
    firstName,
    companyName: partner.company_name,
    tierLabel: PARTNER_TIER_META[partner.tier].label,
    placesReference,
    accountUrl: `${siteUrl}/account`,
    shareUrl: amb ? ambassadorShareUrl(siteUrl, amb.slug) : null,
    compLine: amb ? compTicketsLine(amb.comp_allowance) : null,
    claimUrl:
      amb && amb.comp_allowance > 0 && amb.comp_claim_token
        ? claimUrl(siteUrl, amb.comp_claim_token)
        : null,
    claimLine: amb ? claimLinkLine(amb.comp_allowance) : null,
    discountLines:
      amb && amb.promo_code
        ? discountLines({
            code: amb.promo_code,
            percentOff: amb.discount_percent ?? 20,
            // Partner codes are created with no cap and no expiry.
            limits: { maxRedemptions: null, expiresAt: null },
          })
        : null,
    accessIntro: access.intro,
    accessLabel: access.buttonLabel,
    accessUrl: access.useSetPasswordLink
      ? await generateSetPasswordLink(partner.contact_email)
      : loginUrl(siteUrl),
    accessNote: access.note,
  };

  const html = await render(PartnerWelcomeEmail(props));
  await sendTransactionalEmail({
    to: partner.contact_email,
    subject: "Welcome aboard: your IGNITE! 27 partner package",
    html,
    text: renderPartnerWelcomePlainText(props),
    tag: "partner-welcome",
  });
}
