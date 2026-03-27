import { NextResponse } from "next/server";
import { checkAdminSession } from "@/lib/admin-auth";

/**
 * POST /api/admin/auth
 *
 * Verify admin status via Clerk session.
 * The old password-based flow has been replaced by Clerk authentication.
 * Admin users must have publicMetadata.role === "admin" set in Clerk.
 */
export async function POST() {
  try {
    const isAdmin = await checkAdminSession();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not authorized as admin" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin auth error:", err);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
