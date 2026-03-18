import { NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";
const PROVISIONER_URL = process.env.OPENCLAW_PROVISIONER_URL || "http://openclaw-provisioner:9999";
const PROVISIONER_KEY = process.env.OPENCLAW_PROVISIONER_KEY || "moolabiz-provision-key";

/**
 * Gets the WhatsApp QR code from the OpenClaw provisioner.
 * Returns ASCII art QR that the /onboard page renders directly.
 */
export async function GET() {
  if (!SLUG) {
    return NextResponse.json({ qr: null, connected: false, error: "Not configured" });
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
      return NextResponse.json({ qr: null, connected: false });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ qr: null, connected: false });
  }
}
