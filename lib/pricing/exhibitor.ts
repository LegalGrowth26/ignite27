// EXHIBITOR_STAND_CAP: total number of exhibitor stands available for
// sale across all periods. Only PAID exhibitor bookings count toward
// the cap; abandoned Stripe checkouts do not.
//
// Tracked as a code constant (not an env var) so it is identical
// across dev and prod — env-var drift would silently allow
// overselling. May be raised later.
export const EXHIBITOR_STAND_CAP = 50;

export function exhibitorStandsRemaining(currentPaidExhibitorCount: number): number {
  return Math.max(0, EXHIBITOR_STAND_CAP - currentPaidExhibitorCount);
}

export function isExhibitorAvailable(currentPaidExhibitorCount: number): boolean {
  return currentPaidExhibitorCount < EXHIBITOR_STAND_CAP;
}

// PUBLIC availability copy (September 2026 decision): the exact
// remaining-stands count is admin-only. The public sees urgency-neutral
// copy until real scarcity kicks in at LOW_STANDS_PUBLIC_THRESHOLD or
// fewer, when the true number is shown. Sold out is handled by the
// callers' existing sold-out states, not here (this function still
// answers sensibly at 0 for any surface that asks).
export const LOW_STANDS_PUBLIC_THRESHOLD = 10;

export function publicStandAvailabilityNote(standsRemaining: number): string {
  if (standsRemaining <= 0) return "All stands are taken.";
  if (standsRemaining <= LOW_STANDS_PUBLIC_THRESHOLD) {
    return standsRemaining === 1
      ? "Only 1 stand left."
      : `Only ${standsRemaining} stands left.`;
  }
  return "Stands are selling. Reserve yours.";
}
