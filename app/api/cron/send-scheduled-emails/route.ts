import { NextResponse } from "next/server";
import { processScheduledEmails } from "@/lib/event-emails/process";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Sequential throttled sends: up to 200 per tick at ~1.6/s.
export const maxDuration = 300;

// Vercel Cron target (vercel.json schedules it every 5 minutes).
// Vercel calls with Authorization: Bearer ${CRON_SECRET}; anything
// else is a 401. The GitHub Actions fallback documented in the PR
// curls this same route with the same secret, so switching schedulers
// is configuration only.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 401 });
  }

  try {
    const summary = await processScheduledEmails(createSupabaseServiceClient());
    if (summary.claimed || summary.sent || summary.failed) {
      console.info(
        `[event-emails] tick: claimed=${summary.claimed} sent=${summary.sent} failed=${summary.failed} completed=${summary.completedEmails}`,
      );
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[event-emails] tick failed:", err);
    return new NextResponse("tick failed", { status: 500 });
  }
}
