import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "moolabiz_admin";

function getAdminSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET env var is required");
  return s;
}

function getSigningKey(): string {
  // Use SESSION_SECRET for HMAC signing, ADMIN_SECRET for password check
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is required");
  return s;
}

export function createAdminToken(): string {
  const payload = JSON.stringify({
    role: "admin",
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningKey())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return false;
    const expectedBuf = crypto
      .createHmac("sha256", getSigningKey())
      .update(encoded)
      .digest();
    const sigBuf = Buffer.from(sig, "base64url");
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return false;
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (payload.exp < Date.now()) return false;
    if (payload.role !== "admin") return false;
    return true;
  } catch {
    return false;
  }
}

export function checkAdminPassword(password: string): boolean {
  const secret = getAdminSecret();
  // Constant-time compare to prevent timing attacks
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function checkAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

/**
 * Check admin session from a Request object (for API routes).
 * Checks both the cookie and the Authorization header (Bearer token).
 */
export function checkAdminRequest(request: Request): boolean {
  // Check Authorization header (Bearer ADMIN_SECRET)
  const auth = request.headers.get("authorization");
  if (auth) {
    const secret = process.env.ADMIN_SECRET;
    if (secret && auth === `Bearer ${secret}`) return true;
  }

  // Check cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/moolabiz_admin=([^;]+)/);
  if (!match) return false;
  return verifyAdminToken(match[1]);
}

export { ADMIN_COOKIE };
