import { NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";
const PROVISIONER_URL = process.env.OPENCLAW_PROVISIONER_URL || "http://openclaw-provisioner:9999";
const PROVISIONER_KEY = process.env.OPENCLAW_PROVISIONER_KEY || "moolabiz-provision-key";

/**
 * Returns WhatsApp connection status by asking the provisioner
 * (which runs `openclaw channels list` inside the container).
 */
export async function GET() {
  if (!SLUG) {
    return NextResponse.json({ connected: false, qrReady: false });
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
      return NextResponse.json({ connected: false, qrReady: false });
    }

    const data = await res.json();
    return NextResponse.json({
      connected: !!data.connected,
      qrReady: !!data.qr,
    });
  } catch {
    return NextResponse.json({ connected: false, qrReady: false });
  }
}
