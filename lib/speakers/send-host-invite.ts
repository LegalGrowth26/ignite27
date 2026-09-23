import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HostInviteEmail,
  renderHostInvitePlainText,
  type HostInviteProps,
} from "@/emails/host-invite";
import { buildCouponParams, buildPromotionCodeParams } from "@/lib/admin/stripe-codes";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import { compTicketsLine, discountLines } from "@/lib/ambassadors/welcome";
import { generateSetPasswordLink } from "@/lib/bookings/send-confirmation";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeProducts } from "@/lib/stripe/products";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { attachSpeakerAccount } from "./create-profile";
import {
  ambassadorSlugFromProfileSlug,
  HOST_COMP_ALLOWANCE,
  HOST_DISCOUNT_PERCENT,
  hostDiscountCode,
} from "./host-invite";

// Inviting a workshop host, end to end. Steps in order, each one
// idempotent so the invite (and any resend) can be retried safely:
//   1. account created/linked to the host page (attachSpeakerAccount);
//   2. page PUBLISHED (an invited host is an announced host; their
//      page carries the graceful "workshop being finalised" state
//      until their workshop is published);
//   3. personal 20% discount code ensured in Stripe (everything except
//      lunch, no max, no expiry; an existing code with the same code
//      string is reused, never duplicated);
//   4. ambassador row ensured with the confirmed host defaults (comp
//      allowance 2, 20%); an EXISTING ambassador row is left exactly
//      as it is, so inviting someone who is already an ambassador
//      never resets their numbers;
//   5. one combined welcome email.
//
// Steps 3-4 are perk provisioning: failures there are reported back
// (and logged) but do not undo the account or stop the email; the
// email simply omits the blocks that could not be provisioned, and
// the invite can be resent after fixing.

export interface HostInviteResult {
  emailSent: boolean;
  ambassadorReady: boolean;
  codeReady: boolean;
}

interface HostProfileRecord {
  id: string;
  slug: string;
  display_name: string;
  profile_type: string;
  published_at: string | null;
  user_id: string | null;
}

async function ensureHostCode(code: string): Promise<boolean> {
  const stripe = getStripe();
  try {
    const { data } = await stripe.promotionCodes.list({ code, limit: 1 });
    if (data[0]) return true;
    await ensureStripeProducts(stripe);
    const coupon = await stripe.coupons.create(
      buildCouponParams({
        code,
        kind: "percent",
        percentOff: HOST_DISCOUNT_PERCENT,
        appliesTo: "everything_except_lunch",
        note: "workshop host personal code",
      }),
    );
    await stripe.promotionCodes.create(
      buildPromotionCodeParams(
        coupon.id,
        { code, kind: "percent", percentOff: HOST_DISCOUNT_PERCENT },
        "host-invite",
      ),
    );
    return true;
  } catch (err) {
    console.error(`[host-invite] code provisioning failed for ${code}:`, err);
    return false;
  }
}

async function ensureHostAmbassador(
  service: SupabaseClient,
  profile: HostProfileRecord,
  appUserId: string,
  promoCode: string | null,
): Promise<{ ready: boolean; slug: string | null }> {
  try {
    const { data: existing } = await service
      .from("ambassadors")
      .select("id, slug")
      .eq("user_id", appUserId)
      .maybeSingle();
    if (existing) {
      // Already an ambassador: leave their allowance/discount alone.
      return { ready: true, slug: (existing as { slug: string }).slug };
    }

    // Role upgrade, mirroring ambassador creation: super admins keep
    // their role (dual role rides on the ambassadors row alone).
    const { data: userRow } = await service
      .from("users")
      .select("role")
      .eq("id", appUserId)
      .maybeSingle();
    if ((userRow as { role: string } | null)?.role !== "super_admin") {
      const { error: roleErr } = await service
        .from("users")
        .update({ role: "ambassador" })
        .eq("id", appUserId);
      if (roleErr) throw new Error(`role update failed: ${roleErr.message}`);
    }

    const { data: takenRows } = await service
      .from("ambassadors")
      .select("slug")
      .like("slug", `${profile.slug.slice(0, 20)}%`);
    const taken = new Set(
      ((takenRows ?? []) as Array<{ slug: string }>).map((r) => r.slug),
    );
    const slug = ambassadorSlugFromProfileSlug(profile.slug, taken);

    const { error: insertErr } = await service.from("ambassadors").insert({
      user_id: appUserId,
      slug,
      display_name: profile.display_name,
      ambassador_type: "speaker",
      comp_allowance: HOST_COMP_ALLOWANCE,
      discount_percent: HOST_DISCOUNT_PERCENT,
      promo_code: promoCode,
    });
    if (insertErr) throw new Error(`ambassadors insert failed: ${insertErr.message}`);
    return { ready: true, slug };
  } catch (err) {
    console.error("[host-invite] ambassador provisioning failed:", err);
    return { ready: false, slug: null };
  }
}

export async function inviteWorkshopHost(
  profileId: string,
  email: string,
  // Optional note from the admin, rendered as a personal line at the
  // top of the invite email (and nowhere else; it is not stored).
  personalLine: string | null = null,
): Promise<HostInviteResult> {
  const service = createSupabaseServiceClient();

  const { data, error } = await service
    .from("speaker_profiles")
    .select("id, slug, display_name, profile_type, published_at, user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`host profile lookup failed: ${error?.message ?? "not found"}`);
  }
  const profile = data as HostProfileRecord;
  if (profile.profile_type === "main_stage") {
    throw new Error("that profile is main-stage, not a workshop host");
  }

  // 1. Account.
  const { appUserId } = await attachSpeakerAccount(
    service,
    profile.id,
    email,
    profile.display_name,
  );

  // 2. Publish the page (invited = announced).
  if (!profile.published_at) {
    const { error: publishErr } = await service
      .from("speaker_profiles")
      .update({ published_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (publishErr) console.error("[host-invite] publish failed:", publishErr.message);
  }

  // 3 + 4. Perks.
  const code = hostDiscountCode(profile.slug);
  const codeReady = await ensureHostCode(code);
  const ambassador = await ensureHostAmbassador(
    service,
    profile,
    appUserId,
    codeReady ? code : null,
  );

  // The email reads back the AMBASSADOR row (an existing ambassador
  // keeps their own numbers, so the email must show those, not the
  // host defaults).
  let compLine: string | null = null;
  let emailDiscountLines: string[] | null = null;
  let shareSlug = profile.slug;
  if (ambassador.ready && ambassador.slug) {
    shareSlug = ambassador.slug;
    const { data: ambRow } = await service
      .from("ambassadors")
      .select("comp_allowance, discount_percent, promo_code")
      .eq("slug", ambassador.slug)
      .maybeSingle();
    const amb = ambRow as {
      comp_allowance: number;
      discount_percent: number | null;
      promo_code: string | null;
    } | null;
    if (amb) {
      compLine = compTicketsLine(amb.comp_allowance);
      emailDiscountLines = amb.promo_code
        ? discountLines({
            code: amb.promo_code,
            percentOff: amb.discount_percent ?? HOST_DISCOUNT_PERCENT,
            // Host codes are created with no cap and no expiry; an
            // inherited pre-existing code has unknown limits, so only
            // claim "no limit" for the code this invite just ensured.
            limits:
              amb.promo_code === code
                ? { maxRedemptions: null, expiresAt: null }
                : null,
          })
        : null;
    }
  }

  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const props: HostInviteProps = {
    firstName:
      profile.display_name.split(/\s+/)[0] ?? profile.display_name,
    pageUrl: `${siteUrl}/speakers/${profile.slug}`,
    editorUrl: `${siteUrl}/speaker`,
    shareUrl: ambassadorShareUrl(siteUrl, shareSlug),
    dashboardUrl: `${siteUrl}/ambassador`,
    setPasswordUrl: await generateSetPasswordLink(email),
    compLine,
    discountLines: emailDiscountLines,
    personalLine,
  };

  let emailSent = false;
  try {
    const html = await render(HostInviteEmail(props));
    await sendTransactionalEmail({
      to: email,
      subject: "You're hosting a workshop at IGNITE! 27",
      html,
      text: renderHostInvitePlainText(props),
      tag: "host-invite",
    });
    emailSent = true;
  } catch (err) {
    console.error("[host-invite] email send failed:", err);
  }

  return { emailSent, ambassadorReady: ambassador.ready, codeReady };
}
