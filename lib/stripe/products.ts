import type Stripe from "stripe";

// Fixed Stripe Products for the four things we sell. Checkout line
// items reference these ids via price_data.product (Stripe supports a
// product id combined with ad-hoc price_data), which is what makes
// coupon applies_to restrictions possible: a coupon can only target
// Products, and the old product_data-per-session approach created a
// throwaway product per checkout that no coupon could name.
//
// Idempotent, env-aware provisioning WITHOUT storing ids anywhere:
// Stripe lets the caller choose the product id at creation, and ids
// are namespaced per mode (test and live each have their own object
// graph). So the deterministic slugs below are simply ensured to exist
// in whatever mode the current secret key belongs to: retrieve, create
// on 404, and treat a create-race conflict as success. First checkout
// (or first restricted-code creation) in a fresh mode self-provisions;
// nothing is hardcoded from a dashboard and nothing lives in env vars.

export type StripeProductKey = "delegate" | "vip" | "exhibitor" | "lunch";

export const STRIPE_PRODUCT_IDS: Record<StripeProductKey, string> = {
  delegate: "ignite27_delegate",
  vip: "ignite27_vip",
  exhibitor: "ignite27_exhibitor",
  lunch: "ignite27_lunch",
};

// Names and descriptions appear on Stripe receipts; the strings are the
// exact copy the ad-hoc product_data used to carry.
const PRODUCT_DEFINITIONS: Record<
  StripeProductKey,
  { name: string; description: string }
> = {
  delegate: {
    name: "IGNITE! 27 delegate ticket",
    description: "Full-day access. Add lunch separately if you picked it.",
  },
  vip: {
    name: "IGNITE! 27 VIP ticket",
    description: "Full-day access, lunch included, premium badge.",
  },
  exhibitor: {
    name: "IGNITE! 27 exhibitor stand",
    description: "Stand for the day. Includes 2 attendee places and 2 lunches.",
  },
  lunch: {
    name: "Lunch at IGNITE! 27",
    description: "Hot lunch on the day, dietary options catered for.",
  },
};

// Per-process memo: once a key is confirmed present in this mode, skip
// the round-trips for the lambda's lifetime. Keyed per product so a
// partial failure retries only what is missing.
const ensured = new Set<string>();

function isMissingResource(err: unknown): boolean {
  return (err as { code?: string; statusCode?: number })?.code === "resource_missing";
}

function isAlreadyExists(err: unknown): boolean {
  return (err as { code?: string })?.code === "resource_already_exists";
}

export async function ensureStripeProduct(
  stripe: Stripe,
  key: StripeProductKey,
): Promise<string> {
  const id = STRIPE_PRODUCT_IDS[key];
  if (ensured.has(id)) return id;

  try {
    await stripe.products.retrieve(id);
    ensured.add(id);
    return id;
  } catch (err) {
    if (!isMissingResource(err)) throw err;
  }

  const def = PRODUCT_DEFINITIONS[key];
  try {
    await stripe.products.create({
      id,
      name: def.name,
      description: def.description,
      metadata: { ignite27_product_key: key, source: "ignite27-site" },
    });
  } catch (err) {
    // Two cold lambdas racing: the loser's create conflicts, which
    // means the product exists. That is success.
    if (!isAlreadyExists(err)) throw err;
  }
  ensured.add(id);
  return id;
}

export async function ensureStripeProducts(
  stripe: Stripe,
  keys: readonly StripeProductKey[] = ["delegate", "vip", "exhibitor", "lunch"],
): Promise<void> {
  for (const key of keys) {
    await ensureStripeProduct(stripe, key);
  }
}

// Test seam: never used in production code paths.
export function resetEnsuredProductsForTests(): void {
  ensured.clear();
}
