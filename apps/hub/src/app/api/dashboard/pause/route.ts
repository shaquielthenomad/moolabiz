import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { stopApplication } from "@/lib/coolify";
import { stopOpenClaw } from "@/lib/openclaw";

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

    if (merchant.status !== "active") {
      return NextResponse.json(
        { error: "Your bot is not currently active." },
        { status: 400 }
      );
    }

    if (merchant.coolifyAppUuid) {
      await stopApplication(merchant.coolifyAppUuid);
    }

    // Also stop OpenClaw container
    try { await stopOpenClaw(merchant.slug); } catch (e) {
      console.error("Failed to stop OpenClaw:", e);
    }

    await db
      .update(merchants)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(merchants.id, merchant.id));

    return NextResponse.json({ success: true, status: "suspended" });
  } catch (err) {
    console.error("Pause error:", err);
    return NextResponse.json(
      { error: "Could not pause your bot. Try again." },
      { status: 500 }
    );
  }
}
