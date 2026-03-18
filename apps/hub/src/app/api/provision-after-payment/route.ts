import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

    // Update to provisioning
    await db
      .update(merchants)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(merchants.id, merchant.id));

    const subdomain = merchant.subdomain || `${slug}.bot.moolabiz.shop`;
    const domains = `https://${subdomain}`;

    console.log(`[provision] Provisioning bot for ${merchant.businessName} (${slug})`);

    // 1. Create application on Coolify
    const app = await createApplication(slug, merchant.businessName, domains);

    // 2. Set environment variables
    await setEnvironmentVariables(app.uuid, {
      BUSINESS_NAME: merchant.businessName,
      BUSINESS_SLUG: slug,
      WHATSAPP_NUMBER: merchant.whatsappNumber,
      PAYMENT_PROVIDER: merchant.paymentProvider,
      PLAN: merchant.plan,
      WHATSAPP_VERIFY_TOKEN: merchant.whatsappVerifyToken || "",
      WHATSAPP_APP_SECRET: merchant.whatsappAppSecret || "",
      OLLAMA_URL: "http://ollama:11434",
    });

    // 3. Trigger deployment
    await deployApplication(app.uuid);

    // 4. Update merchant
    await db
      .update(merchants)
      .set({
        status: "active",
        coolifyAppUuid: app.uuid,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, merchant.id));

    console.log(`[provision] Bot deployed: ${subdomain} (app: ${app.uuid})`);

    return NextResponse.json({
      success: true,
      subdomain,
      status: "provisioned",
    });
  } catch (err) {
    console.error("[provision] Error:", err);
    return NextResponse.json(
      { error: "Provisioning failed. Please contact support." },
      { status: 500 }
    );
  }
}
