import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "intro",
    name: "Intro",
    price: 4999, // R49.99 (ZAR cents — kept for compatibility)
    priceDisplay: "R49.99",
    prices: {
      zar: 4999,  // R49.99
      usd: 299,   // $2.99
      thb: 9900,  // ฿99
    },
    priceDisplays: {
      zar: "R49.99",
      usd: "$2.99",
      thb: "฿99",
    },
    features: [
      "WhatsApp shop bot",
      "Web catalog storefront",
      "Order taking & cart",
      "1 payment provider",
      "English + 1 language",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 14900, // R149
    priceDisplay: "R149",
    popular: true,
    prices: {
      zar: 14900, // R149
      usd: 899,   // $8.99
      thb: 29900, // ฿299
    },
    priceDisplays: {
      zar: "R149",
      usd: "$8.99",
      thb: "฿299",
    },
    features: [
      "Everything in Intro",
      "All 5 SA languages",
      "All payment providers",
      "Appointment booking",
      "Daily revenue reports",
      "WhatsApp support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29900, // R299
    priceDisplay: "R299",
    prices: {
      zar: 29900, // R299
      usd: 1699,  // $16.99
      thb: 57900, // ฿579
    },
    priceDisplays: {
      zar: "R299",
      usd: "$16.99",
      thb: "฿579",
    },
    features: [
      "Everything in Growth",
      "AI business advisor",
      "Priority support",
      "Custom bot personality",
      "Advanced analytics",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 49900, // R499
    priceDisplay: "R499",
    prices: {
      zar: 49900, // R499
      usd: 2799,  // $27.99
      thb: 94900, // ฿949
    },
    priceDisplays: {
      zar: "R499",
      usd: "$27.99",
      thb: "฿949",
    },
    features: [
      "Everything in Pro",
      "Dedicated support",
      "Multiple WhatsApp numbers",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
