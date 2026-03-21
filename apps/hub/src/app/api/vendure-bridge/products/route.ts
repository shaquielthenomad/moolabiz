import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../_auth";
import {
  vendureAdminQuery,
  LIST_PRODUCTS_QUERY,
  CREATE_PRODUCT_MUTATION,
  CREATE_PRODUCT_VARIANTS_MUTATION,
  simplifyProduct,
} from "@/lib/vendure";

/**
 * GET /api/vendure-bridge/products
 *
 * List all products for the authenticated merchant's channel.
 * Query params:
 *   - take (number, default 100)
 *   - skip (number, default 0)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("take")) || 100, 250);
  const skip = Number(url.searchParams.get("skip")) || 0;

  try {
    const data = await vendureAdminQuery<{
      products: { totalItems: number; items: unknown[] };
    }>(auth.vendureChannelToken, LIST_PRODUCTS_QUERY, {
      options: { take, skip, sort: { createdAt: "DESC" } },
    });

    const products = (data.products.items || []).map(simplifyProduct);
    return NextResponse.json(products);
  } catch (err) {
    console.error("[vendure-bridge/products GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 502 }
    );
  }
}

/**
 * POST /api/vendure-bridge/products
 *
 * Create a product. Body:
 * {
 *   name: string           (required)
 *   price: number           (required, in cents)
 *   description?: string
 *   category?: string
 *   sku?: string
 *   stockQuantity?: number
 *   variants?: Array<{ name: string, price: number, sku?: string }>
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, price, description, category, sku, stockQuantity, variants } =
    body as {
      name?: string;
      price?: number;
      description?: string;
      category?: string;
      sku?: string;
      stockQuantity?: number;
      variants?: Array<{ name: string; price: number; sku?: string }>;
    };

  if (!name || typeof price !== "number" || price < 0) {
    return NextResponse.json(
      { error: "name (string) and price (number, in cents) are required" },
      { status: 400 }
    );
  }

  try {
    // 1. Create the product shell
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      + "-" + Date.now().toString(36);

    const productData = await vendureAdminQuery<{
      createProduct: { id: string; name: string };
    }>(auth.vendureChannelToken, CREATE_PRODUCT_MUTATION, {
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

    // 2. Create variant(s)
    let variantInputs: Array<Record<string, unknown>>;

    if (variants && variants.length > 0) {
      // Multiple variants provided
      variantInputs = variants.map((v, i) => ({
        productId,
        sku: v.sku || `${slug}-${i + 1}`,
        price: v.price,
        stockOnHand: typeof stockQuantity === "number" ? stockQuantity : 100,
        trackInventory: "TRUE",
        translations: [{ languageCode: "en", name: v.name }],
      }));
    } else {
      // Single default variant
      variantInputs = [
        {
          productId,
          sku: sku || slug,
          price,
          stockOnHand: typeof stockQuantity === "number" ? stockQuantity : 100,
          trackInventory: "TRUE",
          translations: [{ languageCode: "en", name }],
        },
      ];
    }

    await vendureAdminQuery(
      auth.vendureChannelToken,
      CREATE_PRODUCT_VARIANTS_MUTATION,
      { input: variantInputs }
    );

    // 3. Fetch back the full product to return simplified
    const { default: fullQuery } = await import("@/lib/vendure").then((m) => ({
      default: m.GET_PRODUCT_QUERY,
    }));
    const full = await vendureAdminQuery<{ product: unknown }>(
      auth.vendureChannelToken,
      fullQuery,
      { id: productId }
    );

    const simplified = simplifyProduct(full.product);
    // If the caller sent a category label, include it even if there is
    // no Vendure collection mapping yet (bot workflow may not use collections).
    if (category && !simplified.category) {
      simplified.category = category;
    }

    return NextResponse.json(simplified, { status: 201 });
  } catch (err) {
    console.error("[vendure-bridge/products POST]", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 502 }
    );
  }
}
