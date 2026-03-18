import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

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

  let orders: Order[] = [];
  let fetchError = "";

  if (merchant.apiSecret) {
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
        fetchError = "Could not load orders from your store. It may still be deploying.";
      }
    } catch {
      fetchError = "Could not connect to your store. It may still be deploying.";
    }
  } else {
    fetchError = "Your store is still being set up. Orders will be available once deployment is complete.";
  }

  return (
    <OrdersClient
      merchant={{
        slug: merchant.slug,
        businessName: merchant.businessName,
        apiSecret: merchant.apiSecret || "",
      }}
      initialOrders={orders}
      fetchError={fetchError}
    />
  );
}
