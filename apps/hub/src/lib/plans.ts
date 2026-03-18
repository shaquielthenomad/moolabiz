import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 9900, // R99
    priceDisplay: "R99",
    features: [
      "WhatsApp shop bot",
      "Order taking & cart",
      "1 payment provider",
      "English + 1 language",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 24900, // R249
    priceDisplay: "R249",
    popular: true,
    features: [
      "Everything in Starter",
      "All 5 languages",
      "All payment providers",
      "Appointment booking",
      "Daily revenue reports",
      "Priority WhatsApp support",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 49900, // R499
    priceDisplay: "R499",
    features: [
      "Everything in Pro",
      "Devil's Advocate AI advisor",
      "Admin dashboard",
      "Custom bot personality",
      "Dedicated support",
      "Multiple WhatsApp numbers",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
