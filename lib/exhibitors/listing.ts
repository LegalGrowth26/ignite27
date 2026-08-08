import type { SupabaseClient } from "@supabase/supabase-js";
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

// Pure listing rule, unit-tested in listing.test.ts. Prefer the
// exhibitor's own signage name once submitted; fall back to the company
// name captured at checkout, so a fresh booking lists on name alone
// with no admin action and no requirements submission.
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
      displayName: (r.signageName?.trim() || r.companyName?.trim()) ?? "",
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
      `id, company_name, company_website, payment_status, booking_status,
       stripe_checkout_session_id, listing_hidden_at,
       exhibitor_requirements ( signage_name, logo_path, website_url )`,
    )
    .eq("booking_type", "exhibitor");
  if (error) {
    throw new Error(`exhibitor listing query failed: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as RawBookingRow[]).map(
    (r): ExhibitorListingSourceRow => ({
      bookingId: r.id,
      companyName: r.company_name,
      signageName: r.exhibitor_requirements?.signage_name ?? null,
      websiteUrl: r.exhibitor_requirements?.website_url ?? r.company_website,
      logoPath: r.exhibitor_requirements?.logo_path ?? null,
      paymentStatus: r.payment_status,
      bookingStatus: r.booking_status,
      stripeCheckoutSessionId: r.stripe_checkout_session_id,
      listingHiddenAt: r.listing_hidden_at,
    }),
  );

  return buildExhibitorListing(rows).map((e) => ({
    ...e,
    logoUrl: e.logoPath ? publicLogoUrl(e.logoPath) : null,
  }));
}
