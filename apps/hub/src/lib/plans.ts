import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "solopreneur",
    name: "Solopreneur",
    price: 8900, // R89 in ZAR cents
    priceDisplay: "R89",
    prices: {
      zar: 8900,  // R89
      usd: 499,   // $4.99
      thb: 17900, // ฿179
    },
    priceDisplays: {
      zar: "R89",
      usd: "$4.99",
      thb: "฿179",
    },
    features: [
      "WhatsApp shop bot",
      "Web catalog storefront",
      "Order taking & cart",
      "Up to 50 products",
      "1 payment provider",
      "English + 1 SA language",
      "Dashboard & order management",
      "Email support",
    ],
    maxProducts: 50,
  },
  {
    id: "business",
    name: "Business",
    price: 34900, // R349 in ZAR cents
    priceDisplay: "R349",
    popular: true,
    prices: {
      zar: 34900, // R349
      usd: 1999,  // $19.99
      thb: 67900, // ฿679
    },
    priceDisplays: {
      zar: "R349",
      usd: "$19.99",
      thb: "฿679",
    },
    features: [
      "Everything in Solopreneur",
      "Unlimited products",
      "All 5 SA languages",
      "All payment providers",
      "Daily revenue reports",
      "AI business advisor",
      "Priority WhatsApp support",
      "Advanced analytics",
    ],
    maxProducts: null,
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
