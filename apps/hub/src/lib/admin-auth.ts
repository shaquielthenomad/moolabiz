import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

/**
 * Check admin access for API routes.
 *
 * Supports two auth methods:
 * 1. Bearer ADMIN_SECRET header (M2M / server-to-server calls)
 * 2. Clerk session with admin role (browser-based admin dashboard)
 */
export function checkAdminRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const secret = process.env.ADMIN_SECRET;
    const expected = `Bearer ${secret}`;
    if (secret && authHeader && authHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
      return true;
    }
  }
  // For Clerk-based admin checks in API routes, callers should use
  // checkAdminSession() instead. This function is kept for M2M compat.
  return false;
}

/**
 * Check if the current Clerk user has admin role via session metadata.
 *
 * Set the "admin" role on a user in the Clerk dashboard, or via
 * publicMetadata: { role: "admin" }.
 */
export async function checkAdminSession(): Promise<boolean> {
  const { sessionClaims } = await auth();
  if (!sessionClaims) return false;

  // Check publicMetadata.role === "admin" (set in Clerk dashboard)
  const metadata = sessionClaims.metadata as
    | { role?: string }
    | undefined;
  return metadata?.role === "admin";
}

/**
 * Check admin access for API routes using Clerk session OR Bearer token.
 */
export async function checkAdminRequestOrSession(
  request: Request
): Promise<boolean> {
  // First try M2M Bearer token
  if (checkAdminRequest(request)) return true;
  // Then try Clerk session
  return checkAdminSession();
}
