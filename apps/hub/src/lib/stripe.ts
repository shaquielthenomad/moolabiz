import Stripe from "stripe";
import type { SupportedCurrency } from "./types";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Map plan IDs + currency to Stripe price IDs
const STRIPE_PRICES: Record<string, Record<SupportedCurrency, string>> = {
  intro: {
    zar: process.env.STRIPE_PRICE_INTRO_ZAR || "price_1TCNCkLjaM3mxti1g2BLXMjQ",
    usd: process.env.STRIPE_PRICE_INTRO_USD || "price_1TCTVHLjaM3mxti1EyLX3NUO",
    thb: process.env.STRIPE_PRICE_INTRO_THB || "price_1TCTVKLjaM3mxti17ldJZBXR",
  },
  growth: {
    zar: process.env.STRIPE_PRICE_GROWTH_ZAR || "price_1TCND3LjaM3mxti1qJIVl4oe",
    usd: process.env.STRIPE_PRICE_GROWTH_USD || "price_1TCTVcLjaM3mxti1my4RKXMa",
    thb: process.env.STRIPE_PRICE_GROWTH_THB || "price_1TCTVeLjaM3mxti1cPhTJnbE",
  },
  pro: {
    zar: process.env.STRIPE_PRICE_PRO_ZAR || "price_1TCND5LjaM3mxti1e5oDqmHs",
    usd: process.env.STRIPE_PRICE_PRO_USD || "price_1TCTVjLjaM3mxti1WVCb5hUV",
    thb: process.env.STRIPE_PRICE_PRO_THB || "price_1TCTVkLjaM3mxti1rsaCbVvN",
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
): string | undefined {
  return STRIPE_PRICES[planId]?.[currency];
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
