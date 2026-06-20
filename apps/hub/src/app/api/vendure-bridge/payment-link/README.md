# Payment Link API — BYO-PSP (Yoco)

## Overview

`POST /api/vendure-bridge/payment-link` closes the customer-payment loop for
MoolaBiz merchants who use Yoco as their own payment provider.

**MoolaBiz never holds or routes funds.** The merchant's own Yoco secret key
is stored encrypted in `merchants.paymentSecretKey` (AES-256-GCM via
`src/lib/crypto.ts`), decrypted at call time inside this route, used once to
call the Yoco Checkout API, then immediately discarded. No key material is
ever logged or returned to the caller.

---

## How the shop agent calls this

1. **Order ready** — The shop agent receives a customer order (via Vendure
   through the bridge routes) and needs to collect payment.

2. **POST payment-link** — The agent calls:

   ```
   POST /api/vendure-bridge/payment-link
   Authorization: Bearer <merchant apiSecret>
   Content-Type: application/json

   {
     "orderCode":   "MB-1234",
     "amountCents": 25000,
     "currency":    "ZAR"
   }
   ```

   `amountCents` comes from the order's `totalWithTax` field returned by
   `LIST_ORDERS_QUERY` / `GET_ORDER_QUERY` in `src/lib/vendure.ts`.
   `currency` defaults to `"ZAR"` if omitted.

3. **Send URL to customer** — The response `{ url, checkoutId }` contains a
   Yoco-hosted payment page URL (e.g. `https://pay.yoco.com/r/xxxxxx`).
   The agent sends this link to the customer over WhatsApp:

   > "Here is your secure payment link for order MB-1234 (R250.00):
   >  https://pay.yoco.com/r/xxxxxx
   >  This link expires after the session — please pay now."

4. **Customer pays** — The customer opens the link on their phone, enters their
   card details on Yoco's hosted page. MoolaBiz receives no card data.

---

## PaymentProvider abstraction point

`paymentProvider` is stored on the `merchants` row (schema.ts) and is currently
always `"yoco"` for BYO-PSP merchants.

When adding a second PSP (Ozow, PayFast, etc.), the route should:

1. Read `merchant.paymentProvider` after authenticating.
2. Branch to the appropriate provider module (e.g. `src/lib/ozow.ts`,
   `src/lib/payfast.ts`) rather than always calling `createYocoPaymentLink`.
3. Each provider module should expose the same interface:
   `createPaymentLink({ secretKey, amountCents, currency, reference, ... }) → { url, id }`.

This keeps the route logic thin and provider logic isolated.

---

## TODOs

- **TODO-verify endpoint**: The Yoco Checkout API base URL used is
  `https://payments.yoco.com/api/checkouts`. Confirm this against the
  official Yoco Developer Portal (`developer.yoco.com/docs/checkout-api/`)
  before going live. The endpoint is well-evidenced in third-party SDKs and
  community integrations but an official Yoco account + test key should be
  used to verify the exact request/response shape (especially the `redirectUrl`
  field name in the response).

- **TODO-verify field names**: The response field used is `redirectUrl` (as
  documented in the official Yoco PHP SDK quickstart). Confirm with a live
  test call that this is not `url` or `paymentUrl`.

- **TODO test keys**: Obtain `sk_test_...` Yoco keys and exercise this route
  end-to-end in a staging environment before enabling in production.

- **TODO Yoco webhook**: Add a `POST /api/webhooks/yoco` endpoint to receive
  `payment.succeeded` / `payment.failed` events from Yoco and transition the
  Vendure order state accordingly (e.g. to `PaymentSettled`). Use
  `TRANSITION_ORDER_STATE_MUTATION` from `src/lib/vendure.ts`. Standard
  Webhooks signature verification (HMAC-SHA256) should be used; see
  `sonnenglas/yoco-php-sdk` for reference signature verification logic.
  This is **out of scope** for this PR.

- **TODO orderCode fetch**: Currently the caller (shop agent) must supply
  `amountCents` from its already-loaded order data. A future improvement could
  optionally fetch the live order total from Vendure inside this route using
  `GET_ORDER_QUERY` if only `orderCode` is provided — useful if the agent ever
  calls this without having pre-fetched the total.

- **TODO idempotency**: Add an `Idempotency-Key` header to the Yoco request to
  prevent duplicate checkout sessions if the route is retried. Use
  `crypto.randomUUID()` stored in a short-lived cache keyed by
  `merchantId + orderCode`.
