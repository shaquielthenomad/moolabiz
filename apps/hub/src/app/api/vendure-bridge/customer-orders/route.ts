import { NextRequest, NextResponse } from "next/server";
import { authenticateBridgeRequest, isErrorResponse } from "../_auth";
import { vendureAdminQuery, simplifyOrder } from "@/lib/vendure";

/**
 * GET /api/vendure-bridge/customer-orders?phone=<E164>&take=20
 *
 * Returns the orders belonging to ONE customer (matched by phone) within the
 * authenticated merchant's Vendure channel. Powers the WhatsApp shop agent's
 * read-only "my orders" / "order status" tools.
 *
 * SECURITY MODEL
 * - The caller (the bot) authenticates as the MERCHANT (Bearer apiSecret), which
 *   scopes the query to the merchant's Vendure channel.
 * - `phone` MUST be the TRUSTED WhatsApp sender (OpenClaw's requesterSenderId).
 *   The shop tool never lets the model or customer choose a number — that is the
 *   whole point of self-scoping.
 * - We additionally filter returned orders to the merchant's OWN channel token, so
 *   a customer who also shops at another MoolaBiz merchant cannot see those orders
 *   through this endpoint.
 */

const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrders($filter: CustomerFilterParameter!, $take: Int!) {
    customers(options: { filter: $filter, take: 1 }) {
      items {
        id
        firstName
        lastName
        phoneNumber
        orders(options: { take: $take, sort: { createdAt: DESC } }) {
          totalItems
          items {
            id
            code
            state
            totalWithTax
            currencyCode
            createdAt
            channels { token }
            customer { firstName lastName phoneNumber }
            lines { quantity linePriceWithTax productVariant { name product { name } } }
            shippingAddress { fullName streetLine1 city province postalCode phoneNumber }
          }
        }
      }
    }
  }
`;

/** Build plausible stored-format variants of an E.164 number (SA-aware). */
function phoneCandidates(input: string): string[] {
  const digits = input.replace(/[^0-9]/g, "");
  if (!digits) return [];
  const set = new Set<string>([input.trim(), `+${digits}`, digits]);
  if (digits.startsWith("27") && digits.length >= 11) {
    set.add(`0${digits.slice(2)}`); // +2782… -> 082…
  } else if (digits.startsWith("0") && digits.length >= 10) {
    set.add(`+27${digits.slice(1)}`);
    set.add(`27${digits.slice(1)}`);
  }
  return [...set].filter(Boolean);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") || "").trim();
  const take = Math.min(Number(url.searchParams.get("take")) || 20, 50);

  if (!phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const candidates = phoneCandidates(phone);
  if (!candidates.length) {
    return NextResponse.json({ customer: null, total: 0, orders: [] });
  }

  try {
    const data = await vendureAdminQuery<{
      customers: {
        items: Array<{
          firstName?: string;
          lastName?: string;
          phoneNumber?: string;
          orders: { totalItems: number; items: Array<{ channels?: Array<{ token?: string }> }> };
        }>;
      };
    }>(auth.vendureChannelToken, CUSTOMER_ORDERS_QUERY, {
      filter: { phoneNumber: { in: candidates } },
      take,
    });

    const customer = data.customers.items?.[0];
    if (!customer) {
      return NextResponse.json({ customer: null, total: 0, orders: [] });
    }

    // Defensive channel scoping: only return orders that belong to THIS merchant's
    // channel, even if Vendure's Customer.orders surfaces cross-channel history.
    const ownOrders = (customer.orders?.items || []).filter((o) =>
      (o.channels || []).some((c) => c?.token === auth.vendureChannelToken),
    );

    const orders = ownOrders.map(simplifyOrder);
    return NextResponse.json({
      customer: {
        name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || null,
        phone: customer.phoneNumber || null,
      },
      total: orders.length,
      orders,
    });
  } catch (err) {
    console.error("[vendure-bridge/customer-orders GET]", err);
    return NextResponse.json({ error: "Failed to fetch your orders" }, { status: 502 });
  }
}
