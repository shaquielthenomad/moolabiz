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

// How long we're willing to wait for the full message-processing pipeline
// before giving WhatsApp a 200 so they don't retry the same event.
const PROCESSING_TIMEOUT_MS = 25_000;

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
    // Return 200 so WhatsApp doesn't keep retrying a permanently broken endpoint
    return NextResponse.json({ status: "received" }, { status: 200 });
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

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[webhook] Failed to parse JSON body");
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  // Log only non-PII metadata
  const firstEntry = (body as { entry?: { changes?: { value?: { messages?: { type?: string }[] } }[] }[] })
    ?.entry?.[0];
  const messageType = firstEntry?.changes?.[0]?.value?.messages?.[0]?.type ?? "unknown";
  console.log("[webhook] Received message", { type: messageType, timestamp: Date.now() });

  // getSoulPrompt never throws — it falls back to the default prompt if SOUL.md
  // is missing or unreadable (handled inside soul.ts).
  const soulPrompt = await getSoulPrompt();

  const entries = (body as { entry?: unknown[] })?.entry ?? [];

  // Wrap message processing in a timeout so a slow/unresponsive Ollama instance
  // can't block the WhatsApp acknowledgement indefinitely.
  const processingTimeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("[webhook] Processing timeout reached, acknowledging anyway");
      resolve();
    }, PROCESSING_TIMEOUT_MS);
  });

  const processMessages = async () => {
    for (const entry of entries as { changes?: unknown[] }[]) {
      for (const change of (entry?.changes ?? []) as { value?: { messages?: unknown[] } }[]) {
        const messages = change?.value?.messages ?? [];
        for (const msg of messages as { type?: string; text?: { body?: string }; from?: string }[]) {
          if (msg.type === "text" && msg.text?.body) {
            try {
              const response = await chat(soulPrompt, [
                { role: "user", content: msg.text.body },
              ]);
              // TODO: Send response back via WhatsApp API
              console.log(`[webhook] Response for ${msg.from}:`, response.substring(0, 100));
            } catch (err) {
              // Ollama may be starting up, overloaded, or temporarily down.
              // Log the error but do NOT propagate — WhatsApp must always get
              // a 200 or it will retry the same webhook event repeatedly.
              console.error("[webhook] Ollama chat failed, skipping message:", err instanceof Error ? err.message : err);
            }
          }
        }
      }
    }
  };

  await Promise.race([processMessages(), processingTimeout]);

  return NextResponse.json({ status: "received" }, { status: 200 });
}
