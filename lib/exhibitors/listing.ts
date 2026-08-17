import type { SupabaseClient } from "@supabase/supabase-js";
import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";
import { env } from "@/lib/env";

// Public exhibitor listing for /exhibit.
//
// Model (Aug 2026 decision, replaces admin approval): any exhibitor
// booking with a successful LIVE payment is listed automatically, on
// company name alone until a logo or website is submitted via the
// requirements form. Admins can pull a listing down with the hide
// toggle (bookings.listing_hidden_at); hidden rows stay in the
// database untouched.
//
// The filter is deliberately strict about what "a successful live
// payment" means:
//   - payment_status 'paid' only. 'pending' and abandoned checkouts
//     never appear; 'comp' (100%-off) stands are excluded too because
//     no payment happened (flagged in the PR; easy to include later).
//   - the Stripe Checkout session id must be a LIVE-mode id
//     (cs_live_...). Test-mode bookings created before the live-key
//     swap can never leak onto the public site.
//   - booking_status 'active' (cancelled bookings drop off).

export interface ExhibitorListingSourceRow {
  bookingId: string;
  companyName: string | null; // bookings.company_name, captured at checkout
  signageName: string | null; // exhibitor_requirements.signage_name, curated later
  attendeeCompany: string | null; // booking_attendees.company (attendee 1)
  contactName: string | null; // bookings.company_contact_name or attendee 1's name
  websiteUrl: string | null;
  logoPath: string | null; // object path in the PRIVATE exhibitor-logos bucket
  paymentStatus: string;
  bookingStatus: string;
  stripeCheckoutSessionId: string | null;
  listingHiddenAt: string | null;
}

export interface ExhibitorListingEntry {
  bookingId: string;
  displayName: string;
  websiteUrl: string | null;
  logoPath: string | null;
}

export function isLivePaidSession(sessionId: string | null): boolean {
  return typeof sessionId === "string" && sessionId.startsWith("cs_live_");
}

// Display-name fallback chain, shared by the public listing, the admin
// exhibitors page, and the CSV export. Order: the exhibitor's own
// signage name (curated, submitted later) -> the company name captured
// on the booking -> the company on the first attendee row (bookings
// made before the webhook populated the company_* columns have it only
// here) -> the booking contact's name as a last resort. A paid
// exhibitor with no requirements row and a null company_name must still
// resolve to SOMETHING.
export function resolveExhibitorDisplayName(
  r: Pick<
    ExhibitorListingSourceRow,
    "signageName" | "companyName" | "attendeeCompany" | "contactName"
  >,
): string {
  return (
    r.signageName?.trim() ||
    r.companyName?.trim() ||
    r.attendeeCompany?.trim() ||
    r.contactName?.trim() ||
    ""
  );
}

// Pure listing rule, unit-tested in listing.test.ts.
export function buildExhibitorListing(
  rows: readonly ExhibitorListingSourceRow[],
): ExhibitorListingEntry[] {
  return rows
    .filter(
      (r) =>
        r.paymentStatus === "paid" &&
        r.bookingStatus === "active" &&
        isLivePaidSession(r.stripeCheckoutSessionId) &&
        r.listingHiddenAt === null,
    )
    .map((r) => ({
      bookingId: r.bookingId,
      displayName: resolveExhibitorDisplayName(r),
      websiteUrl: r.websiteUrl,
      logoPath: r.logoPath,
    }))
    .filter((e) => e.displayName.length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "en-GB"));
}

export interface RenderableExhibitorListing extends ExhibitorListingEntry {
  logoUrl: string | null; // public-bucket URL; never the private bucket
}

// Public listings read logos ONLY from the public bucket
// (exhibitor-logos-public). The requirements save action copies the
// uploaded file private -> public at save time (and the admin hide
// toggle removes / restores the public copy), so no private-bucket
// access ever happens on the public site.
export function publicLogoUrl(logoPath: string): string {
  return `${env.supabaseUrl()}/storage/v1/object/public/exhibitor-logos-public/${logoPath}`;
}

interface RawBookingRow {
  id: string;
  company_name: string | null;
  company_contact_name: string | null;
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

// First attendee (by index) carries the company/name fallbacks for
// bookings that predate the company_* columns being populated.
export function attendeeFallbacks(
  attendees: RawBookingRow["booking_attendees"],
): { attendeeCompany: string | null; attendeeName: string | null } {
  const first = [...(attendees ?? [])].sort(
    (a, b) => a.attendee_index - b.attendee_index,
  )[0];
  if (!first) return { attendeeCompany: null, attendeeName: null };
  return {
    attendeeCompany: first.company,
    // A TBC placeholder must never become a display name.
    attendeeName: isTbcAttendeeName(first.first_name, first.surname)
      ? null
      : `${first.first_name} ${first.surname}`.trim() || null,
  };
}

// Server-side fetch for the public listing. Runs on the SERVICE client
// for the bookings read only: anonymous visitors have no RLS read on
// bookings, and the only fields exposed are the ones the exhibitor
// intends to be public (name, logo, website). Logo URLs point at the
// PUBLIC bucket, which the save/hide flows keep in sync.
export async function fetchExhibitorListing(
  client: SupabaseClient,
): Promise<RenderableExhibitorListing[]> {
  const { data, error } = await client
    .from("bookings")
    .select(
      `id, company_name, company_contact_name, company_website,
       payment_status, booking_status,
       stripe_checkout_session_id, listing_hidden_at,
       exhibitor_requirements ( signage_name, logo_path, website_url ),
       booking_attendees ( first_name, surname, company, attendee_index )`,
    )
    .eq("booking_type", "exhibitor");
  if (error) {
    throw new Error(`exhibitor listing query failed: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as RawBookingRow[]).map(
    (r): ExhibitorListingSourceRow => {
      const fallback = attendeeFallbacks(r.booking_attendees);
      return {
        bookingId: r.id,
        companyName: r.company_name,
        signageName: r.exhibitor_requirements?.signage_name ?? null,
        attendeeCompany: fallback.attendeeCompany,
        contactName: r.company_contact_name ?? fallback.attendeeName,
        websiteUrl: r.exhibitor_requirements?.website_url ?? r.company_website,
        logoPath: r.exhibitor_requirements?.logo_path ?? null,
        paymentStatus: r.payment_status,
        bookingStatus: r.booking_status,
        stripeCheckoutSessionId: r.stripe_checkout_session_id,
        listingHiddenAt: r.listing_hidden_at,
      };
    },
  );

  return buildExhibitorListing(rows).map((e) => ({
    ...e,
    logoUrl: e.logoPath ? publicLogoUrl(e.logoPath) : null,
  }));
}
