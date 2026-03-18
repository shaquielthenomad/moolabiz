import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const API_SECRET = process.env.API_SECRET || "";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  return API_SECRET.length > 0 && auth === `Bearer ${API_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  return NextResponse.json({ orders });
}

interface OrderItem {
  productId: number;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  in_stock: number;
}

export async function POST(request: NextRequest) {
  let body: {
    customer_name?: string;
    customer_phone?: string;
    items?: OrderItem[];
    payment_provider?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { customer_name, customer_phone, items, payment_provider } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  // Resolve products and compute total
  const resolvedItems: { productId: number; name: string; price: number; quantity: number }[] = [];
  let total = 0;

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity < 1) {
      return NextResponse.json(
        { error: "Each item needs productId and quantity >= 1" },
        { status: 400 }
      );
    }

    const product = db.prepare("SELECT * FROM products WHERE id = ? AND in_stock = 1").get(
      item.productId
    ) as Product | undefined;

    if (!product) {
      return NextResponse.json(
        { error: `Product ${item.productId} not found or out of stock` },
        { status: 400 }
      );
    }

    resolvedItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    });

    total += product.price * item.quantity;
  }

  const result = db.prepare(
    `INSERT INTO orders (customer_name, customer_phone, items, total, payment_provider)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    customer_name || "",
    customer_phone || "",
    JSON.stringify(resolvedItems),
    total,
    payment_provider || ""
  );

  const orderId = result.lastInsertRowid;

  // Create settings table if needed, get merchant's payment key
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const merchantPaymentKey = db.prepare(
    "SELECT value FROM settings WHERE key = 'yoco_secret_key'"
  ).get() as { value: string } | undefined;

  let paymentUrl = `/order/${orderId}`;

  // If merchant has their own Yoco key, create a checkout for the customer
  if (merchantPaymentKey?.value && total >= 200) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
        `https://${process.env.BUSINESS_SLUG}.bot.moolabiz.shop`;

      const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${merchantPaymentKey.value}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          currency: "ZAR",
          successUrl: `${baseUrl}/order/${orderId}?paid=true`,
          cancelUrl: `${baseUrl}/cart?cancelled=true`,
          failureUrl: `${baseUrl}/cart?failed=true`,
          metadata: { orderId: String(orderId), merchant: process.env.BUSINESS_SLUG },
        }),
      });

      if (yocoRes.ok) {
        const checkout = await yocoRes.json();
        paymentUrl = checkout.redirectUrl;

        // Store payment ID on the order
        db.prepare("UPDATE orders SET payment_id = ? WHERE id = ?")
          .run(checkout.id, orderId);
      }
    } catch (err) {
      console.error("[orders] Yoco checkout failed:", err);
      // Fall back to order confirmation page
    }
  }

  return NextResponse.json(
    {
      orderId,
      total,
      items: resolvedItems,
      paymentUrl,
    },
    { status: 201 }
  );
}
