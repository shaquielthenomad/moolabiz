/**
 * Yoco Checkout API client — server-only.
 *
 * Creates a hosted-checkout session using the MERCHANT'S OWN Yoco secret key.
 * MoolaBiz never holds or routes funds; it simply calls the Yoco API on behalf
 * of the merchant.
 *
 * Endpoint (TODO-verify): POST https://payments.yoco.com/api/checkouts
 * Docs: https://developer.yoco.com/docs/checkout-api/
 *
 * Key contract:
 *  - secretKey is NEVER logged, returned to the caller, or included in error
 *    messages that propagate to the client.
 *  - Amounts are in cents (integer), matching Vendure's totalWithTax field.
 *  - Only ZAR is supported by Yoco today; pass "ZAR" from the caller.
 *
 * @module yoco
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TODO-verify: confirm this is still the live Checkout API base URL.
// Sourced from official Yoco PHP SDK (sonnenglas/yoco-php-sdk) which targets
// this base as of May 2026, and from multiple open-source integrations.
const YOCO_CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";

// Minimum Yoco checkout amount (R2.00 = 200 cents).
const YOCO_MIN_AMOUNT_CENTS = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateYocoPaymentLinkParams {
  /** The merchant's own Yoco secret key (sk_live_... or sk_test_...). Already decrypted. */
  secretKey: string;
  /** Amount in cents, e.g. 5000 = R50.00. Must be >= 200. */
  amountCents: number;
  /** ISO 4217 currency code. Yoco only accepts "ZAR". */
  currency: string;
  /** Your internal order reference, stored in metadata.orderReference. */
  reference: string;
  /** Where Yoco redirects after a successful payment. Optional; omit for link-only flow. */
  successUrl?: string;
  /** Where Yoco redirects if the customer cancels. Optional. */
  cancelUrl?: string;
  /** Arbitrary key-value pairs stored on the Yoco checkout (visible in webhook payload). */
  metadata?: Record<string, string>;
}

export interface YocoPaymentLinkResult {
  /** Yoco checkout id (e.g. "ch_xxxxxxxxxxxxxxxx"). Persist this for webhook matching. */
  id: string;
  /** Hosted payment page URL to send to the customer (e.g. https://pay.yoco.com/r/xxxx). */
  url: string;
}

// ---------------------------------------------------------------------------
// Internal Yoco response shape (partial — only fields we use)
// ---------------------------------------------------------------------------

interface YocoCheckoutResponse {
  id: string;
  redirectUrl: string;
  status?: string;
  processingMode?: string;
}

// ---------------------------------------------------------------------------
// createYocoPaymentLink
// ---------------------------------------------------------------------------

/**
 * Create a Yoco hosted-checkout session and return the shareable payment URL.
 *
 * @throws {Error} with a safe message (no key material) on any API or
 *   validation failure.
 */
export async function createYocoPaymentLink(
  params: CreateYocoPaymentLinkParams
): Promise<YocoPaymentLinkResult> {
  const {
    secretKey,
    amountCents,
    currency,
    reference,
    successUrl,
    cancelUrl,
    metadata,
  } = params;

  // --- Guard: amount ---
  if (!Number.isInteger(amountCents) || amountCents < YOCO_MIN_AMOUNT_CENTS) {
    throw new Error(
      `Invalid amount: must be an integer >= ${YOCO_MIN_AMOUNT_CENTS} cents (R2.00). Got: ${amountCents}`
    );
  }

  // --- Build request body ---
  const body: Record<string, unknown> = {
    amount: amountCents,
    currency: currency.toUpperCase(),
    metadata: {
      ...metadata,
      orderReference: reference,
    },
  };

  if (successUrl) body.successUrl = successUrl;
  if (cancelUrl) body.cancelUrl = cancelUrl;

  // --- Call Yoco ---
  let res: Response;
  try {
    res = await fetch(YOCO_CHECKOUTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // secretKey intentionally not spread/logged anywhere else in this module.
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(body),
      // No cache; every checkout is a new, unique session.
      cache: "no-store",
    });
  } catch (networkErr) {
    // Wrap network-level errors without leaking the key.
    throw new Error(
      `Yoco API request failed (network): ${(networkErr as Error).message}`
    );
  }

  // --- Parse response ---
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      `Yoco API returned non-JSON response (HTTP ${res.status})`
    );
  }

  if (!res.ok) {
    // Extract a safe error message from the Yoco error body if possible.
    const apiMsg =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as Record<string, unknown>).message === "string"
        ? (json as Record<string, string>).message
        : `HTTP ${res.status}`;
    throw new Error(`Yoco API error: ${apiMsg}`);
  }

  const data = json as YocoCheckoutResponse;

  if (!data.id || !data.redirectUrl) {
    throw new Error(
      "Yoco API response missing expected fields (id, redirectUrl). " +
        "TODO-verify: confirm the response shape against the current API docs."
    );
  }

  return { id: data.id, url: data.redirectUrl };
}
