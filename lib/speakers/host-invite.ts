// Workshop host invites (September 2026 plan additions): inviting a
// host from the WORKSHOPS admin gives them the full package in one go:
//   - their account linked to their (published) host page,
//   - ambassador provisioning with the confirmed defaults:
//     comp allowance 2, personal 20% discount code,
//   - one combined welcome email covering page, share link, comps,
//     and code.
// Pure helpers live here (unit-tested); the orchestration is in
// send-host-invite.ts.

export const HOST_COMP_ALLOWANCE = 2;
export const HOST_DISCOUNT_PERCENT = 20;

// Personal code from the profile slug: "dan-ince" -> "DANINCE20".
// Uppercase alphanumerics only (Stripe codes are case-insensitive and
// customers type them), capped so even a 50-char slug stays sane.
export function hostDiscountCode(profileSlug: string): string {
  const base = profileSlug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 18);
  return `${base || "HOST"}${HOST_DISCOUNT_PERCENT}`;
}

// Ambassador slugs are capped at 30 chars (profile slugs allow 50):
// truncate, trim any dangling hyphen, then uniquify against the taken
// set the same way profile slugs do.
export function ambassadorSlugFromProfileSlug(
  profileSlug: string,
  taken: ReadonlySet<string>,
): string {
  const base = profileSlug.slice(0, 30).replace(/-+$/g, "") || "host";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base.slice(0, 30 - String(i).length - 1)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`could not find an available ambassador slug for ${profileSlug}`);
}
