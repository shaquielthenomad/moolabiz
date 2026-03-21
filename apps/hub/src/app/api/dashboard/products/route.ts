import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  uploadAssetToVendure,
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
 * Accepts either JSON body or FormData (when an image is included).
 *
 * JSON body: { name, price, description?, category? }
 * FormData fields: name, price (cents), description?, category?, image? (File)
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

  let name: string | undefined;
  let price: number | undefined;
  let description: string | undefined;
  let category: string | undefined;
  let imageFile: File | null = null;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      name = formData.get("name") as string | undefined;
      const priceStr = formData.get("price") as string | undefined;
      price = priceStr ? Number(priceStr) : undefined;
      description = (formData.get("description") as string) || undefined;
      category = (formData.get("category") as string) || undefined;
      const file = formData.get("image");
      if (file && file instanceof File && file.size > 0) {
        imageFile = file;
      }
    } else {
      const body = await request.json();
      name = body.name;
      price = body.price;
      description = body.description;
      category = body.category;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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

    // Upload image asset if provided
    let featuredAssetId: string | undefined;
    if (imageFile) {
      if (imageFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image too large. Maximum size is 10MB." },
          { status: 400 }
        );
      }
      try {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const result = await uploadAssetToVendure(
          merchant.vendureChannelToken,
          buffer,
          imageFile.name || `${slug}.jpg`,
          imageFile.type || "image/jpeg"
        );
        featuredAssetId = result.assetId;
      } catch (uploadErr) {
        console.error("[dashboard/products POST] Image upload failed:", uploadErr);
        // Continue without image — product creation should still succeed
      }
    }

    const productInput: Record<string, unknown> = {
      enabled: true,
      translations: [
        {
          languageCode: "en",
          name,
          slug,
          description: description || "",
        },
      ],
    };
    if (featuredAssetId) {
      productInput.featuredAssetId = featuredAssetId;
      productInput.assetIds = [featuredAssetId];
    }

    const productData = await vendureAdminQuery<{
      createProduct: { id: string };
    }>(merchant.vendureChannelToken, CREATE_PRODUCT_MUTATION, {
      input: productInput,
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
