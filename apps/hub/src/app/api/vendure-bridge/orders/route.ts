import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../_auth";
import {
  vendureAdminQuery,
  LIST_ORDERS_QUERY,
  simplifyOrder,
} from "@/lib/vendure";

/**
 * GET /api/vendure-bridge/orders
 *
 * List orders for the authenticated merchant's channel.
 * Query params:
 *   - take (number, default 50)
 *   - skip (number, default 0)
 *   - state (string, e.g. "AddingItems", "ArrangingPayment", "PaymentSettled")
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("take")) || 50, 250);
  const skip = Number(url.searchParams.get("skip")) || 0;
  const state = url.searchParams.get("state");

  try {
    const options: Record<string, unknown> = {
      take,
      skip,
      sort: { createdAt: "DESC" },
    };

    if (state) {
      options.filter = { state: { eq: state } };
    }

    const data = await vendureAdminQuery<{
      orders: { totalItems: number; items: unknown[] };
    }>(auth.vendureChannelToken, LIST_ORDERS_QUERY, { options });

    const orders = (data.orders.items || []).map(simplifyOrder);
    return NextResponse.json({
      total: data.orders.totalItems,
      orders,
    });
  } catch (err) {
    console.error("[vendure-bridge/orders GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 502 }
    );
  }
}
