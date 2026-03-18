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

export interface CoolifyApplication {
  uuid: string;
  name: string;
  fqdn: string;
  description: string;
  status: string;
}
