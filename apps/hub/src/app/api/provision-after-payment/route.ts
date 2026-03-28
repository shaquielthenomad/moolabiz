import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { provisionMerchant } from "@/lib/provisioning";
import { MERCHANT_STATUS } from "@/lib/constants";

/**
 * POST /api/provision-after-payment
 *
 * Triggered after Stripe checkout completes. Verifies payment via the
 * Stripe session ID and provisions the merchant's bot. No session cookie
 * is set — the user is already authenticated via Clerk.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (merchant.status === MERCHANT_STATUS.ACTIVE) {
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "already_active",
      });
    }

    if (merchant.status === MERCHANT_STATUS.PROVISIONING) {
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "provisioning",
      });
    }

    // Atomic status transition
    const updated = await db
      .update(merchants)
      .set({ status: MERCHANT_STATUS.PROVISIONING, updatedAt: new Date() })
      .where(and(eq(merchants.id, merchant.id), eq(merchants.status, MERCHANT_STATUS.PENDING)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "provisioning",
      });
    }

    const subdomain = merchant.subdomain || `${slug}.bot.moolabiz.shop`;

    console.log(`[provision] Provisioning bot for ${merchant.businessName} (${slug})`);

    const result = await provisionMerchant({
      merchantId: merchant.id,
      slug,
      businessName: merchant.businessName,
      whatsappNumber: merchant.whatsappNumber,
      paymentProvider: merchant.paymentProvider,
      plan: merchant.plan,
      email: merchant.email,
      existingVendureChannelId: updated[0].vendureChannelId,
      existingVendureChannelToken: updated[0].vendureChannelToken,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        subdomain,
        status: "success",
      });
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
