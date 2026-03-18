export interface SignupFormData {
  businessName: string;
  whatsappNumber: string;
  paymentProvider: "yoco" | "ozow" | "payfast";
}

export interface ProvisionResponse {
  success: boolean;
  subdomain?: string;
  error?: string;
}

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  checkoutId?: string;
  error?: string;
}

export interface CoolifyApplication {
  uuid: string;
  name: string;
  fqdn: string;
  description: string;
  status: string;
}

export type PlanType = "starter" | "pro" | "business";

export interface Plan {
  id: PlanType;
  name: string;
  price: number; // in ZAR cents
  priceDisplay: string;
  features: string[];
  popular?: boolean;
}
