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
