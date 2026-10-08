import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ensureAmbassadorPromoCode } from "@/lib/ambassadors/ensure-code";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// One-off backfill: every ambassador holding a discount_percent but
// no live personal code (the pre-provisioning "phase 2" rows) gets
// their code minted with the standard provisioning (attendee tickets
// only, no cap, no expiry) and recorded on the row. The response
// names who they were. Safe to run repeatedly: rows with a code are
// skipped by the ensure.
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/ambassador-codes-backfill', { method: 'POST' }).then(r => r.json()).then(console.log)

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("ambassadors")
    .select("id, slug, display_name, discount_percent, promo_code")
    .not("discount_percent", "is", null)
    .is("promo_code", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    discount_percent: number | null;
    promo_code: string | null;
  }>;

  const provisioned: Array<{ name: string; slug: string; code: string }> = [];
  const failed: Array<{ name: string; slug: string }> = [];
  for (const row of rows) {
    const code = await ensureAmbassadorPromoCode(service, row);
    if (code) {
      provisioned.push({ name: row.display_name, slug: row.slug, code });
    } else {
      failed.push({ name: row.display_name, slug: row.slug });
    }
  }

  await logAdminAction(ctx.appUserId, "ambassador.codes_backfill", {
    provisioned: provisioned.length,
    failed: failed.length,
  });

  return NextResponse.json({
    provisioned,
    failed,
    note:
      provisioned.length === 0 && failed.length === 0
        ? "Nothing to do: every ambassador with a percentage already has a live code."
        : "Codes above are live now (delegate and VIP tickets only) and will appear on dashboards and in resent welcome emails. Safe to re-run.",
  });
}
