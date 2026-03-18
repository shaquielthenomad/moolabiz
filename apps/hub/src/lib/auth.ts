import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "moolabiz_session";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is required");
  return s;
}

export function createSessionToken(merchantId: string): string {
  const payload = JSON.stringify({
    merchantId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string
): { merchantId: string } | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expectedBuf = crypto
      .createHmac("sha256", getSecret())
      .update(encoded)
      .digest();
    const sigBuf = Buffer.from(sig, "base64url");
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    )
      return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return { merchantId: payload.merchantId };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ merchantId: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
