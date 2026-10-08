import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import {
  SimpleTextEmail,
  renderSimpleTextPlain,
  type SimpleTextEmailProps,
} from "@/emails/simple-text";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ambassadorShareUrl } from "@/lib/ambassadors/attribution";
import {
  REMINDER_SUBJECT,
  reminderParagraphs,
} from "@/lib/ambassadors/reminder";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-off ambassador reminder with a HARD preview gate: nothing sends
// until a super admin has seen the exact recipients and words.
//
//   1. PREVIEW (default): returns every active ambassador it would
//      email, with name, address, code, link, guest-ticket position,
//      and the full text of their email. Sends nothing.
//   2. SEND: pass { "confirm": "send" } to actually dispatch, one
//      email per ambassador, via the standard choke point (from
//      IGNITE! 27 <tom@lincolnshiremarketing.co.uk>, allowlist
//      enforced outside production).
//
// Deactivated ambassadors are excluded by the query itself.
//
// HOW TO RUN (signed in as a super admin, browser console on /admin):
//   preview:  fetch('/admin/ambassador-reminder', { method: 'POST' }).then(r => r.json()).then(console.log)
//   send:     fetch('/admin/ambassador-reminder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'send' }) }).then(r => r.json()).then(console.log)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  let confirm = "";
  try {
    const body = (await request.json()) as { confirm?: string };
    confirm = body?.confirm ?? "";
  } catch {
    // No body = preview.
  }
  const sending = confirm === "send";

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("ambassadors")
    .select(
      "id, slug, display_name, comp_allowance, discount_percent, promo_code, users ( email )",
    )
    .is("deactivated_at", null)
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: string;
    slug: string;
    display_name: string;
    comp_allowance: number;
    discount_percent: number | null;
    promo_code: string | null;
    users: { email: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const { data: compData } = await service
    .from("ambassador_comps")
    .select("ambassador_id");
  const usedByAmbassador = new Map<string, number>();
  for (const c of (compData ?? []) as Array<{ ambassador_id: string }>) {
    usedByAmbassador.set(c.ambassador_id, (usedByAmbassador.get(c.ambassador_id) ?? 0) + 1);
  }

  const siteUrl = env.siteUrl().replace(/\/$/, "");
  const recipients = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const email = row.users?.email;
    if (!email) {
      skipped.push(`${row.display_name} (no account email)`);
      continue;
    }
    const paragraphs = reminderParagraphs({
      firstName: row.display_name.split(/\s+/)[0] ?? row.display_name,
      promoCode: row.promo_code,
      discountPercent: row.discount_percent,
      shareUrl: ambassadorShareUrl(siteUrl, row.slug),
      compAllowance: row.comp_allowance,
      compsUsed: usedByAmbassador.get(row.id) ?? 0,
    });
    recipients.push({
      name: row.display_name,
      email,
      code: row.promo_code,
      shareUrl: ambassadorShareUrl(siteUrl, row.slug),
      guestTickets: `${usedByAmbassador.get(row.id) ?? 0} of ${row.comp_allowance} used`,
      subject: REMINDER_SUBJECT,
      body: paragraphs.join("\n\n"),
      paragraphs,
    });
  }

  if (!sending) {
    return NextResponse.json({
      mode: "preview",
      wouldSend: recipients.length,
      recipients,
      skipped,
      note: "NOTHING has been sent. Review the names and words above, then re-run with { \"confirm\": \"send\" } to dispatch.",
    });
  }

  const sent: string[] = [];
  const failed: string[] = [];
  for (const r of recipients) {
    const props: SimpleTextEmailProps = {
      previewText: "Your code, your link, and where your guest tickets stand.",
      heading: "Your IGNITE! 27 ambassador kit.",
      paragraphs: r.paragraphs,
    };
    try {
      await sendTransactionalEmail({
        to: r.email,
        subject: r.subject,
        html: await render(SimpleTextEmail(props)),
        text: renderSimpleTextPlain(props),
        tag: "ambassador-reminder",
      });
      sent.push(`${r.name} <${r.email}>`);
    } catch (err) {
      console.error(`[ambassador-reminder] send failed for ${r.name}:`, err);
      failed.push(`${r.name} <${r.email}>`);
    }
    await sleep(600);
  }

  await logAdminAction(ctx.appUserId, "ambassador.reminder_send", {
    sent: sent.length,
    failed: failed.length,
  });

  return NextResponse.json({ mode: "sent", sent, failed, skipped });
}
