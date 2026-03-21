import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { createSessionToken } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { provisionMerchant } from "@/lib/provisioning";

const SESSION_COOKIE_NAME = "moolabiz_session";

/**
 * Helper to create a NextResponse with the session cookie set so the
 * user is logged in for subsequent dashboard visits.
 */
function jsonWithSession(
  data: Record<string, unknown>,
  merchantId: string,
  status = 200
): NextResponse {
  const token = createSessionToken(merchantId);
  const res = NextResponse.json(data, { status });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return res;
}

export async function POST(request: Request) {
  try {
    // No session cookie requirement — after Stripe redirect the user may not have one.
    // Instead we verify by slug + the Stripe checkout session ID that Stripe appended
    // to the redirect URL. This is unguessable (64+ random chars) and proves the caller
    // actually completed the Stripe checkout flow.

    const { slug, sessionId } = await request.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.slug, slug))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    if (!merchant.yocoCheckoutId) {
      return NextResponse.json({ error: "No payment found" }, { status: 403 });
    }

    // Verify the provided session ID matches the one stored during checkout.
    // This prevents account takeover — only someone who completed the actual
    // Stripe checkout (and was redirected with the real session ID) can proceed.
    if (sessionId !== merchant.yocoCheckoutId) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 403 });
    }

    // Verify the checkout session is actually paid with Stripe
    try {
      const stripe = getStripe();
      const checkoutSession = await stripe.checkout.sessions.retrieve(merchant.yocoCheckoutId);
      if (checkoutSession.payment_status !== "paid") {
        return NextResponse.json({ error: "Payment not confirmed" }, { status: 402 });
      }
    } catch (stripeErr) {
      console.error("[provision] Stripe verification failed:", stripeErr);
      return NextResponse.json({ error: "Could not verify payment" }, { status: 402 });
    }

    if (merchant.status === "active") {
      return jsonWithSession(
        {
          success: true,
          subdomain: merchant.subdomain,
          status: "already_active",
        },
        merchant.id
      );
    }

    if (merchant.status === "provisioning") {
      return jsonWithSession(
        {
          success: true,
          subdomain: merchant.subdomain,
          status: "provisioning",
        },
        merchant.id
      );
    }

    // Atomic status transition
    const updated = await db
      .update(merchants)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(and(eq(merchants.id, merchant.id), eq(merchants.status, "pending")))
      .returning();

    if (updated.length === 0) {
      return jsonWithSession(
        {
          success: true,
          subdomain: merchant.subdomain,
          status: "provisioning",
        },
        merchant.id
      );
    }

    const subdomain = merchant.subdomain || `${slug}.bot.moolabiz.shop`;

    console.log(`[provision] Provisioning bot for ${merchant.businessName} (${slug})`);

    // Re-read merchant to get latest state (may have been updated by webhook)
    const [freshMerchant] = await db.select().from(merchants).where(eq(merchants.id, merchant.id)).limit(1);

    const result = await provisionMerchant({
      merchantId: merchant.id,
      slug,
      businessName: merchant.businessName,
      whatsappNumber: merchant.whatsappNumber,
      paymentProvider: merchant.paymentProvider,
      plan: merchant.plan,
      email: merchant.email,
      existingVendureChannelId: freshMerchant?.vendureChannelId,
      existingVendureChannelToken: freshMerchant?.vendureChannelToken,
    });

    if (result.success) {
      return jsonWithSession(
        {
          success: true,
          subdomain,
          status: "success",
        },
        merchant.id
      );
    } else {
      return NextResponse.json(
        { error: "Provisioning failed. Please refresh the page to retry." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[provision] Error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 }
    );
  }
}
