import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import {
  buildCouponParams,
  buildPromotionCodeParams,
  CODE_RESTRICTIONS,
} from "@/lib/admin/stripe-codes";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// One-off scope fix for auto-provisioned ambassador codes (hosts and
// partner contacts): early ones were created applying to "everything
// except lunch", which wrongly discounted exhibitor stands. Stripe
// coupons are immutable, so the fix per code is: deactivate the old
// promotion code, mint a fresh coupon restricted to attendee tickets
// (delegate + VIP), and recreate the SAME code string on it. Links
// and emails keep working because they only ever carry the code
// string. times_redeemed restarts on the new object; these codes are
// uncapped, so nothing is lost.
//
// The list of auto codes IS ambassadors.promo_code: only the
// provisioners write that column. Codes already scoped to attendee
// tickets are skipped, so this is safe to run repeatedly.
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/fix-auto-code-scope', { method: 'POST' }).then(r => r.json()).then(console.log)

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const stripe = getStripe();

  const { data, error } = await service
    .from("ambassadors")
    .select("slug, promo_code, discount_percent")
    .not("promo_code", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as Array<{
    slug: string;
    promo_code: string;
    discount_percent: number | null;
  }>;

  const wanted = [...CODE_RESTRICTIONS.attendee_tickets.products].sort().join(",");
  const fixed: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const row of rows) {
    try {
      const { data: codes } = await stripe.promotionCodes.list({
        code: row.promo_code,
        active: true,
        limit: 1,
      });
      const promo = codes[0];
      if (!promo) {
        skipped.push(`${row.promo_code} (no active code in Stripe)`);
        continue;
      }
      const coupon =
        typeof promo.coupon === "string"
          ? await stripe.coupons.retrieve(promo.coupon)
          : promo.coupon;
      const current = (coupon.applies_to?.products ?? []).slice().sort().join(",");
      if (current === wanted) {
        skipped.push(`${row.promo_code} (already attendee tickets)`);
        continue;
      }

      await stripe.promotionCodes.update(promo.id, { active: false });
      const percent = coupon.percent_off ?? row.discount_percent ?? 20;
      const newCoupon = await stripe.coupons.create(
        buildCouponParams({
          code: row.promo_code,
          kind: "percent",
          percentOff: percent,
          appliesTo: "attendee_tickets",
          note: `scope fix for ${row.slug}`,
        }),
      );
      await stripe.promotionCodes.create(
        buildPromotionCodeParams(
          newCoupon.id,
          { code: row.promo_code, kind: "percent", percentOff: percent },
          "scope-fix",
        ),
      );
      fixed.push(row.promo_code);
    } catch (err) {
      console.error(`[fix-auto-code-scope] ${row.promo_code} failed:`, err);
      failed.push(row.promo_code);
    }
  }

  await logAdminAction(ctx.appUserId, "codes.scope_fix", {
    fixed: fixed.length,
    skipped: skipped.length,
    failed: failed.length,
  });

  return NextResponse.json({
    fixed,
    skipped,
    failed,
    note: "Fixed codes keep their code string; the old everything-except-lunch coupon is retired with its promotion code deactivated. Safe to re-run.",
  });
}
