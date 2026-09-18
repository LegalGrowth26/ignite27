import { NextResponse } from "next/server";
import { normaliseRefSlug } from "@/lib/ambassadors/attribution";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Click beacon for ambassador share links, fired non-blocking from the
// middleware on every ?ref= visit. Coarse by decision: every hit
// counts, no dedupe or bot filtering, and the counter only moves for
// slugs that exist and are active. Unknown slugs are a silent no-op so
// the endpoint reveals nothing about which slugs exist.
export async function POST(request: Request): Promise<Response> {
  let slug: string | null = null;
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = normaliseRefSlug(body.slug);
  } catch {
    // fall through to the 204 below
  }
  if (!slug) return new NextResponse(null, { status: 204 });

  const service = createSupabaseServiceClient();
  const { error } = await service.rpc("increment_ambassador_clicks", { p_slug: slug });
  if (error) {
    // Never let click counting look like a real failure to the caller;
    // the log line is enough to notice a broken counter.
    console.error("[ref-click] increment failed:", error.message);
  }
  return new NextResponse(null, { status: 204 });
}
