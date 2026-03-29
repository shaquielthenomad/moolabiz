import { NextRequest, NextResponse } from "next/server";
import { getMerchantFromSession, isDashboardAuthError } from "../../_auth";
import {
  vendureAdminQuery,
  LIST_ORDERS_QUERY,
  TRANSITION_ORDER_STATE_MUTATION,
  SETTLE_PAYMENT_MUTATION,
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
 * Two actions are supported via the request body:
 *
 * 1. State transition:
 *    Body: { state: "Shipped" | "Delivered" | "Cancelled" }
 *    Transitions the order to the given fulfillment state.
 *
 * 2. Settle payment (COD "Mark as Paid"):
 *    Body: { action: "settle" }
 *    Settles the order's Authorized payment, which moves the order from
 *    PaymentAuthorized → PaymentSettled. Used when the merchant collects cash.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await getMerchantFromSession();
  if (isDashboardAuthError(auth)) return auth;

  const { vendureChannelToken } = auth;
  const { code } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Look up the order (needed for both actions) ──────────────────────────
  try {
    const listData = await vendureAdminQuery<{
      orders: {
        items: Array<{
          id: string;
          code: string;
          state: string;
          payments?: Array<{ id: string; state: string }>;
        }>;
      };
    }>(vendureChannelToken, LIST_ORDERS_QUERY, {
      options: {
        take: 1,
        filter: { code: { eq: code } },
      },
    });

    const order = listData.orders.items[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ── Action: settle COD payment ─────────────────────────────────────────
    if ((body as { action?: string }).action === "settle") {
      // Find the Authorized payment on this order
      const authorizedPayment = order.payments?.find(
        (p) => p.state === "Authorized"
      );

      if (!authorizedPayment) {
        return NextResponse.json(
          {
            error:
              "No authorized payment found on this order. It may already be settled or not yet authorized.",
          },
          { status: 422 }
        );
      }

      // Settle the payment — Vendure will automatically advance the order to
      // PaymentSettled once all payments are settled.
      const settleResult = await vendureAdminQuery<{
        settlePayment: {
          id?: string;
          state?: string;
          errorCode?: string;
          message?: string;
        };
      }>(vendureChannelToken, SETTLE_PAYMENT_MUTATION, {
        id: authorizedPayment.id,
      });

      const settled = settleResult.settlePayment;
      if (settled.errorCode) {
        return NextResponse.json(
          { error: settled.message || "Failed to settle payment" },
          { status: 422 }
        );
      }

      // Return the updated order state (PaymentSettled after settle)
      return NextResponse.json({
        id: order.id,
        code: order.code,
        state: "PaymentSettled",
        paymentId: settled.id,
        paymentState: settled.state,
      });
    }

    // ── Action: state transition ───────────────────────────────────────────
    const { state } = body as { state?: string };
    if (!state || !ALLOWED_TRANSITIONS.has(state)) {
      return NextResponse.json(
        {
          error: `Invalid request. Provide { state: "${[...ALLOWED_TRANSITIONS].join('" | "')}" } or { action: "settle" }`,
        },
        { status: 400 }
      );
    }

    const result = await vendureAdminQuery<{
      transitionOrderToState: {
        id?: string;
        code?: string;
        state?: string;
        errorCode?: string;
        message?: string;
        transitionError?: string;
      };
    }>(vendureChannelToken, TRANSITION_ORDER_STATE_MUTATION, {
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
