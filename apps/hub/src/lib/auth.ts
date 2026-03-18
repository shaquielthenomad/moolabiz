import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "fallback";
const COOKIE_NAME = "moolabiz_session";

export function createSessionToken(merchantId: string): string {
  const payload = JSON.stringify({
    merchantId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SESSION_SECRET, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function verifySessionToken(
  token: string
): { merchantId: string } | null {
  try {
    const [ivHex, encrypted] = token.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(SESSION_SECRET, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    const payload = JSON.parse(decrypted);
    if (payload.exp < Date.now()) return null;
    return { merchantId: payload.merchantId };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ merchantId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
