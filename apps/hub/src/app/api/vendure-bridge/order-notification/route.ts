import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../_auth";
import { sendWhatsAppNotification } from "@/lib/openclaw";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/vendure-bridge/order-notification
 *
 * Sends a WhatsApp notification to the merchant when a new order is placed.
 * Called from the storefront after successful checkout.
 *
 * Auth: Bearer token (merchant apiSecret) — same as other vendure-bridge endpoints.
 *
 * Body: {
 *   orderCode: string;
 *   customerName: string;
 *   total: number;         // in cents
 *   itemCount: number;
 *   shippingAddress?: string;
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

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

  // Look up the merchant's WhatsApp number
  const [merchant] = await db
    .select({
      whatsappNumber: merchants.whatsappNumber,
      slug: merchants.slug,
    })
    .from(merchants)
    .where(eq(merchants.id, auth.id))
    .limit(1);

  if (!merchant?.whatsappNumber) {
    return NextResponse.json(
      { error: "Merchant WhatsApp number not found" },
      { status: 404 }
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

  // Send the notification (non-blocking from the caller's perspective,
  // but we await here to report the result)
  const result = await sendWhatsAppNotification({
    slug: merchant.slug,
    phone: merchant.whatsappNumber,
    message,
  });

  if (result.ok) {
    console.log(
      `[order-notification] Sent notification for order ${orderCode} to ${auth.businessName}`
    );
  } else {
    // Log but don't fail — the order was already placed successfully
    console.error(
      `[order-notification] Failed to notify ${auth.businessName} for order ${orderCode}:`,
      result.error
    );
  }

  return NextResponse.json({
    ok: result.ok,
    ...(result.error && { error: result.error }),
  });
}
