import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  LIST_PRODUCTS_QUERY,
  CREATE_PRODUCT_MUTATION,
  CREATE_PRODUCT_VARIANTS_MUTATION,
  GET_PRODUCT_QUERY,
  simplifyProduct,
} from "@/lib/vendure";

/**
 * GET /api/dashboard/products
 *
 * Called by the dashboard products page.
 * Uses session cookie auth (not Bearer token).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  try {
    const data = await vendureAdminQuery<{
      products: { totalItems: number; items: unknown[] };
    }>(merchant.vendureChannelToken, LIST_PRODUCTS_QUERY, {
      options: { take: 250, skip: 0, sort: { createdAt: "DESC" } },
    });

    const products = (data.products.items || []).map(simplifyProduct);
    return NextResponse.json(products);
  } catch (err) {
    console.error("[dashboard/products GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 502 }
    );
  }
}

/**
 * POST /api/dashboard/products
 *
 * Create a product from the dashboard.
 * Body: { name, price, description?, category? }
 * Price is in cents.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const { name, price, description, category } = body as {
    name?: string;
    price?: number;
    description?: string;
    category?: string;
  };

  if (!name || typeof price !== "number" || price < 0) {
    return NextResponse.json(
      { error: "name and price are required" },
      { status: 400 }
    );
  }

  try {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36);

    const productData = await vendureAdminQuery<{
      createProduct: { id: string };
    }>(merchant.vendureChannelToken, CREATE_PRODUCT_MUTATION, {
      input: {
        enabled: true,
        translations: [
          {
            languageCode: "en",
            name,
            slug,
            description: description || "",
          },
        ],
      },
    });

    const productId = productData.createProduct.id;

    await vendureAdminQuery(
      merchant.vendureChannelToken,
      CREATE_PRODUCT_VARIANTS_MUTATION,
      {
        input: [
          {
            productId,
            sku: slug,
            price,
            stockOnHand: 100,
            trackInventory: "TRUE",
            translations: [{ languageCode: "en", name }],
          },
        ],
      }
    );

    const full = await vendureAdminQuery<{ product: unknown }>(
      merchant.vendureChannelToken,
      GET_PRODUCT_QUERY,
      { id: productId }
    );

    const simplified = simplifyProduct(full.product);
    if (category && !simplified.category) {
      simplified.category = category;
    }

    return NextResponse.json(simplified, { status: 201 });
  } catch (err) {
    console.error("[dashboard/products POST]", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 502 }
    );
  }
}
