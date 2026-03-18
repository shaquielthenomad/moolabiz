import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isAuthorized } from "@/lib/auth";

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

const MAX_ITEMS_PER_ORDER = 50;
const MAX_ITEM_QUANTITY = 100;

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

  if (items.length > MAX_ITEMS_PER_ORDER) {
    return NextResponse.json({ error: `Maximum ${MAX_ITEMS_PER_ORDER} items per order` }, { status: 400 });
  }

  // Validate all items cheaply before any DB queries
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
      return NextResponse.json(
        { error: "Each item needs productId and quantity between 1-100" },
        { status: 400 }
      );
    }
  }

  // Batch-fetch all products in one query (fixes N+1)
  const productIds = items.map((i) => i.productId);
  const placeholders = productIds.map(() => "?").join(",");
  const products = db
    .prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND in_stock = 1`)
    .all(...productIds) as Product[];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const resolvedItems: { productId: number; name: string; price: number; quantity: number }[] = [];
  let total = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
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

  if (total > 10_000_000) {
    return NextResponse.json({ error: "Order total exceeds maximum" }, { status: 400 });
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

  // Get merchant's payment key (settings table created at init in db.ts)
  const merchantPaymentKey = db.prepare(
    "SELECT value FROM settings WHERE key = 'yoco_secret_key'"
  ).get() as { value: string } | undefined;

  let paymentUrl = `/order/${orderId}`;

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
        db.prepare("UPDATE orders SET payment_id = ? WHERE id = ?")
          .run(checkout.id, orderId);
      }
    } catch (err) {
      console.error("[orders] Yoco checkout failed:", err);
    }
  }

  return NextResponse.json(
    { orderId, total, items: resolvedItems, paymentUrl },
    { status: 201 }
  );
}
