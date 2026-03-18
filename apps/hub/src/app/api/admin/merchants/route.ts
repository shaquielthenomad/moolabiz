import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startApplication, stopApplication } from "@/lib/coolify";

function checkAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// GET /api/admin/merchants — list all merchants (excludes sensitive fields)
export async function GET(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allMerchants = await db.select({
      id: merchants.id,
      businessName: merchants.businessName,
      slug: merchants.slug,
      whatsappNumber: merchants.whatsappNumber,
      paymentProvider: merchants.paymentProvider,
      plan: merchants.plan,
      status: merchants.status,
      coolifyAppUuid: merchants.coolifyAppUuid,
      subdomain: merchants.subdomain,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
    }).from(merchants);
    return NextResponse.json({ merchants: allMerchants });
  } catch (err) {
    console.error("Admin merchants list error:", err);
    return NextResponse.json({ error: "Failed to list merchants" }, { status: 500 });
  }
}

const ACTION_MAP: Record<string, { fn: (uuid: string) => Promise<void>; status: string }> = {
  suspend: { fn: stopApplication, status: "suspended" },
  reactivate: { fn: startApplication, status: "active" },
  cancel: { fn: stopApplication, status: "cancelled" },
};

// PATCH /api/admin/merchants — update merchant status
export async function PATCH(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { merchantId, action } = body as { merchantId: string; action: string };

    if (!merchantId || !action) {
      return NextResponse.json({ error: "merchantId and action required" }, { status: 400 });
    }

    const entry = ACTION_MAP[action];
    if (!entry) {
      return NextResponse.json(
        { error: `Invalid action. Use: ${Object.keys(ACTION_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    const [merchant] = await db.select({
      id: merchants.id,
      coolifyAppUuid: merchants.coolifyAppUuid,
    }).from(merchants).where(eq(merchants.id, merchantId)).limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    if (!merchant.coolifyAppUuid) {
      return NextResponse.json({ error: "Merchant has no deployed app" }, { status: 409 });
    }

    await entry.fn(merchant.coolifyAppUuid);
    await db.update(merchants).set({ status: entry.status, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    return NextResponse.json({ success: true, status: entry.status });
  } catch (err) {
    console.error("Admin merchants action error:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
