/**
 * Settle a Vendure order (by code) after an EXTERNAL PSP payment (e.g. a Yoco
 * payment link). The money flowed merchant<-customer via the merchant's own PSP;
 * here we only record it in Vendure so the order moves to PaymentSettled and the
 * customer's order status reflects reality.
 *
 * Idempotent: if the order is already settled (or further), it no-ops.
 *
 * TODO-verify against your Vendure order process + payment methods:
 *  - addManualPaymentToOrder requires the order in `ArrangingPayment` and a manual
 *    payment method `code` that exists in the channel. Create a "yoco-link" manual
 *    method per channel at provisioning, OR pass the existing COD/EFT method code.
 *  - State names (ArrangingPayment / PaymentSettled) assume the default process.
 */

import { vendureAdminQuery } from "@/lib/vendure";

const GET_ORDER_STATE = `
  query OrderState($code: String!) {
    orders(options: { filter: { code: { eq: $code } }, take: 1 }) {
      items { id code state totalWithTax }
    }
  }
`;

const TRANSITION_ORDER = `
  mutation Transition($id: ID!, $state: String!) {
    transitionOrderToState(id: $id, state: $state) {
      __typename
      ... on Order { id state }
      ... on OrderStateTransitionError { errorCode message transitionError fromState toState }
    }
  }
`;

const ADD_MANUAL_PAYMENT = `
  mutation AddManualPayment($input: ManualPaymentInput!) {
    addManualPaymentToOrder(input: $input) {
      __typename
      ... on Order { id state payments { id state amount } }
      ... on ErrorResult { errorCode message }
    }
  }
`;

const SETTLED_OR_BEYOND = new Set(["PaymentSettled", "PartiallyShipped", "Shipped", "Delivered"]);

export interface SettleResult {
  ok: boolean;
  alreadySettled?: boolean;
  state?: string;
  error?: string;
}

export async function settleOrderByCode(
  channelToken: string,
  orderCode: string,
  opts: { method?: string; transactionId?: string; metadata?: Record<string, unknown> } = {},
): Promise<SettleResult> {
  const data = await vendureAdminQuery<{
    orders: { items: Array<{ id: string; code: string; state: string }> };
  }>(channelToken, GET_ORDER_STATE, { code: orderCode });

  const order = data.orders.items?.[0];
  if (!order) return { ok: false, error: "order not found" };
  if (SETTLED_OR_BEYOND.has(order.state)) {
    return { ok: true, alreadySettled: true, state: order.state };
  }

  // Move into ArrangingPayment if it isn't already there.
  if (order.state !== "ArrangingPayment") {
    const t = await vendureAdminQuery<{
      transitionOrderToState: { __typename: string; state?: string; message?: string };
    }>(channelToken, TRANSITION_ORDER, { id: order.id, state: "ArrangingPayment" });
    if (t.transitionOrderToState.__typename !== "Order") {
      // Non-fatal here — addManualPayment below will surface a precise error if the
      // order genuinely can't accept payment. (A transition failure is often just
      // "already past ArrangingPayment", which the SETTLED_OR_BEYOND guard handles.)
    }
  }

  const m = await vendureAdminQuery<{
    addManualPaymentToOrder: { __typename: string; state?: string; message?: string };
  }>(channelToken, ADD_MANUAL_PAYMENT, {
    input: {
      orderId: order.id,
      method: opts.method || "yoco-link",
      transactionId: opts.transactionId || `yoco-${Date.now()}`,
      metadata: opts.metadata || {},
    },
  });

  if (m.addManualPaymentToOrder.__typename !== "Order") {
    return { ok: false, error: m.addManualPaymentToOrder.message || m.addManualPaymentToOrder.__typename };
  }
  return { ok: true, state: m.addManualPaymentToOrder.state };
}
