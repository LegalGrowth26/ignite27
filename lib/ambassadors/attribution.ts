// Share-link attribution for ambassadors. The public site accepts
// ?ref=<slug> on any page; middleware validates the shape and stores it
// in a cookie (last-touch: every valid visit overwrites). The checkout
// actions read the cookie into Stripe session metadata, and the webhook
// resolves the slug to an ACTIVE ambassador when the booking is
// written. Everything here is pure so both ends share one rule set.
//
// SPEC.md's phase-2 per-booker referral system is designed to reuse
// these exact rails.

export const REF_COOKIE_NAME = "i27_ref";
// Last-touch window: 90 days, by decision.
export const REF_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
// Metadata key on the Stripe Checkout session.
export const REF_METADATA_KEY = "ref_slug";

// Mirrors ambassadors_slug_chk in the migration: lowercase, 2-30 chars,
// a-z 0-9 and hyphens, starting alphanumeric.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,29}$/;

export function isValidRefSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

// Normalise raw user input (?ref=Stephine, trailing spaces, uppercase)
// into a valid slug or null. Never throws; garbage in, null out.
export function normaliseRefSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  return isValidRefSlug(slug) ? slug : null;
}

// The link shown on the ambassador dashboard.
export function ambassadorShareUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, "")}/?ref=${slug}`;
}
