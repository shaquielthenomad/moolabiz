import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stopOpenClaw, startOpenClaw } from "@/lib/openclaw";
import { checkAdminRequestOrSession } from "@/lib/admin-auth";
import { getStripe } from "@/lib/stripe";

// GET /api/admin/merchants — list all merchants (excludes sensitive fields)
export async function GET(request: Request) {
  if (!(await checkAdminRequestOrSession(request))) {
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
      openclawContainerId: merchants.openclawContainerId,
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

const ACTION_STATUS_MAP: Record<string, string> = {
  suspend: "suspended",
  reactivate: "active",
  cancel: "cancelled",
};

// PATCH /api/admin/merchants — update merchant status
export async function PATCH(request: Request) {
  if (!(await checkAdminRequestOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { merchantId, action } = body as { merchantId: string; action: string };

    if (!merchantId || !action) {
      return NextResponse.json({ error: "merchantId and action required" }, { status: 400 });
    }

    const newStatus = ACTION_STATUS_MAP[action];
    if (!newStatus) {
      return NextResponse.json(
        { error: `Invalid action. Use: ${Object.keys(ACTION_STATUS_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    const [merchant] = await db
      .select({
        id: merchants.id,
        slug: merchants.slug,
        subscriptionId: merchants.subscriptionId,
      })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // Handle OpenClaw container
    if (merchant.slug) {
      if (action === "suspend" || action === "cancel") {
        try {
          await stopOpenClaw(merchant.slug);
        } catch (err) {
          console.error("Failed to stop OpenClaw:", err);
        }
      } else if (action === "reactivate") {
        try {
          await startOpenClaw(merchant.slug);
        } catch (err) {
          console.error("Failed to start OpenClaw:", err);
        }
      }
    }

    // Cancel Stripe subscription if action is "cancel"
    if (action === "cancel" && merchant.subscriptionId) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(merchant.subscriptionId);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription:", err);
      }
    }

    await db
      .update(merchants)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("Admin merchants action error:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

// POST /api/admin/merchants — bulk actions (suspend all, maintenance mode)
export async function POST(request: Request) {
  if (!(await checkAdminRequestOrSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "suspend_all") {
      const activeMerchants = await db
        .select({
          id: merchants.id,
          slug: merchants.slug,
        })
        .from(merchants)
        .where(eq(merchants.status, "active"));

      let stopped = 0;
      for (const m of activeMerchants) {
        try {
          if (m.slug) await stopOpenClaw(m.slug);
          await db
            .update(merchants)
            .set({ status: "suspended", updatedAt: new Date() })
            .where(eq(merchants.id, m.id));
          stopped++;
        } catch (err) {
          console.error(`Failed to suspend merchant ${m.id}:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Suspended ${stopped} of ${activeMerchants.length} merchants`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: suspend_all" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Admin bulk action error:", err);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
