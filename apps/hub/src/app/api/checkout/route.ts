import { NextResponse } from "next/server";
import { z } from "zod";
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
  plan: z.enum(["starter", "pro", "business"]),
});

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

    const { businessName, whatsappNumber, paymentProvider, plan: planId } = parsed.data;
    const plan = getPlan(planId);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Invalid plan selected." } satisfies CheckoutResponse,
        { status: 400 }
      );
    }

    const slug = slugify(businessName);
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
          businessName,
          whatsappNumber,
          paymentProvider,
          plan: planId,
          slug,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Yoco checkout failed (${res.status}):`, errBody);
      return NextResponse.json(
        { success: false, error: "Could not create checkout. Please try again." } satisfies CheckoutResponse,
        { status: 500 }
      );
    }

    const checkout = await res.json();

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
