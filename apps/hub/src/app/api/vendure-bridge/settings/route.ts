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
 * - yocoSecretKey: Yoco payment secret key
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

  const { yocoSecretKey } = body as { yocoSecretKey?: string };

  if (!yocoSecretKey || typeof yocoSecretKey !== "string") {
    return NextResponse.json(
      { error: "yocoSecretKey (string) is required" },
      { status: 400 }
    );
  }

  try {
    await db
      .update(merchants)
      .set({
        yocoSecretKey,
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
