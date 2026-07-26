import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Lazily-constructed Stripe server client. Server-only. */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
