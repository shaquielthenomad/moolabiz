import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../_auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/vendure-bridge/settings
 *
 * Update merchant settings. Currently supports:
 * - paymentSecretKey: Payment provider secret key
 *
 * Auth: Bearer token (apiSecret) via authenticateBridgeRequest.
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

  const { paymentSecretKey } = body as { paymentSecretKey?: string };

  if (!paymentSecretKey || typeof paymentSecretKey !== "string") {
    return NextResponse.json(
      { error: "paymentSecretKey (string) is required" },
      { status: 400 }
    );
  }

  try {
    await db
      .update(merchants)
      .set({
        paymentSecretKey,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, auth.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[vendure-bridge/settings POST]", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
