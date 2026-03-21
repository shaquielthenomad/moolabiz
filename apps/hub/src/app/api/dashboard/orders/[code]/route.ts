import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  LIST_ORDERS_QUERY,
  TRANSITION_ORDER_STATE_MUTATION,
  simplifyOrder,
} from "@/lib/vendure";

// Allowed target states for dashboard users
const ALLOWED_TRANSITIONS = new Set([
  "Shipped",
  "Delivered",
  "Cancelled",
]);

/**
 * PATCH /api/dashboard/orders/[code]
 *
 * Transition an order to a new state.
 * Body: { state: "Shipped" | "Delivered" | "Cancelled" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { code } = await params;

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { state } = body as { state?: string };
  if (!state || !ALLOWED_TRANSITIONS.has(state)) {
    return NextResponse.json(
      { error: `Invalid state. Allowed: ${[...ALLOWED_TRANSITIONS].join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Look up the order by code within the merchant's channel
    const listData = await vendureAdminQuery<{
      orders: { items: Array<{ id: string; code: string; state: string }> };
    }>(merchant.vendureChannelToken, LIST_ORDERS_QUERY, {
      options: {
        take: 1,
        filter: { code: { eq: code } },
      },
    });

    const order = listData.orders.items[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Transition the order state
    const result = await vendureAdminQuery<{
      transitionOrderToState: {
        id?: string;
        code?: string;
        state?: string;
        errorCode?: string;
        message?: string;
        transitionError?: string;
      };
    }>(merchant.vendureChannelToken, TRANSITION_ORDER_STATE_MUTATION, {
      id: order.id,
      state,
    });

    const transition = result.transitionOrderToState;
    if (transition.errorCode) {
      return NextResponse.json(
        {
          error: transition.message || "State transition failed",
          detail: transition.transitionError,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      id: transition.id,
      code: transition.code,
      state: transition.state,
    });
  } catch (err) {
    console.error("[dashboard/orders PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 502 }
    );
  }
}
