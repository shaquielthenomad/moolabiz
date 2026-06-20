/**
 * POST /api/vendure-bridge/payment-link
 *
 * Creates a Yoco hosted-checkout URL for a merchant order and returns it so
 * the shop agent can send it to the customer via WhatsApp.
 *
 * Auth: Bearer <merchant apiSecret>  (same pattern as all vendure-bridge routes)
 *
 * Request body (JSON):
 *   {
 *     orderCode?:   string   // Vendure order code, used as the Yoco reference
 *     amountCents?: number   // override the order total (integer >= 200); usually
 *                            // omitted — the route validates the amount you pass
 *                            // but does NOT fetch the live order total itself
 *                            // (the shop agent already knows it from list-orders).
 *     currency?:    string   // default "ZAR" (Yoco only supports ZAR today)
 *   }
 *
 * Response 200:
 *   { url: string, checkoutId: string }
 *
 * Error responses:
 *   401 — missing / invalid Bearer token
 *   409 — merchant has not connected their payment provider yet
 *   422 — validation error (missing amount, amount too small, etc.)
 *   502 — Yoco API returned an error
 *
 * Security notes:
 *  - The decrypted payment secret key is NEVER returned or logged.
 *  - The query is scoped to the authenticated merchant (auth.id) — a merchant
 *    cannot generate a link for another merchant.
 *  - Amount validation prevents zero/negative/sub-minimum charges.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret, isEncrypted } from "@/lib/crypto";
import { createYocoPaymentLink } from "@/lib/yoco";
import {
  authenticateBridgeRequest,
  isErrorResponse,
} from "../_auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_AMOUNT_CENTS = 200; // R2.00 — Yoco minimum
const MAX_AMOUNT_CENTS = 100_000_00; // R100,000 — sanity cap (100k ZAR in cents)
const DEFAULT_CURRENCY = "ZAR";

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // --- 1. Authenticate the merchant ---
  const auth = await authenticateBridgeRequest(request);
  if (isErrorResponse(auth)) return auth;

  // --- 2. Parse and validate request body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const raw = body as Record<string, unknown>;

  // orderCode: optional; used as Yoco reference if provided
  const orderCode =
    typeof raw.orderCode === "string" && raw.orderCode.trim()
      ? raw.orderCode.trim()
      : undefined;

  // amountCents: required
  if (raw.amountCents === undefined || raw.amountCents === null) {
    return NextResponse.json(
      { error: "amountCents is required" },
      { status: 422 }
    );
  }

  const amountCents = Number(raw.amountCents);

  if (!Number.isInteger(amountCents)) {
    return NextResponse.json(
      { error: "amountCents must be an integer" },
      { status: 422 }
    );
  }

  if (amountCents < MIN_AMOUNT_CENTS) {
    return NextResponse.json(
      {
        error: `amountCents must be >= ${MIN_AMOUNT_CENTS} (R${(MIN_AMOUNT_CENTS / 100).toFixed(2)} — Yoco minimum)`,
      },
      { status: 422 }
    );
  }

  if (amountCents > MAX_AMOUNT_CENTS) {
    return NextResponse.json(
      {
        error: `amountCents must be <= ${MAX_AMOUNT_CENTS} (R${(MAX_AMOUNT_CENTS / 100).toFixed(2)})`,
      },
      { status: 422 }
    );
  }

  const currency =
    typeof raw.currency === "string" && raw.currency.trim()
      ? raw.currency.trim().toUpperCase()
      : DEFAULT_CURRENCY;

  // --- 3. Load the full merchant row (scoped by auth.id) ---
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, auth.id))
    .limit(1);

  if (!merchant) {
    // Should never happen — auth already verified the merchant exists.
    return NextResponse.json(
      { error: "Merchant record not found" },
      { status: 404 }
    );
  }

  // --- 4. Check that a payment key is configured ---
  if (!merchant.paymentSecretKey) {
    return NextResponse.json(
      {
        error:
          "Merchant has not connected their payment provider yet. " +
          "Ask the merchant to add their Yoco secret key in Settings.",
      },
      { status: 409 }
    );
  }

  // --- 5. Decrypt the stored key ---
  let plainKey: string;
  try {
    // The key may have been stored pre-encryption (lazy migration guard).
    // isEncrypted() checks for the v1:<iv>:<tag>:<ct> envelope format.
    plainKey = isEncrypted(merchant.paymentSecretKey)
      ? decryptSecret(merchant.paymentSecretKey)
      : merchant.paymentSecretKey;
  } catch (err) {
    // Decryption failure — encryption key mismatch or corrupted envelope.
    // Do NOT reveal details to the caller.
    console.error(
      "[payment-link] Failed to decrypt merchant payment key for merchant:",
      auth.id,
      (err as Error).message
    );
    return NextResponse.json(
      {
        error:
          "Unable to retrieve payment credentials. Please contact support.",
      },
      { status: 500 }
    );
  }

  // --- 6. Build Yoco reference ---
  // Use orderCode if provided; otherwise fall back to a unique reference so the
  // Yoco dashboard still shows something meaningful.
  const reference = orderCode ?? `moolabiz-${auth.id.slice(0, 8)}-${Date.now()}`;

  // --- 7. Call Yoco ---
  let yocoResult: { id: string; url: string };
  try {
    yocoResult = await createYocoPaymentLink({
      secretKey: plainKey,
      amountCents,
      currency,
      reference,
      metadata: {
        merchantId: auth.id,
        merchantSlug: auth.slug,
        ...(orderCode ? { orderCode } : {}),
      },
    });
  } catch (err) {
    // createYocoPaymentLink already strips the key from error messages.
    console.error("[payment-link] Yoco API error for merchant:", auth.id, (err as Error).message);
    return NextResponse.json(
      { error: `Payment provider error: ${(err as Error).message}` },
      { status: 502 }
    );
  } finally {
    // Wipe the plaintext key from the local scope as soon as possible.
    // (V8 does not guarantee GC timing, but this limits the live window.)
    plainKey = "";
  }

  // --- 8. Return the payment URL (never the key) ---
  return NextResponse.json(
    {
      url: yocoResult.url,
      checkoutId: yocoResult.id,
      ...(orderCode ? { orderCode } : {}),
    },
    { status: 200 }
  );
}
