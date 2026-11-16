import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ensurePercentCode, percentCodeFromSlug } from "@/lib/ambassadors/ensure-code";
import { sendAmbassadorWelcome } from "@/lib/ambassadors/send-invite";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// One-off spelling fix for Hannah Worrall's ambassador perks (her
// surname has two Ls; the row was created from the misspelled speaker
// slug before that was corrected). Confirmed before building: nothing
// else stores the ambassador slug. Bookings and comps reference
// ambassadors by uuid, the click counter and checkout ref_slug are
// live lookups against the CURRENT slug, and her claim token does not
// change. She has not shared the old code or link, so deactivating
// them loses no attribution.
//
// What one run does, in order, stopping loudly if a step fails:
//   1. slug hannah-worral -> hannah-worrall, display name corrected.
//   2. HANNAHWORRAL20 deactivated in Stripe (coupons are immutable, so
//      correction means retire and re-mint).
//   3. HANNAHWORRALL20 minted with the same settings: 20%, delegate
//      and VIP tickets only, no cap, no expiry. Recorded on her row.
//   4. Her invite is resent so the corrected code and share link reach
//      her inbox.
// Safe to re-run: each step skips itself when already done.
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/fix-hannah-ambassador', { method: 'POST' }).then(r => r.json()).then(console.log)

const OLD_SLUG = "hannah-worral";
const NEW_SLUG = "hannah-worrall";
const CORRECT_NAME = "Hannah Worrall";
const PERCENT = 20;
const OLD_CODE = "HANNAHWORRAL20";
const NEW_CODE = percentCodeFromSlug(NEW_SLUG, PERCENT); // HANNAHWORRALL20

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const stripe = getStripe();
  const steps: string[] = [];

  const fail = (reason: string) =>
    NextResponse.json({ steps, failed: reason }, { status: 500 });

  // Her row, under either spelling so a re-run picks up where it left
  // off.
  const { data: rows, error: lookupErr } = await service
    .from("ambassadors")
    .select("id, slug, display_name, promo_code, discount_percent")
    .in("slug", [OLD_SLUG, NEW_SLUG]);
  if (lookupErr) return fail(`ambassador lookup failed: ${lookupErr.message}`);
  const row = (rows ?? [])[0] as
    | { id: string; slug: string; display_name: string; promo_code: string | null; discount_percent: number | null }
    | undefined;
  if (!row) return fail(`no ambassador found under ${OLD_SLUG} or ${NEW_SLUG}`);
  if ((rows ?? []).length > 1) {
    return fail("both slugs exist as separate ambassadors; needs a human look before any change");
  }

  // 1. Slug and display name.
  if (row.slug === NEW_SLUG && row.display_name === CORRECT_NAME) {
    steps.push("slug and name already correct");
  } else {
    const { error: renameErr } = await service
      .from("ambassadors")
      .update({ slug: NEW_SLUG, display_name: CORRECT_NAME })
      .eq("id", row.id);
    if (renameErr) return fail(`rename failed: ${renameErr.message}`);
    steps.push(`renamed: ${row.slug} -> ${NEW_SLUG}, display name "${CORRECT_NAME}"`);
  }

  // 2. Retire the misspelled code. All active instances, belt and
  // braces; zero found just means it is already inactive or was never
  // minted.
  try {
    const { data: oldCodes } = await stripe.promotionCodes.list({
      code: OLD_CODE,
      active: true,
      limit: 10,
    });
    for (const promo of oldCodes) {
      await stripe.promotionCodes.update(promo.id, { active: false });
    }
    steps.push(
      oldCodes.length > 0
        ? `deactivated ${OLD_CODE} (${oldCodes.length} active instance${oldCodes.length === 1 ? "" : "s"})`
        : `${OLD_CODE} already inactive or never minted`,
    );
  } catch (err) {
    return fail(`deactivating ${OLD_CODE} failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // 3. Mint the corrected code: 20%, attendee tickets only (delegate +
  // VIP), uncapped, no expiry. ensurePercentCode reuses an existing
  // active code, so a re-run never duplicates.
  const minted = await ensurePercentCode(
    NEW_CODE,
    PERCENT,
    `spelling fix for ${NEW_SLUG}`,
    "name-fix",
  );
  if (!minted) {
    // Stop HERE: resending now would email her a deactivated code.
    return fail(
      `minting ${NEW_CODE} failed (see [ensure-code] log); her row still carries ${row.promo_code ?? "no code"}. Fix Stripe and re-run; the invite has NOT been resent.`,
    );
  }
  steps.push(`${NEW_CODE} ensured in Stripe (20%, delegate and VIP only, no cap, no expiry)`);

  if (row.promo_code !== NEW_CODE) {
    const { error: codeErr } = await service
      .from("ambassadors")
      .update({ promo_code: NEW_CODE })
      .eq("id", row.id);
    if (codeErr) return fail(`recording ${NEW_CODE} on her row failed: ${codeErr.message}`);
    steps.push(`row promo_code: ${row.promo_code ?? "none"} -> ${NEW_CODE}`);
  } else {
    steps.push("row promo_code already correct");
  }

  // 4. Resend her invite, now built from the corrected record. An
  // email failure does not undo the fix: the Resend invite button on
  // /admin/ambassadors retries with the same corrected content.
  let emailSent = false;
  try {
    await sendAmbassadorWelcome(service, row.id);
    emailSent = true;
    steps.push("invite resent with the corrected code and share link");
  } catch (err) {
    steps.push(
      `invite email FAILED: ${err instanceof Error ? err.message : "unknown"}. The fix itself stands; use Resend invite on /admin/ambassadors to retry.`,
    );
  }

  await logAdminAction(ctx.appUserId, "ambassador.spelling_fix", {
    ambassador_id: row.id,
    old_slug: OLD_SLUG,
    new_slug: NEW_SLUG,
    old_code: OLD_CODE,
    new_code: NEW_CODE,
    invite_resent: emailSent,
  });
  revalidatePath("/admin/ambassadors");
  revalidatePath("/ambassador");

  return NextResponse.json({
    steps,
    note: "Safe to re-run; completed steps skip themselves. Her claim link is untouched and keeps working.",
  });
}
