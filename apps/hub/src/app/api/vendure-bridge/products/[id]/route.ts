import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../../_auth";
import {
  vendureAdminQuery,
  GET_PRODUCT_QUERY,
  UPDATE_PRODUCT_MUTATION,
  UPDATE_PRODUCT_VARIANTS_MUTATION,
  DELETE_PRODUCT_MUTATION,
  simplifyProduct,
} from "@/lib/vendure";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/vendure-bridge/products/:id
 *
 * Update a product. Body may contain:
 * { name?, price?, description?, inStock?, stockQuantity?, sku? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // Fetch current product to get variant IDs
    const current = await vendureAdminQuery<{ product: { id: string; variants: Array<{ id: string }> } }>(
      auth.vendureChannelToken,
      GET_PRODUCT_QUERY,
      { id }
    );

    if (!current.product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Update product-level fields if name or description changed
    const { name, description, inStock } = body as {
      name?: string;
      description?: string;
      inStock?: boolean;
    };

    const hasProductUpdates = name !== undefined || description !== undefined || inStock !== undefined;

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

      await vendureAdminQuery(
        auth.vendureChannelToken,
        UPDATE_PRODUCT_MUTATION,
        { input: updateInput }
      );
    }

    // Update variant-level fields (price, stock, sku) on the default variant
    const { price, stockQuantity, sku } = body as {
      price?: number;
      stockQuantity?: number;
      sku?: string;
    };

    const hasVariantUpdates =
      price !== undefined || stockQuantity !== undefined || sku !== undefined || inStock !== undefined;

    if (hasVariantUpdates && current.product.variants.length > 0) {
      const variantId = current.product.variants[0].id;
      const variantInput: Record<string, unknown> = { id: variantId };
      if (price !== undefined) variantInput.price = price;
      if (stockQuantity !== undefined) variantInput.stockOnHand = stockQuantity;
      if (sku !== undefined) variantInput.sku = sku;
      if (inStock !== undefined) variantInput.enabled = inStock;

      // If toggling to out-of-stock, set stock to 0
      if (inStock === false && stockQuantity === undefined) {
        variantInput.stockOnHand = 0;
      }
      // If toggling to in-stock and stock was 0, bump to 1
      if (inStock === true && stockQuantity === undefined) {
        variantInput.stockOnHand = 100;
      }

      await vendureAdminQuery(
        auth.vendureChannelToken,
        UPDATE_PRODUCT_VARIANTS_MUTATION,
        { input: [variantInput] }
      );
    }

    // Fetch updated product
    const updated = await vendureAdminQuery<{ product: unknown }>(
      auth.vendureChannelToken,
      GET_PRODUCT_QUERY,
      { id }
    );

    return NextResponse.json(simplifyProduct(updated.product));
  } catch (err) {
    console.error("[vendure-bridge/products PATCH]", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 502 }
    );
  }
}

/**
 * DELETE /api/vendure-bridge/products/:id
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    // Verify the product exists in the merchant's channel before deleting
    const check = await vendureAdminQuery<{
      product: { id: string } | null;
    }>(auth.vendureChannelToken, GET_PRODUCT_QUERY, { id });

    if (!check.product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const data = await vendureAdminQuery<{
      deleteProduct: { result: string; message?: string };
    }>(auth.vendureChannelToken, DELETE_PRODUCT_MUTATION, { id });

    if (data.deleteProduct.result === "DELETED") {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: data.deleteProduct.message || "Could not delete product" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[vendure-bridge/products DELETE]", err);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 502 }
    );
  }
}
