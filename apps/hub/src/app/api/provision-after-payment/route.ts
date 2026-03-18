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
import { deployOpenClaw } from "@/lib/openclaw";

export async function POST(request: Request) {
  try {
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

    if (!merchant.yocoCheckoutId) {
      return NextResponse.json({ error: "No payment found" }, { status: 403 });
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
    const domains = `https://${subdomain}`;

    console.log(`[provision] Provisioning bot for ${merchant.businessName} (${slug})`);

    try {
      // 1. Create catalog app on Coolify
      const app = await createApplication(slug, merchant.businessName, domains);

      // 2. Save app UUID immediately (so we can retry deploy without duplicate)
      await db
        .update(merchants)
        .set({ coolifyAppUuid: app.uuid, updatedAt: new Date() })
        .where(eq(merchants.id, merchant.id));

      // 3. Set environment variables
      await setEnvironmentVariables(app.uuid, {
        BUSINESS_NAME: merchant.businessName,
        BUSINESS_SLUG: slug,
        WHATSAPP_NUMBER: merchant.whatsappNumber,
        PAYMENT_PROVIDER: merchant.paymentProvider,
        PLAN: merchant.plan,
        API_SECRET: crypto.randomBytes(32).toString("hex"),
        DB_PATH: "/data/store.db",
        NIXPACKS_NODE_VERSION: "22",
      });

      // 4. Trigger catalog deployment
      await deployApplication(app.uuid);
      console.log(`[provision] Catalog deploying: ${subdomain} (${app.uuid})`);

      // 5. Deploy OpenClaw WhatsApp bot
      let openclawContainerId: string | null = null;
      try {
        const ocResult = await deployOpenClaw({
          slug,
          businessName: merchant.businessName,
          ownerPhone: merchant.whatsappNumber,
          paymentProvider: merchant.paymentProvider,
        });
        openclawContainerId = ocResult.containerId;
        console.log(`[provision] OpenClaw deployed: ${openclawContainerId}`);
      } catch (ocErr) {
        console.error("[provision] OpenClaw failed (non-fatal):", ocErr);
      }

      // 6. Update merchant with OpenClaw info
      await db
        .update(merchants)
        .set({ openclawContainerId, updatedAt: new Date() })
        .where(eq(merchants.id, merchant.id));

      return NextResponse.json({
        success: true,
        subdomain,
        status: "provisioning",
      });
    } catch (err) {
      console.error("[provision] Error:", err);
      // Only rollback to pending if we don't have an app UUID yet
      if (!merchant.coolifyAppUuid) {
        await db
          .update(merchants)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(merchants.id, merchant.id));
      }
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
