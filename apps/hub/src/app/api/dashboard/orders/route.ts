import { NextResponse } from "next/server";
import { getMerchantFromSession, isDashboardAuthError } from "../_auth";
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
  const auth = await getMerchantFromSession();
  if (isDashboardAuthError(auth)) return auth;

  const { vendureChannelToken } = auth;

  try {
    const data = await vendureAdminQuery<{
      orders: { totalItems: number; items: unknown[] };
    }>(vendureChannelToken, LIST_ORDERS_QUERY, {
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
