import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import {
  createApplication,
  setEnvironmentVariables,
  deployApplication,
} from "@/lib/coolify";

export async function POST(request: Request) {
  try {
    const { slug } = await request.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // Find the merchant
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.slug, slug))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // Must have a yocoCheckoutId (proves they went through checkout)
    if (!merchant.yocoCheckoutId) {
      return NextResponse.json({ error: "No payment found" }, { status: 403 });
    }

    // Already provisioned or in progress
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

    // Atomic status transition: only proceed if status is still "pending"
    // This prevents the race condition between webhook and client-side provisioning
    const updated = await db
      .update(merchants)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(and(eq(merchants.id, merchant.id), eq(merchants.status, "pending")))
      .returning();

    if (updated.length === 0) {
      // Another process already claimed this — return current state
      return NextResponse.json({
        success: true,
        subdomain: merchant.subdomain,
        status: "provisioning",
      });
    }

    const subdomain = merchant.subdomain || `${slug}.bot.moolabiz.shop`;
    const domains = `https://${subdomain}`;

    console.log(`[provision] Provisioning bot for ${merchant.businessName} (${slug})`);

    try {
      // 1. Create application on Coolify
      const app = await createApplication(slug, merchant.businessName, domains);

      // 2. Set environment variables
      await setEnvironmentVariables(app.uuid, {
        BUSINESS_NAME: merchant.businessName,
        BUSINESS_SLUG: slug,
        WHATSAPP_NUMBER: merchant.whatsappNumber,
        PAYMENT_PROVIDER: merchant.paymentProvider,
        PLAN: merchant.plan,
        API_SECRET: crypto.randomBytes(32).toString("hex"),
        DB_PATH: "/data/store.db",
      });

      // 3. Trigger deployment (async on Coolify side — keep status as "provisioning")
      await deployApplication(app.uuid);

      // 4. Store Coolify UUID — keep status as "provisioning" (not "active")
      // Status transitions to "active" only when Coolify confirms healthy
      await db
        .update(merchants)
        .set({
          coolifyAppUuid: app.uuid,
          updatedAt: new Date(),
        })
        .where(eq(merchants.id, merchant.id));

      console.log(`[provision] Bot deploying: ${subdomain} (app: ${app.uuid})`);

      return NextResponse.json({
        success: true,
        subdomain,
        status: "provisioning",
      });
    } catch (err) {
      // Rollback status on failure
      console.error("[provision] Error:", err);
      await db
        .update(merchants)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(merchants.id, merchant.id));

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
