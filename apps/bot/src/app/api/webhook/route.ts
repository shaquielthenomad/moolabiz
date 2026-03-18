import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    verifyToken &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken))
  ) {
    console.log("[webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[webhook] Verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[webhook] WHATSAPP_APP_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawBody = await request.text();

  // Verify HMAC signature
  const signature = request.headers.get("X-Hub-Signature-256");
  if (!signature) {
    console.warn("[webhook] Missing X-Hub-Signature-256 header");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    console.warn("[webhook] Invalid HMAC signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = JSON.parse(rawBody);

  // Log only non-PII metadata
  const entry = body?.entry?.[0];
  const messageType = entry?.changes?.[0]?.value?.messages?.[0]?.type ?? "unknown";
  console.log("[webhook] Received message", { type: messageType, timestamp: Date.now() });

  // TODO: Process WhatsApp messages here

  return NextResponse.json({ status: "received" }, { status: 200 });
}
