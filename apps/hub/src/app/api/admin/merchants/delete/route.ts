import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkAdminRequestOrSession } from "@/lib/admin-auth";
import { removeOpenClaw } from "@/lib/openclaw";

export async function DELETE(request: Request) {
  if (!(await checkAdminRequestOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { merchantId } = body as { merchantId: string };

    if (!merchantId) {
      return NextResponse.json(
        { error: "merchantId is required" },
        { status: 400 }
      );
    }

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    const errors: string[] = [];

    // Remove OpenClaw container
    if (merchant.slug) {
      try {
        await removeOpenClaw(merchant.slug);
      } catch (err) {
        console.error("Failed to remove OpenClaw:", err);
        errors.push("Failed to remove OpenClaw container");
      }
    }

    // Delete from database
    await db.delete(merchants).where(eq(merchants.id, merchantId));

    return NextResponse.json({
      success: true,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Admin delete merchant error:", err);
    return NextResponse.json(
      { error: "Failed to delete merchant" },
      { status: 500 }
    );
  }
}
