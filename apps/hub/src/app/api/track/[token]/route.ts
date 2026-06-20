import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyTrackToken } from "@/lib/links";
import { vendureAdminQuery } from "@/lib/vendure";

/**
 * GET /api/track/<token>
 *
 * Public order-status lookup behind an HMAC-signed, expiring token (lib/links.ts).
 * The token IS the capability — order codes are never exposed/guessable in the URL,
 * and the token scopes the lookup to one merchant channel.
 *
 * Returns minimal status JSON (no PII). A thin storefront page can render this.
 */

const ORDER_STATUS_QUERY = `
  query TrackOrder($code: String!) {
    orders(options: { filter: { code: { eq: $code } }, take: 1 }) {
      items { code state totalWithTax currencyCode updatedAt }
    }
  }
`;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const claims = verifyTrackToken(token);
  if (!claims) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 401 });
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.slug, claims.slug))
    .limit(1);
  if (!merchant?.vendureChannelToken) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const data = await vendureAdminQuery<{
      orders: {
        items: Array<{
          code: string;
          state: string;
          totalWithTax: number;
          currencyCode: string;
          updatedAt: string;
        }>;
      };
    }>(merchant.vendureChannelToken, ORDER_STATUS_QUERY, { code: claims.orderCode });

    const order = data.orders.items?.[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      orderCode: order.code,
      status: order.state,
      total: order.totalWithTax,
      currency: order.currencyCode,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    console.error("[track]", (err as Error).message);
    return NextResponse.json({ error: "Could not load order status." }, { status: 502 });
  }
}
