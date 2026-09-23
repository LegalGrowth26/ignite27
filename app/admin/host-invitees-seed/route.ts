import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ensureSpeakerProfile } from "@/lib/speakers/create-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// One-off seed for the workshop host invite list (names verified:
// Linfoot not Linford, Dan's surname is Ince). Each becomes a DRAFT
// invitee: an unpublished, account-less workshop_host profile with the
// focus recorded as an internal note. Tom attaches emails from
// /admin/workshops when ready, which sends the full invite (account,
// live page, 2 comps, 20% code).
//
// Safe to run repeatedly: existing slugs are skipped.
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/host-invitees-seed', { method: 'POST' }).then(r => r.json()).then(console.log)

const SEED_HOSTS: ReadonlyArray<{ name: string; slug: string; focus: string }> = [
  { name: "Dan Ince", slug: "dan-ince", focus: "LinkedIn" },
  { name: "Scott Linfoot", slug: "scott-linfoot", focus: "AI" },
  {
    name: "Mike Wistow",
    slug: "mike-wistow",
    focus:
      "Structured problem solving: seeing the wood for the trees (Wood For The Trees partnership, Aegir Consulting)",
  },
  { name: "Chris England", slug: "chris-england", focus: "Video" },
  { name: "Elsie Green", slug: "elsie-green", focus: "Network building" },
  { name: "Aaron Hutchinson", slug: "aaron-hutchinson", focus: "Sales" },
];

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  let created = 0;
  const skipped: string[] = [];

  for (const seed of SEED_HOSTS) {
    const { data: existing } = await service
      .from("speaker_profiles")
      .select("id")
      .eq("slug", seed.slug)
      .maybeSingle();
    if (existing) {
      skipped.push(seed.slug);
      continue;
    }
    await ensureSpeakerProfile(service, {
      displayName: seed.name,
      talkTitle: seed.focus,
      profileType: "workshop_host",
      startUnpublished: true,
    });
    created += 1;
  }

  await logAdminAction(ctx.appUserId, "host.invitees_seed", {
    created,
    skipped: skipped.length,
  });

  return NextResponse.json({
    created,
    skippedExisting: skipped,
    note:
      "Draft invitees are unpublished and account-less. Attach each host's email from /admin/workshops to send the invite; nothing goes out until then. Safe to re-run.",
  });
}
