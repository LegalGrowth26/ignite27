import { env } from "@/lib/env";

// Which Stripe mode the deployment's secret key operates in. Test and
// live are entirely separate universes in Stripe: coupons and promotion
// codes created with a test key do not exist for a live-key checkout
// session, and vice versa. Surfacing the mode in the admin UI makes a
// key swap immediately visible, instead of codes silently reading as
// "invalid" at checkout because they live in the other mode.
export type StripeKeyMode = "live" | "test" | "unknown";

// Pure so it is unit-testable; only ever inspects the key's public
// prefix (sk_live_/sk_test_ for secret keys, rk_ for restricted keys).
// The key itself must never be rendered or logged.
export function stripeKeyMode(secretKey: string): StripeKeyMode {
  if (/^(sk|rk)_live_/.test(secretKey)) return "live";
  if (/^(sk|rk)_test_/.test(secretKey)) return "test";
  return "unknown";
}

export function currentStripeKeyMode(): StripeKeyMode {
  return stripeKeyMode(env.stripeSecretKey());
}
