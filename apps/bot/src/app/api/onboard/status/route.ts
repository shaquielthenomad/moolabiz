import { NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";

/**
 * Lightweight polling endpoint that returns connection status.
 * The /onboard page hits this every few seconds to detect when
 * WhatsApp has been linked.
 */
export async function GET() {
  if (!SLUG) {
    return NextResponse.json(
      { connected: false, qrReady: false, error: "BUSINESS_SLUG not set" },
      { status: 500 },
    );
  }

  const openclawUrl = `http://openclaw-${SLUG}:18789`;

  try {
    // Quick check: try JSON status first
    const statusRes = await fetch(`${openclawUrl}/api/status`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (statusRes && statusRes.ok) {
      const data = await statusRes.json();
      const connected = !!data.connected || !!data.authenticated || !!data.ready;
      return NextResponse.json({ connected, qrReady: !connected });
    }

    // Fallback: try to reach the gateway at all
    const htmlRes = await fetch(openclawUrl, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (htmlRes && htmlRes.ok) {
      const html = await htmlRes.text();
      const connected =
        html.includes("authenticated") ||
        html.includes("Connected") ||
        html.includes("ready");
      return NextResponse.json({ connected, qrReady: !connected });
    }

    // Container not reachable
    return NextResponse.json({ connected: false, qrReady: false });
  } catch {
    return NextResponse.json({ connected: false, qrReady: false });
  }
}
