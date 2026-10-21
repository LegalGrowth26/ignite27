import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ensureSpeakerProfile } from "@/lib/speakers/create-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// One-off seed for the workshop host invite list (names verified:
// Linfoot not Linford, Dan's surname is Ince). Each becomes a DRAFT
// invitee: an unpublished, account-less workshop_host profile, name
// only. Everything about the workshop (title, description, takeaways)
// is the host's to write in their editor, so the agreed focus areas
// live here as comments for reference, not as stored content:
//   Dan Ince: LinkedIn · Scott Linfoot: AI · Mike Wistow: structured
//   problem solving, seeing the wood for the trees (Wood For The
//   Trees partnership, Aegir Consulting) · Chris England: video ·
//   Elsie Green: network building · Aaron Hutchinson: sales.
// Tom attaches emails from /admin/workshops when ready, which sends
// the full invite (account, live page, 2 comps, 20% code).
//
// Safe to run repeatedly: existing slugs are skipped, and each host
// is created independently: one bad row reports itself in `failed`
// and the loop carries on (the original all-or-nothing loop aborted
// on the first failure, which is how a broken window left three of
// the six uncreated with no trace: no audit row was ever written).
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/host-invitees-seed', { method: 'POST' }).then(r => r.json()).then(console.log)

const SEED_HOSTS: ReadonlyArray<{ name: string; slug: string }> = [
  { name: "Dan Ince", slug: "dan-ince" },
  { name: "Scott Linfoot", slug: "scott-linfoot" },
  { name: "Mike Wistow", slug: "mike-wistow" },
  { name: "Chris England", slug: "chris-england" },
  { name: "Elsie Green", slug: "elsie-green" },
  { name: "Aaron Hutchinson", slug: "aaron-hutchinson" },
];

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ slug: string; reason: string }> = [];

  for (const seed of SEED_HOSTS) {
    try {
      const { data: existing, error: lookupErr } = await service
        .from("speaker_profiles")
        .select("id")
        .eq("slug", seed.slug)
        .maybeSingle();
      if (lookupErr) throw new Error(`lookup failed: ${lookupErr.message}`);
      if (existing) {
        skipped.push(seed.slug);
        continue;
      }
      await ensureSpeakerProfile(service, {
        displayName: seed.name,
        talkTitle: "",
        profileType: "workshop_host",
        startUnpublished: true,
      });
      created.push(seed.slug);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      console.error(`[host-invitees-seed] ${seed.slug} failed (continuing):`, reason);
      failed.push({ slug: seed.slug, reason });
    }
  }

  await logAdminAction(ctx.appUserId, "host.invitees_seed", {
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    created_slugs: created,
    failed_slugs: failed.map((f) => f.slug),
  });

  return NextResponse.json({
    created,
    skippedExisting: skipped,
    failed,
    note:
      "Draft invitees are unpublished and account-less. Attach each host's email from /admin/workshops to send the invite; nothing goes out until then. Safe to re-run.",
  });
}
