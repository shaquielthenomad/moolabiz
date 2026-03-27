import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Merchant = typeof merchants.$inferSelect;

export interface DashboardAuthResult {
  merchant: Merchant;
  vendureChannelToken: string;
}

/**
 * Validates the Clerk session and looks up the merchant by clerkId.
 *
 * Returns a DashboardAuthResult on success, or a NextResponse error on failure.
 * Callers should check with `isDashboardAuthError` before using the result.
 */
export async function getMerchantFromSession(): Promise<
  DashboardAuthResult | NextResponse
> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.clerkId, userId))
    .limit(1);

  if (!merchant || !merchant.vendureChannelToken) {
    return NextResponse.json(
      { error: "Store is not yet connected" },
      { status: 503 }
    );
  }

  return { merchant, vendureChannelToken: merchant.vendureChannelToken };
}

export function isDashboardAuthError(
  result: DashboardAuthResult | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
