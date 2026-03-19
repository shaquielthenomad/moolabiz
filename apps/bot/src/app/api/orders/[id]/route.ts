import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isAuthorized } from "@/lib/auth";

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(id)) as Order | undefined;

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authed = isAuthorized(request);
  return NextResponse.json({
    order: {
      id: order.id,
      items: JSON.parse(order.items),
      total: order.total,
      status: order.status,
      created_at: order.created_at,
      customer_name: order.customer_name || "Customer",
      ...(authed ? { customer_phone: order.customer_phone, payment_id: order.payment_id } : {}),
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
    if (key in body && typeof body[key] === "string") {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(Number(id));

  const updated = db.prepare(
    `UPDATE orders SET ${sets.join(", ")} WHERE id = ? RETURNING *`
  ).get(...values) as Order | undefined;

  if (!updated) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      ...updated,
      items: JSON.parse(updated.items),
    },
  });
}
