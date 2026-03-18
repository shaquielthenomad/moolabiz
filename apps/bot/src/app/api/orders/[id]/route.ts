import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const API_SECRET = process.env.API_SECRET || "";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  return API_SECRET.length > 0 && auth === `Bearer ${API_SECRET}`;
}

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  items: string;
  total: number;
  status: string;
  payment_provider: string;
  payment_id: string;
  created_at: string;
  updated_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(id)) as Order | undefined;

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      ...order,
      items: JSON.parse(order.items),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(id));
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["status", "payment_provider", "payment_id"];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(Number(id));

  db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(id)) as Order;
  return NextResponse.json({
    order: {
      ...updated,
      items: JSON.parse(updated.items),
    },
  });
}
