/**
 * HMAC-signed, expiring tokens for un-guessable status / track links.
 *
 * Order codes are short and enumerable, so we never expose them in a public URL.
 * Instead we hand out `/api/track/<token>` where the token is a signed,
 * time-limited claim. Verification needs no DB lookup of the token itself —
 * the signature IS the capability.
 *
 * Secret: MOOLABIZ_LINK_SECRET (falls back to MOOLABIZ_ENCRYPTION_KEY).
 */

import crypto from "node:crypto";

function secret(): Buffer {
  const raw = process.env.MOOLABIZ_LINK_SECRET || process.env.MOOLABIZ_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MOOLABIZ_LINK_SECRET (or MOOLABIZ_ENCRYPTION_KEY) is required to sign links");
  }
  return Buffer.from(raw, "utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface TrackClaims {
  slug: string; // merchant slug — scopes the lookup to one channel
  orderCode: string;
  exp: number; // unix seconds
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 3600; // 7 days

/** Sign a track token for an order. */
export function signTrackToken(
  claims: Omit<TrackClaims, "exp">,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const payload: TrackClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Verify a track token; returns the claims if valid + unexpired, else null. */
export function verifyTrackToken(token: string): TrackClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let claims: TrackClaims;
  try {
    claims = JSON.parse(fromB64url(body).toString("utf8")) as TrackClaims;
  } catch {
    return null;
  }
  if (!claims || typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  if (typeof claims.slug !== "string" || typeof claims.orderCode !== "string") return null;
  return claims;
}
