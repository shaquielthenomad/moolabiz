import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  LIST_ORDERS_QUERY,
  simplifyOrder,
  SimpleOrder,
} from "@/lib/vendure";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, session.merchantId))
    .limit(1);

  if (!merchant) {
    redirect("/login");
  }

  let orders: SimpleOrder[] = [];
  let fetchError = "";

  if (merchant.vendureChannelToken) {
    try {
      const data = await vendureAdminQuery<{
        orders: { totalItems: number; items: unknown[] };
      }>(merchant.vendureChannelToken, LIST_ORDERS_QUERY, {
        options: { take: 250, skip: 0, sort: { createdAt: "DESC" } },
      });

      orders = (data.orders.items || []).map(simplifyOrder);
    } catch (err) {
      console.error("[orders page]", err);
      fetchError =
        "Could not load orders. Please try refreshing the page.";
    }
  } else if (merchant.apiSecret) {
    // Fallback: try the legacy bot API if no vendure channel yet
    try {
      const res = await fetch(
        `https://${merchant.slug}.bot.moolabiz.shop/api/orders`,
        {
          headers: { Authorization: `Bearer ${merchant.apiSecret}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        orders = Array.isArray(data) ? data : data.orders || [];
      } else {
        fetchError =
          "Could not load orders from your store. It may still be deploying.";
      }
    } catch {
      fetchError =
        "Could not connect to your store. It may still be deploying.";
    }
  } else {
    fetchError =
      "Your store is still being set up. Orders will be available once deployment is complete.";
  }

  return (
    <OrdersClient
      merchant={{
        slug: merchant.slug,
        businessName: merchant.businessName,
        useVendure: !!merchant.vendureChannelToken,
      }}
      initialOrders={orders}
      fetchError={fetchError}
    />
  );
}
