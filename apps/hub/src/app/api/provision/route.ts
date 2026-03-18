import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApplication,
  setEnvironmentVariables,
  deployApplication,
} from "@/lib/coolify";
import type { ProvisionResponse } from "@/lib/types";

const provisionSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(60, "Business name must be under 60 characters"),
  whatsappNumber: z
    .string()
    .regex(
      /^\+27\d{9}$/,
      "Enter a valid South African number like +27821234567"
    ),
  paymentProvider: z.enum(["yoco", "ozow", "payfast"], {
    error: "Pick a payment provider",
  }),
});

const RESERVED_SLUGS = [
  "api", "www", "mail", "admin", "ns", "ns1", "ns2",
  "ftp", "smtp", "status", "app", "dashboard", "hub",
];

// Simple in-memory rate limiter: IP -> list of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  // Remove entries older than the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  try {
    // Rate limiting by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
        } satisfies ProvisionResponse,
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = provisionSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json(
        { success: false, error: firstError } satisfies ProvisionResponse,
        { status: 400 }
      );
    }

    const { businessName, whatsappNumber, paymentProvider } = parsed.data;
    const slug = slugify(businessName);

    if (!slug || slug.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Business name is too short to create a URL. Try a longer name.",
        } satisfies ProvisionResponse,
        { status: 400 }
      );
    }

    if (RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json(
        {
          success: false,
          error: "That business name is reserved. Please choose a different name.",
        } satisfies ProvisionResponse,
        { status: 400 }
      );
    }

    const subdomain = `${slug}.bot.moolabiz.shop`;
    const domains = `https://${subdomain}`;

    // 1. Create application on Coolify
    const app = await createApplication(slug, businessName, domains);

    // 2. Set environment variables
    await setEnvironmentVariables(app.uuid, {
      BUSINESS_NAME: businessName,
      BUSINESS_SLUG: slug,
      WHATSAPP_NUMBER: whatsappNumber,
      PAYMENT_PROVIDER: paymentProvider,
    });

    // 3. Trigger deployment
    await deployApplication(app.uuid);

    return NextResponse.json({
      success: true,
      subdomain,
    } satisfies ProvisionResponse);
  } catch (err) {
    console.error("Provision error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Provisioning failed. Please try again.",
      } satisfies ProvisionResponse,
      { status: 500 }
    );
  }
}
