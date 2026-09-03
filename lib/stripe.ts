import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

/**
 * A fresh client per call, not a module-scope singleton: STRIPE_SECRET_KEY
 * is optional (billing isn't configured in every environment), so building
 * the client eagerly at import time would throw for any request that
 * imports this module before the key exists, rather than only for requests
 * that actually need Stripe.
 */
export function getStripeClient(): Stripe {
  const env = getServerEnv();

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured: STRIPE_SECRET_KEY is unset.");
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}
