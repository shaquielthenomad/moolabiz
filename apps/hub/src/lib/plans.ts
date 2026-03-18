import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "intro",
    name: "Intro",
    price: 4999, // R49.99
    priceDisplay: "R49.99",
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
