import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSoulPrompt } from "@/lib/soul";
import { chat } from "@/lib/ollama";

function safeTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
if (!verifyToken || verifyToken.length < 16) {
  console.error("[webhook] WHATSAPP_VERIFY_TOKEN is missing or too short (min 16 chars)");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    verifyToken &&
    safeTimingEqual(token, verifyToken)
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

  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Verify HMAC signature
  const signature = request.headers.get("X-Hub-Signature-256");
  if (!signature) {
    console.warn("[webhook] Missing X-Hub-Signature-256 header");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  if (!safeTimingEqual(signature, expectedSignature)) {
    console.warn("[webhook] Invalid HMAC signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = JSON.parse(rawBody);

  // Log only non-PII metadata
  const firstEntry = body?.entry?.[0];
  const messageType = firstEntry?.changes?.[0]?.value?.messages?.[0]?.type ?? "unknown";
  console.log("[webhook] Received message", { type: messageType, timestamp: Date.now() });

  const soulPrompt = await getSoulPrompt();
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const messages = change?.value?.messages || [];
      for (const msg of messages) {
        if (msg.type === "text" && msg.text?.body) {
          const response = await chat(soulPrompt, [
            { role: "user", content: msg.text.body },
          ]);
          // TODO: Send response back via WhatsApp API
          console.log(`[webhook] Response for ${msg.from}:`, response.substring(0, 100));
        }
      }
    }
  }

  return NextResponse.json({ status: "received" }, { status: 200 });
}
