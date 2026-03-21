/**
 * Shared auth helper for vendure-bridge routes.
 *
 * Validates the Bearer token (merchant apiSecret), looks up the merchant,
 * and returns the merchant record including vendureChannelToken.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface AuthedMerchant {
  id: string;
  slug: string;
  businessName: string;
  plan: string;
  vendureChannelToken: string;
}

/**
 * Extract Bearer token, look up the merchant, ensure they have a
 * vendureChannelToken. Returns the merchant or an error NextResponse.
 */
export async function authenticateBridgeRequest(
  request: NextRequest
): Promise<AuthedMerchant | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json(
      { error: "Empty bearer token" },
      { status: 401 }
    );
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.apiSecret, token))
    .limit(1);

  if (!merchant) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    );
  }

  if (!merchant.vendureChannelToken) {
    return NextResponse.json(
      { error: "Store is still being set up. Please try again later." },
      { status: 503 }
    );
  }

  return {
    id: merchant.id,
    slug: merchant.slug,
    businessName: merchant.businessName,
    plan: merchant.plan,
    vendureChannelToken: merchant.vendureChannelToken,
  };
}

/** Type guard — true if the value is an error response rather than a merchant */
export function isErrorResponse(
  v: AuthedMerchant | NextResponse
): v is NextResponse {
  return v instanceof NextResponse;
}
