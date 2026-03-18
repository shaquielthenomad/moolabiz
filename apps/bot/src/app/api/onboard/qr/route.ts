import { NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";

/**
 * Proxies the QR code from the OpenClaw gateway container.
 *
 * OpenClaw's web UI at port 18789 serves a page that includes the
 * WhatsApp-linking QR code. We scrape it and return the raw QR data
 * so the branded /onboard page can render it without exposing the
 * OpenClaw UI directly.
 *
 * Returns JSON: { qrCode: string | null, connected: boolean }
 */
export async function GET() {
  if (!SLUG) {
    return NextResponse.json(
      { qrCode: null, connected: false, error: "BUSINESS_SLUG not set" },
      { status: 500 },
    );
  }

  const openclawUrl = `http://openclaw-${SLUG}:18789`;

  try {
    // Try the OpenClaw status/QR endpoint.
    // OpenClaw gateway exposes GET / which returns an HTML page.
    // It also commonly exposes /api or /status for programmatic access.
    // We attempt a few known patterns.

    // Attempt 1: JSON status endpoint (newer OpenClaw versions)
    const statusRes = await fetch(`${openclawUrl}/api/status`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (statusRes && statusRes.ok) {
      const data = await statusRes.json();
      return NextResponse.json({
        qrCode: data.qr || data.qrCode || data.qr_code || null,
        connected: !!data.connected || !!data.authenticated || !!data.ready,
      });
    }

    // Attempt 2: Scrape the HTML page for QR data
    const htmlRes = await fetch(openclawUrl, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (htmlRes && htmlRes.ok) {
      const html = await htmlRes.text();

      // Check for connection/authenticated state
      const isConnected =
        html.includes("authenticated") ||
        html.includes("Connected") ||
        html.includes("ready");

      // Look for a QR code in common patterns:
      // data:image/png;base64,... or a raw base64 string in a data attribute
      const qrMatch =
        html.match(/data:image\/[^"']+/)?.[0] ||
        html.match(/qr[_-]?(?:code|data|image)["']\s*(?::|=)\s*["']([^"']+)["']/i)?.[1] ||
        null;

      return NextResponse.json({
        qrCode: qrMatch,
        connected: isConnected,
      });
    }

    // OpenClaw container not reachable yet
    return NextResponse.json({ qrCode: null, connected: false });
  } catch (err) {
    console.error("[onboard/qr] Error fetching from OpenClaw:", err);
    return NextResponse.json({ qrCode: null, connected: false });
  }
}
