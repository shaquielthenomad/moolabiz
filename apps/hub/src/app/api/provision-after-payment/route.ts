import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { provisionMerchant } from "@/lib/provisioning";

export async function POST(request: Request) {
  try {
    // Require authenticated merchant session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await request.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.slug, slug))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // Ensure the logged-in merchant matches the requested slug
    if (merchant.id !== session.merchantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!merchant.yocoCheckoutId) {
      return NextResponse.json({ error: "No payment found" }, { status: 403 });
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
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "already_active",
      });
    }

    if (merchant.status === "provisioning") {
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "provisioning",
      });
    }

    // Atomic status transition
    const updated = await db
      .update(merchants)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(and(eq(merchants.id, merchant.id), eq(merchants.status, "pending")))
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
