import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { checkAdminRequestOrSession } from "@/lib/admin-auth";
import { PLANS } from "@/lib/plans";

export async function GET(request: Request) {
  if (!(await checkAdminRequestOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all merchants with plan and status
    const allMerchants = await db
      .select({
        plan: merchants.plan,
        status: merchants.status,
      })
      .from(merchants);

    const total = allMerchants.length;
    const active = allMerchants.filter((m) => m.status === "active").length;
    const suspended = allMerchants.filter((m) => m.status === "suspended").length;
    const cancelled = allMerchants.filter((m) => m.status === "cancelled").length;
    const pending = allMerchants.filter(
      (m) => m.status === "pending" || m.status === "provisioning"
    ).length;

    // Calculate MRR from active merchants only
    const planPriceMap: Record<string, number> = {};
    for (const plan of PLANS) {
      planPriceMap[plan.id] = plan.price; // in cents
    }

    let mrrCents = 0;
    for (const m of allMerchants) {
      if (m.status === "active") {
        mrrCents += planPriceMap[m.plan] || 0;
      }
    }

    return NextResponse.json({
      total,
      active,
      suspended,
      cancelled,
      pending,
      mrr: mrrCents, // in ZAR cents
      mrrDisplay: `R${(mrrCents / 100).toFixed(2)}`,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
