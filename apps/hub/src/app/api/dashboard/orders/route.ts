import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  LIST_ORDERS_QUERY,
  simplifyOrder,
} from "@/lib/vendure";

/**
 * GET /api/dashboard/orders
 *
 * List orders for the authenticated merchant's Vendure channel.
 * Uses session cookie auth (not Bearer token).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, session.merchantId))
    .limit(1);

  if (!merchant || !merchant.vendureChannelToken) {
    return NextResponse.json(
      { error: "Store is not yet connected" },
      { status: 503 }
    );
  }

  try {
    const data = await vendureAdminQuery<{
      orders: { totalItems: number; items: unknown[] };
    }>(merchant.vendureChannelToken, LIST_ORDERS_QUERY, {
      options: { take: 250, skip: 0, sort: { createdAt: "DESC" } },
    });

    const orders = (data.orders.items || []).map(simplifyOrder);
    return NextResponse.json(orders);
  } catch (err) {
    console.error("[dashboard/orders GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 502 }
    );
  }
}
