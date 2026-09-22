import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import {
  ExhibitorPageInviteEmail,
  renderExhibitorPageInvitePlainText,
  type ExhibitorPageInviteProps,
} from "@/emails/exhibitor-page-invite";
import { logAdminAction } from "@/lib/admin/audit";
import { resolveAdminContext } from "@/lib/admin/guard";
import { ensureExhibitorProfile } from "@/lib/exhibitors/create-profile";
import {
  attendeeFallbacks,
  isLivePaidSession,
  resolveExhibitorDisplayName,
} from "@/lib/exhibitors/listing";
import { env } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
// Sequential creation + emails across every exhibitor booking.
export const maxDuration = 300;

interface BackfillRow {
  id: string;
  booking_reference: string | null;
  company_name: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_website: string | null;
  payment_status: string;
  booking_status: string;
  stripe_checkout_session_id: string | null;
  listing_hidden_at: string | null;
  exhibitor_requirements: {
    signage_name: string | null;
    logo_path: string | null;
    website_url: string | null;
  } | null;
  booking_attendees: ReadonlyArray<{
    first_name: string;
    surname: string;
    company: string | null;
    attendee_index: number;
  }>;
}

// One-off catch-up for exhibitor bookings that predate profile pages:
// creates a page for every completed booking (paid live or comp,
// active) that has none, then emails the invite to EXACTLY the rows
// created in this run. Safe to run repeatedly: existing profiles
// short-circuit inside ensureExhibitorProfile, and no invite goes out
// for a row that already existed, so a re-run cannot double-email.
//
// Legacy details carried over: an existing requirements row donates its
// logo and website, and a booking the admin had HIDDEN under the old
// listing model gets its page created unpublished so the hide survives
// the switch.
//
// HOW TO RUN (once, right after this deploys): sign in as a super
// admin, then from the browser console on any /admin page run
//   fetch('/admin/exhibitor-pages-backfill', { method: 'POST' }).then(r => r.json()).then(console.log)
// The JSON response reports the counts, and the run is written to
// admin_audit as 'exhibitor.pages_backfill'.
export async function POST(): Promise<Response> {
  const authClient = await createSupabaseServerClient();
  const ctx = await resolveAdminContext(authClient);
  if (!ctx) return new Response("Not found", { status: 404 });

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("bookings")
    .select(
      `id, booking_reference, company_name, company_contact_name,
       company_contact_email, company_website, payment_status,
       booking_status, stripe_checkout_session_id, listing_hidden_at,
       exhibitor_requirements ( signage_name, logo_path, website_url ),
       booking_attendees ( first_name, surname, company, attendee_index )`,
    )
    .eq("booking_type", "exhibitor")
    .order("created_at", { ascending: true });
  if (error) {
    return new Response(`bookings query failed: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as unknown as BackfillRow[];
  const siteUrl = env.siteUrl().replace(/\/$/, "");

  let created = 0;
  let alreadyHad = 0;
  const ineligible: string[] = [];
  const noName: string[] = [];
  let invitesSent = 0;
  let inviteFailures = 0;
  let createdUnpublished = 0;

  for (const b of rows) {
    const ref = b.booking_reference ?? b.id;

    // Same completed-booking gate as the public site has always used:
    // active, and either a comp or a paid LIVE session. Test-mode rows
    // from before the live-key swap never get public pages.
    const eligible =
      b.booking_status === "active" &&
      (b.payment_status === "comp" ||
        (b.payment_status === "paid" && isLivePaidSession(b.stripe_checkout_session_id)));
    if (!eligible) {
      ineligible.push(ref);
      continue;
    }

    const fallback = attendeeFallbacks(b.booking_attendees);
    const name = resolveExhibitorDisplayName({
      signageName: b.exhibitor_requirements?.signage_name ?? null,
      companyName: b.company_name,
      attendeeCompany: fallback.attendeeCompany,
      contactName: b.company_contact_name ?? fallback.attendeeName,
    });

    const startUnpublished = b.listing_hidden_at !== null;
    const result = await ensureExhibitorProfile(service, {
      bookingId: b.id,
      companyName: name || null,
      fallbackName: null,
      contactEmail: b.company_contact_email,
      logoPath: b.exhibitor_requirements?.logo_path ?? null,
      websiteUrl: b.exhibitor_requirements?.website_url ?? b.company_website,
      startUnpublished,
    });

    if (!result.created) {
      if (result.slug === null) noName.push(ref);
      else alreadyHad += 1;
      continue;
    }

    created += 1;
    if (startUnpublished) createdUnpublished += 1;

    // Invite email, only for rows created in THIS run, and only when we
    // hold a contact email. Never for pages created unpublished (the
    // admin hid that exhibitor deliberately; do not invite them to a
    // page that 404s). Failures count but never stop the run.
    if (!b.company_contact_email || startUnpublished) continue;
    try {
      const props: ExhibitorPageInviteProps = {
        firstName: (b.company_contact_name ?? "").split(" ")[0] || "there",
        companyName: name,
        pageUrl: `${siteUrl}/exhibitors/${result.slug}`,
        editUrl: `${siteUrl}/account/booking/${b.id}/profile`,
      };
      const html = await render(ExhibitorPageInviteEmail(props));
      await sendTransactionalEmail({
        to: b.company_contact_email,
        subject: "Your IGNITE! 27 exhibitor page is live",
        html,
        text: renderExhibitorPageInvitePlainText(props),
        tag: "exhibitor-page-invite",
      });
      invitesSent += 1;
    } catch (err) {
      inviteFailures += 1;
      console.error(`[exhibitor-pages] invite email failed for ${ref}:`, err);
    }
  }

  await logAdminAction(ctx.appUserId, "exhibitor.pages_backfill", {
    total_bookings: rows.length,
    created,
    created_unpublished: createdUnpublished,
    already_had_page: alreadyHad,
    ineligible: ineligible.length,
    no_name: noName.length,
    invites_sent: invitesSent,
    invite_failures: inviteFailures,
  });

  return NextResponse.json({
    totalBookings: rows.length,
    created,
    createdUnpublished,
    alreadyHadPage: alreadyHad,
    ineligible,
    noUsableName: noName,
    invitesSent,
    inviteFailures,
    note:
      "Safe to re-run: existing pages are skipped and invites only go to pages created in the same run. Dev/staging sends are still allowlist-gated.",
  });
}
