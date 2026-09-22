import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { env } from "@/lib/env";
import { ensureSpeakerProfile } from "@/lib/speakers/create-profile";
import { publishSpeakerPhotoCopy } from "@/lib/speakers/photo";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// One-off seed for the three speakers announced before self-managed
// pages existed, using the content the site already shows (name, topic
// as talk title, and the headshot from /public/images/speakers/,
// fetched over HTTP from the deployed site and copied into the photo
// buckets). Pages are created ACCOUNT-LESS and published; attach each
// speaker's email from /admin/speakers when you have it, which creates
// their login and sends the invite.
//
// Safe to run repeatedly: a speaker whose slug already exists is
// skipped entirely (nothing re-seeded, nothing re-sent).
//
// HOW TO RUN (once, after this deploys): sign in as a super admin,
// then from the browser console on any /admin page run
//   fetch('/admin/speaker-pages-backfill', { method: 'POST' }).then(r => r.json()).then(console.log)

const SEED_SPEAKERS: ReadonlyArray<{
  name: string;
  slug: string; // what slugifyCompany(name) mints; pinned for the skip check
  talkTitle: string;
  photoFile: string;
}> = [
  {
    name: "Stephine Robinson",
    slug: "stephine-robinson",
    talkTitle: "Practical AI for small businesses",
    photoFile: "stephine-robinson.webp",
  },
  {
    name: "Nathan Littleton",
    slug: "nathan-littleton",
    talkTitle: "Email marketing that wins customers",
    photoFile: "nathan-littleton.webp",
  },
  {
    name: "Mark Saxby",
    slug: "mark-saxby",
    talkTitle: "Social media that actually works",
    photoFile: "mark-saxby.webp",
  },
];

export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  let created = 0;
  const skipped: string[] = [];
  const photoFailures: string[] = [];

  for (const seed of SEED_SPEAKERS) {
    const { data: existing } = await service
      .from("speaker_profiles")
      .select("id")
      .eq("slug", seed.slug)
      .maybeSingle();
    if (existing) {
      skipped.push(seed.slug);
      continue;
    }

    const result = await ensureSpeakerProfile(service, {
      displayName: seed.name,
      talkTitle: seed.talkTitle,
    });
    created += 1;

    // Copy the existing site headshot into the photo pipeline: fetch
    // from the deployed static asset, upload to the private bucket,
    // publish the public copy. A photo failure never fails the seed;
    // the card falls back to initials and the speaker (or admin) can
    // upload a fresh one.
    try {
      const response = await fetch(`${siteUrl}/images/speakers/${seed.photoFile}`);
      if (!response.ok) throw new Error(`asset fetch ${response.status}`);
      const bytes = await response.arrayBuffer();
      const photoPath = `${result.profileId}/photo.webp`;
      const { error: uploadErr } = await service.storage
        .from("speaker-photos")
        .upload(photoPath, bytes, { upsert: true, contentType: "image/webp" });
      if (uploadErr) throw new Error(uploadErr.message);
      const { error: copyErr } = await publishSpeakerPhotoCopy(service, photoPath);
      if (copyErr) throw new Error(copyErr);
      const { error: linkErr } = await service
        .from("speaker_profiles")
        .update({ photo_path: photoPath })
        .eq("id", result.profileId);
      if (linkErr) throw new Error(linkErr.message);
    } catch (err) {
      photoFailures.push(seed.slug);
      console.error(`[speaker-backfill] photo seed failed for ${seed.slug}:`, err);
    }
  }

  await logAdminAction(ctx.appUserId, "speaker.pages_backfill", {
    created,
    skipped: skipped.length,
    photo_failures: photoFailures.length,
  });

  return NextResponse.json({
    created,
    skippedExisting: skipped,
    photoFailures,
    note:
      "Pages are live and ACCOUNT-LESS: attach each speaker's email from /admin/speakers to create their login and send the invite. Safe to re-run; existing slugs are skipped.",
  });
}
