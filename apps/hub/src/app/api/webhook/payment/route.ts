import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants, webhookEvents } from "@/lib/db/schema";
import { constructWebhookEvent } from "@/lib/stripe";
import {
  createApplication,
  setEnvironmentVariables,
  deployApplication,
  stopApplication,
  startApplication,
} from "@/lib/coolify";
import { deployOpenClaw, stopOpenClaw, startOpenClaw } from "@/lib/openclaw";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (rawBody.length > 1_000_000) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // Verify Stripe webhook signature
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    let event;
    try {
      event = await constructWebhookEvent(rawBody, signature);
    } catch (err) {
      console.error("Stripe webhook verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventId = event.id;
    const eventType = event.type;

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

    // Dispatch by event type — cast to generic shape for handlers
    const obj = event.data.object as unknown as Record<string, unknown>;
    if (eventType === "checkout.session.completed") {
      await handleCheckoutCompleted(obj, eventId);
    } else if (eventType === "customer.subscription.deleted") {
      await handleSubscriptionCancelled(obj, eventId);
    } else if (eventType === "invoice.payment_failed") {
      await handlePaymentFailed(obj, eventId);
    } else if (eventType === "customer.subscription.updated") {
      await handleSubscriptionUpdated(obj, eventId);
    }

    // Mark event as processed
    await db.update(webhookEvents)
      .set({ processed: true })
      .where(eq(webhookEvents.eventId, eventId));

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

async function handleCheckoutCompleted(session: Record<string, unknown>, eventId: string) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const merchantId = metadata.merchantId;
  const subscriptionId = session.subscription as string;

  if (!merchantId) {
    console.error("[stripe] No merchantId in checkout session metadata");
    return;
  }

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.id, merchantId)).limit(1);

  if (!merchant) {
    console.error("[stripe] Merchant not found:", merchantId);
    return;
  }

  if (merchant.status === "active" || merchant.status === "provisioning") {
    console.log("[stripe] Merchant already active/provisioning:", merchantId);
    return;
  }

  // Atomic status transition
  const updated = await db.update(merchants)
    .set({
      status: "provisioning",
      subscriptionId: subscriptionId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(merchants.id, merchantId), eq(merchants.status, "pending")))
    .returning();

  if (updated.length === 0) {
    console.log("[stripe] Merchant already claimed:", merchantId);
    return;
  }

  await db.update(webhookEvents)
    .set({ merchantId })
    .where(eq(webhookEvents.eventId, eventId));

  const subdomain = merchant.subdomain || `${merchant.slug}.bot.moolabiz.shop`;
  const domains = `https://${subdomain}`;

  console.log(`[stripe] Provisioning bot for ${merchant.businessName} (${merchant.slug})`);

  try {
    const app = await createApplication(merchant.slug, merchant.businessName, domains);

    // Save app UUID immediately so retries don't create duplicates
    await db.update(merchants).set({
      coolifyAppUuid: app.uuid,
      updatedAt: new Date(),
    }).where(eq(merchants.id, merchantId));

    const apiSecret = crypto.randomBytes(32).toString("hex");
    await setEnvironmentVariables(app.uuid, {
      BUSINESS_NAME: merchant.businessName,
      BUSINESS_SLUG: merchant.slug,
      WHATSAPP_NUMBER: merchant.whatsappNumber,
      PAYMENT_PROVIDER: merchant.paymentProvider,
      PLAN: merchant.plan,
      API_SECRET: apiSecret,
      DB_PATH: "/data/store.db",
      OPENCLAW_PROVISIONER_URL: "http://openclaw-provisioner:9999",
      OPENCLAW_PROVISIONER_KEY: process.env.OPENCLAW_PROVISIONER_KEY || "moolabiz-provision-key",
    });

    // Store API secret in hub DB so the dashboard can proxy requests to the bot
    await db.update(merchants).set({ apiSecret, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    await deployApplication(app.uuid);
    console.log(`[stripe] Catalog deploying: ${subdomain} (${app.uuid})`);

    // Deploy OpenClaw WhatsApp bot
    let openclawContainerId: string | null = null;
    try {
      const ocResult = await deployOpenClaw({
        slug: merchant.slug,
        businessName: merchant.businessName,
        ownerPhone: merchant.whatsappNumber,
        paymentProvider: merchant.paymentProvider,
        apiSecret,
      });
      openclawContainerId = ocResult.containerId;
      console.log(`[stripe] OpenClaw deployed: ${openclawContainerId}`);
    } catch (ocErr) {
      console.error("[stripe] OpenClaw failed (non-fatal):", ocErr);
    }

    await db.update(merchants).set({
      status: "active",
      openclawContainerId,
      updatedAt: new Date(),
    }).where(eq(merchants.id, merchantId));

    console.log(`[stripe] Bot deploying: ${subdomain} (app: ${app.uuid})`);
  } catch (err) {
    console.error("[stripe] Provisioning failed:", err);
    await db.update(merchants).set({
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(merchants.id, merchantId));
  }
}

async function handleSubscriptionCancelled(subscription: Record<string, unknown>, eventId: string) {
  const subscriptionId = subscription.id as string;

  if (!subscriptionId) return;

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.subscriptionId, subscriptionId)).limit(1);

  if (!merchant || !merchant.coolifyAppUuid) return;

  console.log(`[stripe] Cancelling bot for ${merchant.businessName}`);

  try { await stopApplication(merchant.coolifyAppUuid); } catch (err) {
    console.error("[stripe] Failed to stop app:", err);
  }

  // Also stop OpenClaw container
  try { await stopOpenClaw(merchant.slug); } catch (err) {
    console.error("[stripe] Failed to stop OpenClaw:", err);
  }

  await db.update(merchants).set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(merchants.id, merchant.id));
  await db.update(webhookEvents).set({ merchantId: merchant.id })
    .where(eq(webhookEvents.eventId, eventId));
}

async function handlePaymentFailed(invoice: Record<string, unknown>, eventId: string) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) return;

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.subscriptionId, subscriptionId)).limit(1);

  if (!merchant || !merchant.coolifyAppUuid) return;

  console.log(`[stripe] Suspending bot for ${merchant.businessName} (payment failed)`);

  try { await stopApplication(merchant.coolifyAppUuid); } catch (err) {
    console.error("[stripe] Failed to stop app:", err);
  }

  // Also stop OpenClaw container
  try { await stopOpenClaw(merchant.slug); } catch (err) {
    console.error("[stripe] Failed to stop OpenClaw:", err);
  }

  await db.update(merchants).set({ status: "suspended", updatedAt: new Date() })
    .where(eq(merchants.id, merchant.id));
  await db.update(webhookEvents).set({ merchantId: merchant.id })
    .where(eq(webhookEvents.eventId, eventId));
}

async function handleSubscriptionUpdated(subscription: Record<string, unknown>, eventId: string) {
  const subscriptionId = subscription.id as string;
  const status = subscription.status as string;

  if (!subscriptionId) return;

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.subscriptionId, subscriptionId)).limit(1);

  if (!merchant) return;

  // If subscription becomes active again (e.g. payment retry succeeded)
  if (status === "active" && merchant.status === "suspended" && merchant.coolifyAppUuid) {
    console.log(`[stripe] Reactivating bot for ${merchant.businessName}`);
    try { await startApplication(merchant.coolifyAppUuid); } catch (err) {
      console.error("[stripe] Failed to start app:", err);
    }
    // Also restart OpenClaw container
    try { await startOpenClaw(merchant.slug); } catch (err) {
      console.error("[stripe] Failed to start OpenClaw:", err);
    }
    await db.update(merchants).set({ status: "active", updatedAt: new Date() })
      .where(eq(merchants.id, merchant.id));
  }

  await db.update(webhookEvents).set({ merchantId: merchant.id })
    .where(eq(webhookEvents.eventId, eventId));
}
