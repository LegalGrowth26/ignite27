// Comp claim link: /claim/<token> lets a guest book their own free
// delegate ticket against an ambassador's allowance. Pure state logic
// here, unit-tested; the hard allowance enforcement lives in the
// issue_ambassador_comp database function (ambassador row locked, so
// two simultaneous claims can never overspend).

export const CLAIM_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function claimUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, "")}/claim/${token}`;
}

export interface ClaimAmbassadorState {
  comp_allowance: number;
  deactivated_at: string | null;
}

export type ClaimPageState = "form" | "exhausted" | "unavailable";

// What the claim page shows. "exhausted" is the friendly all-claimed
// page; "unavailable" covers a deactivated ambassador (their link goes
// quiet rather than erroring). The database re-checks all of this at
// claim time, so this only decides presentation.
export function claimPageState(
  ambassador: ClaimAmbassadorState,
  used: number,
): ClaimPageState {
  if (ambassador.deactivated_at) return "unavailable";
  if (used >= ambassador.comp_allowance || ambassador.comp_allowance <= 0) {
    return "exhausted";
  }
  return "form";
}

export function claimsRemaining(
  ambassador: ClaimAmbassadorState,
  used: number,
): number {
  return Math.max(0, ambassador.comp_allowance - used);
}
