import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { merchants, webhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { settleOrderByCode } from "@/lib/orders-settle";

/**
 * POST /api/webhooks/yoco
 *
 * Yoco -> us on a successful payment. We verify the signature, read the
 * `orderCode` + `merchantSlug` from the checkout metadata we set when the link
 * was created (payment-link route), and settle the matching Vendure order.
 * Idempotent (deduped by event id + settle is a no-op if already paid).
 *
 * This closes the server-side half of the payment loop (red-team F1).
 *
 * Secret: YOCO_WEBHOOK_SECRET (the `whsec_...` value from the Yoco dashboard).
 *
 * TODO-verify against the live Yoco webhook docs:
 *  - Signature scheme + header names. Implemented to the Svix-style scheme Yoco
 *    documents: headers `webhook-id`, `webhook-timestamp`, `webhook-signature`
 *    ("v1,<b64> ..."), signing `${id}.${ts}.${rawBody}` with the base64 secret
 *    after the `whsec_` prefix. Confirm with a test webhook before launch.
 *  - The success event `type` (matched loosely on /succeed|success|paid/ below).
 *  - Where `metadata` sits on the event (payload vs data vs checkout).
 */

function verifySignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.YOCO_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  // Optional replay guard: reject timestamps more than 5 minutes old/future.
  const tsNum = Number(ts);
  if (Number.isFinite(tsNum) && Math.abs(Date.now() / 1000 - tsNum) > 300) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "utf8");
  const signed = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64");

  // Header may carry several space-separated "v1,<sig>" entries.
  const candidates = sigHeader.split(" ").map((s) => (s.includes(",") ? s.split(",")[1] : s));
  const exp = Buffer.from(expected);
  return candidates.some((c) => {
    const got = Buffer.from(c);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(request.headers, rawBody)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const type = String((event.type as string) || (event.eventType as string) || "");
  // Only act on success events; ack everything else so Yoco stops retrying.
  if (type && !/succeed|success|paid/i.test(type)) {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const payload =
    (event.payload as Record<string, unknown>) ??
    (event.data as Record<string, unknown>) ??
    event;
  const metadata =
    ((payload.metadata as Record<string, unknown>) ||
      ((payload.checkout as Record<string, unknown>)?.metadata as Record<string, unknown>) ||
      {}) as Record<string, unknown>;

  const orderCode = typeof metadata.orderCode === "string" ? metadata.orderCode : undefined;
  const slug = typeof metadata.merchantSlug === "string" ? metadata.merchantSlug : undefined;
  const paymentId = String((payload.id as string) || (event.id as string) || "");

  // Nothing actionable — ack so Yoco doesn't retry forever.
  if (!orderCode || !slug) {
    return NextResponse.json({ ok: true, note: "no orderCode/merchantSlug in metadata" });
  }

  const eventId = String((event.id as string) || `${slug}:${orderCode}:${paymentId}`);

  try {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
    if (!merchant?.vendureChannelToken) {
      return NextResponse.json({ ok: true, note: "merchant not found" });
    }

    // Best-effort idempotency: a duplicate eventId throws on the unique index.
    try {
      await db.insert(webhookEvents).values({
        eventType: type || "yoco.payment",
        eventId,
        payload: rawBody.slice(0, 8000),
        processed: true,
        merchantId: merchant.id,
      });
    } catch {
      // Already recorded — settle is still idempotent, so fall through harmlessly.
    }

    const result = await settleOrderByCode(merchant.vendureChannelToken, orderCode, {
      method: "yoco-link",
      transactionId: paymentId || undefined,
      metadata: { provider: "yoco", paymentId, slug },
    });

    // Settle failures get a 500 so Yoco retries; "already settled" is a success.
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[webhooks/yoco]", (err as Error).message);
    return NextResponse.json({ ok: false, error: "settle failed" }, { status: 500 });
  }
}
