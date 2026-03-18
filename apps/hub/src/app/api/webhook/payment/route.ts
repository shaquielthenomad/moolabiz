import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants, webhookEvents } from "@/lib/db/schema";
import {
  createApplication,
  setEnvironmentVariables,
  deployApplication,
  stopApplication,
  startApplication,
} from "@/lib/coolify";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Body size check
    if (rawBody.length > 1_000_000) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // Verify webhook signature
    const signature = request.headers.get("x-yoco-signature") || "";
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.error("Invalid Yoco webhook signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventId = event.id || event.payload?.id || crypto.randomUUID();
    const eventType = event.type || "unknown";

    // Idempotency check
    const existing = await db.select().from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Store the event
    await db.insert(webhookEvents).values({
      eventType,
      eventId,
      payload: rawBody,
      processed: false,
    });

    // Dispatch by event type
    if (eventType === "payment.succeeded") {
      await handlePaymentSucceeded(event, eventId);
    } else if (eventType === "subscription.cancelled") {
      await handleSubscriptionCancelled(event, eventId);
    } else if (eventType === "subscription.payment_failed") {
      await handlePaymentFailed(event, eventId);
    }

    // Mark event as processed
    await db.update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.eventId, eventId));

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Payment webhook error:", err);
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

async function handlePaymentSucceeded(event: Record<string, unknown>, eventId: string) {
  const metadata = (event.payload as Record<string, unknown>)?.metadata as Record<string, string> ||
    (event as Record<string, unknown>).metadata as Record<string, string> || {};

  const merchantId = metadata.merchantId;
  if (!merchantId) {
    console.error("[payment] No merchantId in metadata:", metadata);
    return;
  }

  // Look up merchant
  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.id, merchantId)).limit(1);

  if (!merchant) {
    console.error("[payment] Merchant not found:", merchantId);
    return;
  }

  // Already provisioned? Skip (idempotent)
  if (merchant.status === "active" || merchant.status === "provisioning") {
    console.log("[payment] Merchant already active/provisioning:", merchantId);
    return;
  }

  // Update status to provisioning
  await db.update(merchants)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(merchants.id, merchantId));

  // Link webhook event to merchant
  await db.update(webhookEvents)
    .set({ merchantId })
    .where(eq(webhookEvents.eventId, eventId));

  const subdomain = merchant.subdomain || `${merchant.slug}.bot.moolabiz.shop`;
  const domains = `https://${subdomain}`;

  console.log(`[payment] Provisioning bot for ${merchant.businessName} (${merchant.slug})`);

  try {
    // 1. Create application on Coolify
    const app = await createApplication(merchant.slug, merchant.businessName, domains);

    // 2. Set environment variables
    await setEnvironmentVariables(app.uuid, {
      BUSINESS_NAME: merchant.businessName,
      BUSINESS_SLUG: merchant.slug,
      WHATSAPP_NUMBER: merchant.whatsappNumber,
      PAYMENT_PROVIDER: merchant.paymentProvider,
      PLAN: merchant.plan,
      WHATSAPP_VERIFY_TOKEN: merchant.whatsappVerifyToken || "",
      WHATSAPP_APP_SECRET: merchant.whatsappAppSecret || "",
      OLLAMA_URL: "http://ollama-shared:11434",
    });

    // 3. Trigger deployment
    await deployApplication(app.uuid);

    // 4. Update merchant to active
    await db.update(merchants).set({
      status: "active",
      coolifyAppUuid: app.uuid,
      subscriptionId: (event.payload as Record<string, unknown>)?.subscriptionId as string || null,
      updatedAt: new Date(),
    }).where(eq(merchants.id, merchantId));

    console.log(`[payment] Bot provisioned: ${subdomain} (app: ${app.uuid})`);
  } catch (err) {
    console.error("[payment] Provisioning failed:", err);
    await db.update(merchants).set({
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(merchants.id, merchantId));
  }
}

async function handleSubscriptionCancelled(event: Record<string, unknown>, eventId: string) {
  const subscriptionId = (event.payload as Record<string, unknown>)?.subscriptionId as string ||
    (event as Record<string, string>).subscriptionId;

  if (!subscriptionId) {
    console.error("[subscription] No subscriptionId in cancel event");
    return;
  }

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.subscriptionId, subscriptionId)).limit(1);

  if (!merchant || !merchant.coolifyAppUuid) {
    console.error("[subscription] Merchant not found for subscription:", subscriptionId);
    return;
  }

  console.log(`[subscription] Cancelling bot for ${merchant.businessName}`);

  try {
    await stopApplication(merchant.coolifyAppUuid);
  } catch (err) {
    console.error("[subscription] Failed to stop app:", err);
  }

  await db.update(merchants).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(merchants.id, merchant.id));

  await db.update(webhookEvents)
    .set({ merchantId: merchant.id })
    .where(eq(webhookEvents.eventId, eventId));
}

async function handlePaymentFailed(event: Record<string, unknown>, eventId: string) {
  const subscriptionId = (event.payload as Record<string, unknown>)?.subscriptionId as string ||
    (event as Record<string, string>).subscriptionId;

  if (!subscriptionId) {
    console.error("[payment] No subscriptionId in failure event");
    return;
  }

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.subscriptionId, subscriptionId)).limit(1);

  if (!merchant || !merchant.coolifyAppUuid) {
    console.error("[payment] Merchant not found for subscription:", subscriptionId);
    return;
  }

  console.log(`[payment] Suspending bot for ${merchant.businessName} (payment failed)`);

  try {
    await stopApplication(merchant.coolifyAppUuid);
  } catch (err) {
    console.error("[payment] Failed to stop app:", err);
  }

  await db.update(merchants).set({
    status: "suspended",
    updatedAt: new Date(),
  }).where(eq(merchants.id, merchant.id));

  await db.update(webhookEvents)
    .set({ merchantId: merchant.id })
    .where(eq(webhookEvents.eventId, eventId));
}
