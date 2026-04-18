import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(env.stripeSecretKey(), {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeSingleton;
}
