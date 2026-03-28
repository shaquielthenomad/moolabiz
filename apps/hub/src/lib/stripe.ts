import Stripe from "stripe";
import type { SupportedCurrency } from "./types";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Map plan IDs + currency to Stripe price IDs.
//
// Solopreneur price IDs MUST be set via environment variables — there are no
// safe fallbacks.  Create the prices in the Stripe dashboard, then add the
// resulting price_xxx IDs to your .env / Coolify environment:
//
//   STRIPE_PRICE_SOLOPRENEUR_ZAR=price_xxx   (ZAR recurring price)
//   STRIPE_PRICE_SOLOPRENEUR_USD=price_xxx   (USD recurring price)
//   STRIPE_PRICE_SOLOPRENEUR_THB=price_xxx   (THB recurring price)
//
// Missing vars are caught at checkout time (see getStripePriceId) so they
// surface as a clear error rather than a silent Stripe API failure.

// Business plan prices are already live — kept as safe defaults with env override.
const STRIPE_PRICES: Record<string, Record<SupportedCurrency, string | undefined>> = {
  solopreneur: {
    // No placeholder fallbacks — missing env vars throw at checkout time.
    zar: process.env.STRIPE_PRICE_SOLOPRENEUR_ZAR,
    usd: process.env.STRIPE_PRICE_SOLOPRENEUR_USD,
    thb: process.env.STRIPE_PRICE_SOLOPRENEUR_THB,
  },
  business: {
    zar: process.env.STRIPE_PRICE_BUSINESS_ZAR || "price_1TCND6LjaM3mxti1YbrHm1Nd",
    usd: process.env.STRIPE_PRICE_BUSINESS_USD || "price_1TCTVoLjaM3mxti1RDcI8x9W",
    thb: process.env.STRIPE_PRICE_BUSINESS_THB || "price_1TCTVqLjaM3mxti1vTr5s9gw",
  },
};

export function getStripePriceId(
  planId: string,
  currency: SupportedCurrency = "zar"
): string {
  const price = STRIPE_PRICES[planId]?.[currency];

  if (!price) {
    // Solopreneur prices have no placeholder fallback — require real env vars.
    const envVarName = `STRIPE_PRICE_${planId.toUpperCase()}_${currency.toUpperCase()}`;
    throw new Error(
      `Missing required Stripe price ID for plan "${planId}" / currency "${currency}". ` +
        `Set ${envVarName} in your environment (create the price in the Stripe dashboard first).`
    );
  }

  return price;
}

export async function createCheckoutSession(opts: {
  priceId: string;
  merchantId: string;
  slug: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      merchantId: opts.merchantId,
      slug: opts.slug,
    },
    subscription_data: {
      metadata: {
        merchantId: opts.merchantId,
        slug: opts.slug,
      },
    },
  });
}

export async function constructWebhookEvent(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe.webhooks.constructEvent(body, signature, secret);
}

export { getStripe };
