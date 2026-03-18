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

// GET /api/admin/merchants — list all merchants
export async function GET(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}

// PATCH /api/admin/merchants — update merchant status (suspend/reactivate)
export async function PATCH(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { merchantId, action } = body as { merchantId: string; action: string };

  if (!merchantId || !action) {
    return NextResponse.json({ error: "merchantId and action required" }, { status: 400 });
  }

  const [merchant] = await db.select().from(merchants)
    .where(eq(merchants.id, merchantId)).limit(1);

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  if (action === "suspend" && merchant.coolifyAppUuid) {
    await stopApplication(merchant.coolifyAppUuid);
    await db.update(merchants).set({ status: "suspended", updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));
    return NextResponse.json({ success: true, status: "suspended" });
  }

  if (action === "reactivate" && merchant.coolifyAppUuid) {
    await startApplication(merchant.coolifyAppUuid);
    await db.update(merchants).set({ status: "active", updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));
    return NextResponse.json({ success: true, status: "active" });
  }

  if (action === "cancel" && merchant.coolifyAppUuid) {
    await stopApplication(merchant.coolifyAppUuid);
    await db.update(merchants).set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));
    return NextResponse.json({ success: true, status: "cancelled" });
  }

  return NextResponse.json({ error: "Invalid action. Use: suspend, reactivate, cancel" }, { status: 400 });
}
