import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// Map plan IDs to Stripe price IDs
const STRIPE_PRICES: Record<string, string> = {
  intro: process.env.STRIPE_PRICE_INTRO || "price_1TCNCkLjaM3mxti1g2BLXMjQ",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_1TCND3LjaM3mxti1qJIVl4oe",
  pro: process.env.STRIPE_PRICE_PRO || "price_1TCND5LjaM3mxti1e5oDqmHs",
  business: process.env.STRIPE_PRICE_BUSINESS || "price_1TCND6LjaM3mxti1YbrHm1Nd",
};

export function getStripePriceId(planId: string): string | undefined {
  return STRIPE_PRICES[planId];
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
