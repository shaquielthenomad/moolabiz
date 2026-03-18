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

  // In a real deployment, payment_provider would determine the payment URL
  // For now return a placeholder that the orchestrator (OpenClaw/n8n) can fill in
  return NextResponse.json(
    {
      orderId,
      total,
      items: resolvedItems,
      paymentUrl: `/order/${orderId}`,
    },
    { status: 201 }
  );
}
