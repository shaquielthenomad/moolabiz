import { NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";
const PROVISIONER_URL = process.env.OPENCLAW_PROVISIONER_URL || "http://openclaw-provisioner:9999";
const PROVISIONER_KEY = process.env.OPENCLAW_PROVISIONER_KEY;

if (!PROVISIONER_KEY) {
  throw new Error("OPENCLAW_PROVISIONER_KEY env var is required");
}

/**
 * Checks WhatsApp connection status from the OpenClaw provisioner.
 *
 * The actual QR code is now handled by the Easy Mode overlay in the
 * control UI at {slug}.bot.moolabiz.shop — it uses the gateway's
 * WebSocket protocol (web.login.start → qrDataUrl) to render a native
 * QR image. This endpoint only returns { connected, controlUi }.
 */
export async function GET() {
  if (!SLUG) {
    return NextResponse.json({ connected: false, controlUi: null, error: "Not configured" });
  }

  try {
    const res = await fetch(`${PROVISIONER_URL}/qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": PROVISIONER_KEY,
      },
      body: JSON.stringify({ slug: SLUG }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false, controlUi: `https://${SLUG}.bot.moolabiz.shop` });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false, controlUi: `https://${SLUG}.bot.moolabiz.shop` });
  }
}
