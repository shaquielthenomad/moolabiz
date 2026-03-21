import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  vendureAdminQuery,
  uploadAssetToVendure,
  GET_PRODUCT_QUERY,
  UPDATE_PRODUCT_MUTATION,
  UPDATE_PRODUCT_VARIANTS_MUTATION,
  DELETE_PRODUCT_MUTATION,
  simplifyProduct,
} from "@/lib/vendure";

type RouteContext = { params: Promise<{ id: string }> };

async function getMerchantChannel() {
  const session = await getSession();
  if (!session) return null;

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, session.merchantId))
    .limit(1);

  if (!merchant?.vendureChannelToken) return null;
  return merchant;
}

/**
 * PATCH /api/dashboard/products/:id
 *
 * Update a product from the dashboard.
 * Body may contain: { name?, price?, description?, category?, inStock? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const merchant = await getMerchantChannel();
  if (!merchant) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  let name: string | undefined;
  let description: string | undefined;
  let inStock: boolean | undefined;
  let price: number | undefined;
  let category: string | undefined;
  let sku: string | undefined;
  let stockQuantity: number | undefined;
  let imageFile: File | null = null;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const nameVal = formData.get("name") as string | null;
      if (nameVal) name = nameVal;
      const priceVal = formData.get("price") as string | null;
      if (priceVal) price = Number(priceVal);
      const descVal = formData.get("description") as string | null;
      if (descVal !== null) description = descVal;
      const catVal = formData.get("category") as string | null;
      if (catVal) category = catVal;
      const skuVal = formData.get("sku") as string | null;
      if (skuVal) sku = skuVal;
      const stockVal = formData.get("stockQuantity") as string | null;
      if (stockVal) stockQuantity = Number(stockVal);
      const inStockVal = formData.get("inStock") as string | null;
      if (inStockVal !== null) inStock = inStockVal === "true";
      const file = formData.get("image");
      if (file && file instanceof File && file.size > 0) {
        imageFile = file;
      }
    } else {
      const body = await request.json();
      name = body.name;
      description = body.description;
      inStock = body.inStock;
      price = body.price;
      category = body.category;
      sku = body.sku;
      stockQuantity = body.stockQuantity;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const current = await vendureAdminQuery<{
      product: { id: string; variants: Array<{ id: string }> } | null;
    }>(merchant.vendureChannelToken!, GET_PRODUCT_QUERY, { id });

    if (!current.product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Upload image asset if provided
    let featuredAssetId: string | undefined;
    if (imageFile) {
      try {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const result = await uploadAssetToVendure(
          merchant.vendureChannelToken!,
          buffer,
          imageFile.name || `product-${id}.jpg`,
          imageFile.type || "image/jpeg"
        );
        featuredAssetId = result.assetId;
      } catch (uploadErr) {
        console.error("[dashboard/products PATCH] Image upload failed:", uploadErr);
      }
    }

    // Update product-level fields
    const hasProductUpdates =
      name !== undefined || description !== undefined || inStock !== undefined || featuredAssetId;

    if (hasProductUpdates) {
      const translations: Record<string, unknown>[] = [];
      if (name !== undefined || description !== undefined) {
        const t: Record<string, unknown> = { languageCode: "en" };
        if (name !== undefined) t.name = name;
        if (description !== undefined) t.description = description;
        translations.push(t);
      }

      const updateInput: Record<string, unknown> = { id };
      if (translations.length) updateInput.translations = translations;
      if (inStock !== undefined) updateInput.enabled = inStock;
      if (featuredAssetId) {
        updateInput.featuredAssetId = featuredAssetId;
        updateInput.assetIds = [featuredAssetId];
      }

      await vendureAdminQuery(
        merchant.vendureChannelToken!,
        UPDATE_PRODUCT_MUTATION,
        { input: updateInput }
      );
    }

    // Update variant-level fields
    const hasVariantUpdates =
      price !== undefined || inStock !== undefined || sku !== undefined || stockQuantity !== undefined;

    if (hasVariantUpdates && current.product.variants.length > 0) {
      const variantId = current.product.variants[0].id;
      const variantInput: Record<string, unknown> = { id: variantId };
      if (price !== undefined) variantInput.price = price;
      if (sku !== undefined) variantInput.sku = sku;
      if (stockQuantity !== undefined) variantInput.stockOnHand = stockQuantity;
      if (inStock !== undefined) variantInput.enabled = inStock;
      if (inStock === false && stockQuantity === undefined) variantInput.stockOnHand = 0;
      if (inStock === true && stockQuantity === undefined) variantInput.stockOnHand = 100;

      await vendureAdminQuery(
        merchant.vendureChannelToken!,
        UPDATE_PRODUCT_VARIANTS_MUTATION,
        { input: [variantInput] }
      );
    }

    // Fetch updated product
    const updated = await vendureAdminQuery<{ product: unknown }>(
      merchant.vendureChannelToken!,
      GET_PRODUCT_QUERY,
      { id }
    );

    const simplified = simplifyProduct(updated.product);
    if (category) simplified.category = category;
    return NextResponse.json(simplified);
  } catch (err) {
    console.error("[dashboard/products PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 502 }
    );
  }
}

/**
 * DELETE /api/dashboard/products/:id
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const merchant = await getMerchantChannel();
  if (!merchant) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Verify the product exists in the merchant's channel before deleting
    const check = await vendureAdminQuery<{
      product: { id: string } | null;
    }>(merchant.vendureChannelToken!, GET_PRODUCT_QUERY, { id });

    if (!check.product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const data = await vendureAdminQuery<{
      deleteProduct: { result: string; message?: string };
    }>(merchant.vendureChannelToken!, DELETE_PRODUCT_MUTATION, { id });

    if (data.deleteProduct.result === "DELETED") {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: data.deleteProduct.message || "Could not delete product" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[dashboard/products DELETE]", err);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 502 }
    );
  }
}
