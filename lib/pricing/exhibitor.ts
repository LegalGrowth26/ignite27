// EXHIBITOR_STAND_CAP: total number of exhibitor stands available for
// sale across all periods. Only PAID exhibitor bookings count toward
// the cap; abandoned Stripe checkouts do not.
//
// Value is TBC. 20 is a placeholder; when Tom confirms the number,
// update it here AND update SPEC.md. Prefer a code-tracked constant
// over an env var because this must be identical across dev and prod
// (an env-var drift would silently allow overselling), and because
// changing it is a one-line commit with clear history.
export const EXHIBITOR_STAND_CAP = 20;

export function exhibitorStandsRemaining(currentPaidExhibitorCount: number): number {
  return Math.max(0, EXHIBITOR_STAND_CAP - currentPaidExhibitorCount);
}

export function isExhibitorAvailable(currentPaidExhibitorCount: number): boolean {
  return currentPaidExhibitorCount < EXHIBITOR_STAND_CAP;
}
