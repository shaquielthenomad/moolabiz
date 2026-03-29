import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsAppNotification } from "@/lib/openclaw";

/**
 * POST /api/storefront/order-notification
 *
 * Called from the Vendure storefront after a successful order placement.
 * Sends a WhatsApp notification to the merchant about the new order.
 *
 * Auth: Vendure channel token passed in the `x-vendure-channel-token` header.
 * This is safe because:
 *   - Channel tokens only scope data access, they don't grant write permissions
 *   - This endpoint only triggers a read-only notification to the merchant
 *   - No sensitive data is exposed
 *
 * Body: {
 *   orderCode: string;
 *   customerName?: string;
 *   total?: number;         // in cents
 *   itemCount?: number;
 *   shippingAddress?: string;
 * }
 */
export async function POST(request: NextRequest) {
  // Authenticate by Vendure channel token
  const channelToken = request.headers.get("x-vendure-channel-token");
  if (!channelToken) {
    return NextResponse.json(
      { error: "Missing x-vendure-channel-token header" },
      { status: 401 }
    );
  }

  // Look up the merchant by channel token
  const [merchant] = await db
    .select({
      id: merchants.id,
      slug: merchants.slug,
      businessName: merchants.businessName,
      whatsappNumber: merchants.whatsappNumber,
      status: merchants.status,
    })
    .from(merchants)
    .where(eq(merchants.vendureChannelToken, channelToken))
    .limit(1);

  if (!merchant) {
    return NextResponse.json(
      { error: "Unknown channel token" },
      { status: 401 }
    );
  }

  if (merchant.status !== "active") {
    return NextResponse.json(
      { error: "Merchant is not active" },
      { status: 403 }
    );
  }

  if (!merchant.whatsappNumber) {
    return NextResponse.json(
      { error: "Merchant WhatsApp number not configured" },
      { status: 404 }
    );
  }

  // Parse body
  let body: {
    orderCode?: string;
    customerName?: string;
    total?: number;
    itemCount?: number;
    shippingAddress?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { orderCode, customerName, total, itemCount, shippingAddress } = body;

  if (!orderCode) {
    return NextResponse.json(
      { error: "Missing required field: orderCode" },
      { status: 400 }
    );
  }

  // Format total from cents to Rand
  const totalRand =
    typeof total === "number"
      ? `R${(total / 100).toFixed(2)}`
      : "Unknown";

  // Build the notification message
  const lines = [
    `\u{1F6D2} New Order #${orderCode}!`,
    "",
    `Customer: ${customerName || "Guest"}`,
    `Items: ${itemCount ?? "?"} item${itemCount === 1 ? "" : "s"}`,
    `Total: ${totalRand}`,
  ];

  if (shippingAddress) {
    lines.push("", `Delivery: ${shippingAddress}`);
  }

  lines.push("", `View details: https://moolabiz.shop/dashboard/orders`);

  const message = lines.join("\n");

  // Send the notification — don't let failures block the response
  const result = await sendWhatsAppNotification({
    slug: merchant.slug,
    phone: merchant.whatsappNumber,
    message,
  });

  if (result.ok) {
    console.log(
      `[storefront/order-notification] Sent notification for order ${orderCode} to ${merchant.businessName}`
    );
  } else {
    console.error(
      `[storefront/order-notification] Failed to notify ${merchant.businessName} for order ${orderCode}:`,
      result.error
    );
  }

  return NextResponse.json({
    ok: result.ok,
    ...(result.error && { error: result.error }),
  });
}
