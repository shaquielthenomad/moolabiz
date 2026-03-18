import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  createApplication,
  setEnvironmentVariables,
  deployApplication,
} from "@/lib/coolify";

const RESERVED_SLUGS = [
  "api", "www", "mail", "admin", "ns", "ns1", "ns2",
  "ftp", "smtp", "status", "app", "dashboard", "hub",
];

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-yoco-signature") || "";
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;

    // Verify webhook signature
    if (webhookSecret) {
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        console.error("Invalid Yoco webhook signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);

    // Only process successful payments
    if (event.type !== "payment.succeeded") {
      return NextResponse.json({ received: true });
    }

    const metadata = event.payload?.metadata || event.metadata || {};
    const { businessName, whatsappNumber, paymentProvider, plan, slug } = metadata;

    if (!businessName || !slug) {
      console.error("Missing metadata in payment webhook:", metadata);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    if (RESERVED_SLUGS.includes(slug)) {
      console.error("Reserved slug in payment webhook:", slug);
      return NextResponse.json({ error: "Reserved slug" }, { status: 400 });
    }

    const subdomain = `${slug}.bot.moolabiz.shop`;
    const domains = `https://${subdomain}`;

    console.log(`[payment] Provisioning bot for ${businessName} (${slug}), plan: ${plan}`);

    // 1. Create application on Coolify
    const app = await createApplication(slug, businessName, domains);

    // 2. Set environment variables
    await setEnvironmentVariables(app.uuid, {
      BUSINESS_NAME: businessName,
      BUSINESS_SLUG: slug,
      WHATSAPP_NUMBER: whatsappNumber || "",
      PAYMENT_PROVIDER: paymentProvider || "",
      PLAN: plan || "starter",
    });

    // 3. Trigger deployment
    await deployApplication(app.uuid);

    console.log(`[payment] Bot provisioned: ${subdomain} (app: ${app.uuid})`);

    return NextResponse.json({ received: true, subdomain });
  } catch (err) {
    console.error("Payment webhook error:", err);
    // Return 200 to prevent Yoco from retrying (we log the error)
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}
