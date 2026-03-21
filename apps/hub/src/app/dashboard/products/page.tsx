import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  LIST_PRODUCTS_QUERY,
  simplifyProduct,
} from "@/lib/vendure";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
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

  let products: Array<{
    id: string;
    name: string;
    price: number;
    description: string;
    category: string;
    inStock: boolean;
  }> = [];
  let fetchError = "";

  if (merchant.vendureChannelToken) {
    try {
      const data = await vendureAdminQuery<{
        products: { totalItems: number; items: unknown[] };
      }>(merchant.vendureChannelToken, LIST_PRODUCTS_QUERY, {
        options: { take: 250, skip: 0, sort: { createdAt: "DESC" } },
      });

      products = (data.products.items || []).map(simplifyProduct);
    } catch (err) {
      console.error("[products page]", err);
      fetchError =
        "Could not load products. Please try refreshing the page.";
    }
  } else if (merchant.apiSecret) {
    // Fallback: try the legacy bot API if no vendure channel yet
    try {
      const res = await fetch(
        `https://${merchant.slug}.bot.moolabiz.shop/api/products`,
        {
          headers: { Authorization: `Bearer ${merchant.apiSecret}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        products = Array.isArray(data) ? data : data.products || [];
      } else {
        fetchError =
          "Could not load products from your store. It may still be deploying.";
      }
    } catch {
      fetchError =
        "Could not connect to your store. It may still be deploying.";
    }
  } else {
    fetchError =
      "Your store is still being set up. Products will be available once deployment is complete.";
  }

  return (
    <ProductsClient
      merchant={{
        slug: merchant.slug,
        businessName: merchant.businessName,
        plan: merchant.plan,
        useVendure: !!merchant.vendureChannelToken,
      }}
      initialProducts={products}
      fetchError={fetchError}
    />
  );
}
