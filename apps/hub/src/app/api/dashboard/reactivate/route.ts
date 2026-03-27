import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { startApplication } from "@/lib/coolify";
import { startOpenClaw } from "@/lib/openclaw";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.clerkId, userId))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (merchant.status === "active") {
      return NextResponse.json(
        { error: "Your bot is already active." },
        { status: 400 }
      );
    }

    // For cancelled merchants, they need to re-subscribe via the signup flow.
    // Reactivate only works for paused (suspended) merchants whose Stripe subscription is still active.
    if (merchant.status === "cancelled") {
      return NextResponse.json(
        { error: "Your subscription was cancelled. Please sign up again to reactivate." },
        { status: 400 }
      );
    }

    if (merchant.coolifyAppUuid) {
      await startApplication(merchant.coolifyAppUuid);
    }

    // Also restart OpenClaw container
    try { await startOpenClaw(merchant.slug); } catch (e) {
      console.error("Failed to start OpenClaw:", e);
    }

    await db
      .update(merchants)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(merchants.id, merchant.id));

    return NextResponse.json({ success: true, status: "active" });
  } catch (err) {
    console.error("Reactivate error:", err);
    return NextResponse.json(
      { error: "Could not reactivate. Try again." },
      { status: 500 }
    );
  }
}
