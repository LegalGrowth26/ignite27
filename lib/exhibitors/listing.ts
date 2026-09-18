import { isTbcAttendeeName } from "@/lib/bookings/exhibitor-intent";
import { env } from "@/lib/env";

// Shared exhibitor helpers. The bookings-derived public listing that
// used to live here is gone: exhibitor_profiles is now the single
// source for the /exhibit strip, the /exhibitors index, and the
// /exhibitors/<slug> pages (published profile = listed). What remains
// is the display-name fallback chain and the completed-live-payment
// gate, used by the admin page, the profile backfill, and the profile
// editor's self-heal path.

// A LIVE-mode Checkout session id (cs_live_...). Test-mode bookings
// created before the live-key swap must never earn a public page.
export function isLivePaidSession(sessionId: string | null): boolean {
  return typeof sessionId === "string" && sessionId.startsWith("cs_live_");
}

export interface ExhibitorNameSources {
  signageName: string | null; // exhibitor_requirements.signage_name, curated
  companyName: string | null; // bookings.company_name, captured at checkout
  attendeeCompany: string | null; // booking_attendees.company (attendee 1)
  contactName: string | null; // bookings.company_contact_name or attendee 1's name
}

// Display-name fallback chain, shared by the admin exhibitors page and
// the profile backfill. Order: the exhibitor's own signage name
// (curated, submitted later) -> the company name captured on the
// booking -> the company on the first attendee row (bookings made
// before the webhook populated the company_* columns have it only
// here) -> the booking contact's name as a last resort. A paid
// exhibitor with no requirements row and a null company_name must
// still resolve to SOMETHING.
export function resolveExhibitorDisplayName(r: ExhibitorNameSources): string {
  return (
    r.signageName?.trim() ||
    r.companyName?.trim() ||
    r.attendeeCompany?.trim() ||
    r.contactName?.trim() ||
    ""
  );
}

// Public listings read logos ONLY from the public bucket
// (exhibitor-logos-public). The requirements save action copies the
// uploaded file private -> public at save time (and the admin
// unpublish/republish actions remove / restore the public copy), so no
// private-bucket access ever happens on the public site.
export function publicLogoUrl(logoPath: string): string {
  return `${env.supabaseUrl()}/storage/v1/object/public/exhibitor-logos-public/${logoPath}`;
}

export interface AttendeeNameRow {
  first_name: string;
  surname: string;
  company: string | null;
  attendee_index: number;
}

// First attendee (by index) carries the company/name fallbacks for
// bookings that predate the company_* columns being populated.
export function attendeeFallbacks(
  attendees: ReadonlyArray<AttendeeNameRow>,
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
