/**
 * Symmetric encryption for secrets at rest — e.g. a merchant's own payment
 * provider (Yoco/Ozow/PayFast) secret key, which must never be stored in
 * plaintext in the database.
 *
 * Algorithm: AES-256-GCM (authenticated encryption).
 * Key: provided via MOOLABIZ_ENCRYPTION_KEY (32 bytes, hex or base64).
 *      Generate one with:  openssl rand -hex 32
 *
 * Stored envelope format (string):  v1:<ivB64>:<authTagB64>:<ciphertextB64>
 *
 * This module is server-only. Never import it into client components.
 */

import crypto from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM

function getKey(): Buffer {
  const raw = process.env.MOOLABIZ_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "MOOLABIZ_ENCRYPTION_KEY env var is required to encrypt/decrypt secrets. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  // Accept hex (64 chars) or base64; both must decode to exactly 32 bytes.
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "MOOLABIZ_ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -hex 32)"
    );
  }
  return key;
}

/** Encrypt a plaintext secret into the versioned envelope format. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypt a value previously produced by {@link encryptSecret}. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid encrypted secret envelope");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * True if a stored value is already in the encrypted envelope format.
 * Useful for lazy migration of pre-existing plaintext rows.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}
