import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { getPlan } from "@/lib/plans";
import type { CheckoutResponse } from "@/lib/types";

const checkoutSchema = z.object({
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
  paymentProvider: z.enum(["yoco", "ozow", "payfast"]),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  plan: z.enum(["starter", "pro", "business"]),
});

const RESERVED_SLUGS = [
  "api", "www", "mail", "admin", "ns", "ns1", "ns2",
  "ftp", "smtp", "status", "app", "dashboard", "hub",
];

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
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json(
        { success: false, error: firstError } satisfies CheckoutResponse,
        { status: 400 }
      );
    }

    const { businessName, whatsappNumber, paymentProvider, pin, plan: planId } = parsed.data;
    const plan = getPlan(planId);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Invalid plan selected." } satisfies CheckoutResponse,
        { status: 400 }
      );
    }

    const slug = slugify(businessName);

    if (!slug || slug.length < 3 || !/[a-z0-9]/.test(slug)) {
      return NextResponse.json(
        { success: false, error: "Business name is too short. Try a longer name." } satisfies CheckoutResponse,
        { status: 400 }
      );
    }

    if (RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json(
        { success: false, error: "That name is reserved. Please choose a different name." } satisfies CheckoutResponse,
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existingSlug = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
    if (existingSlug.length > 0) {
      return NextResponse.json(
        { success: false, error: "A bot for a similar business name already exists. Try adding your area or a unique word." } satisfies CheckoutResponse,
        { status: 409 }
      );
    }

    // Check for duplicate WhatsApp number
    const existingPhone = await db.select().from(merchants).where(eq(merchants.whatsappNumber, whatsappNumber)).limit(1);
    if (existingPhone.length > 0) {
      return NextResponse.json(
        { success: false, error: "This WhatsApp number is already registered. Contact support if you need help." } satisfies CheckoutResponse,
        { status: 409 }
      );
    }

    // Generate secrets for the bot
    const whatsappVerifyToken = crypto.randomBytes(32).toString("hex");
    const whatsappAppSecret = crypto.randomBytes(32).toString("hex");

    // Hash the PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    // Insert merchant as pending
    const [merchant] = await db.insert(merchants).values({
      businessName,
      slug,
      whatsappNumber,
      paymentProvider,
      pin: hashedPin,
      plan: planId,
      status: "pending",
      subdomain: `${slug}.bot.moolabiz.shop`,
      whatsappVerifyToken,
      whatsappAppSecret,
    }).returning();

    const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;

    if (!YOCO_SECRET_KEY) {
      console.error("YOCO_SECRET_KEY is not set");
      return NextResponse.json(
        { success: false, error: "Payment system unavailable. Please try again later." } satisfies CheckoutResponse,
        { status: 500 }
      );
    }

    // Create Yoco checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://moolabiz.shop";
    const res = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${YOCO_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.price,
        currency: "ZAR",
        successUrl: `${baseUrl}/setup-complete?slug=${slug}`,
        cancelUrl: `${baseUrl}/?cancelled=true`,
        failureUrl: `${baseUrl}/?failed=true`,
        metadata: {
          merchantId: merchant.id,
          slug,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Yoco checkout failed (${res.status}):`, errBody);
      // Clean up the pending merchant
      await db.delete(merchants).where(eq(merchants.id, merchant.id));
      return NextResponse.json(
        { success: false, error: "Could not create checkout. Please try again." } satisfies CheckoutResponse,
        { status: 500 }
      );
    }

    const checkout = await res.json();

    // Store checkout ID on merchant
    await db.update(merchants)
      .set({ yocoCheckoutId: checkout.id, updatedAt: new Date() })
      .where(eq(merchants.id, merchant.id));

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.redirectUrl,
      checkoutId: checkout.id,
    } satisfies CheckoutResponse);
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." } satisfies CheckoutResponse,
      { status: 500 }
    );
  }
}
