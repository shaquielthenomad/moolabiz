import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the currently authenticated merchant from Clerk session.
 *
 * Looks up the merchant by their Clerk userId stored in the `clerk_id` column.
 * Returns null if not authenticated or no matching merchant found.
 */
export async function getMerchant() {
  const { userId } = await auth();
  if (!userId) return null;

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.clerkId, userId))
    .limit(1);

  return merchant ?? null;
}

/**
 * Require authentication — returns merchantId or null.
 * Lighter weight than getMerchant() when you only need the ID.
 */
export async function requireAuth(): Promise<{ merchantId: string } | null> {
  const merchant = await getMerchant();
  if (!merchant) return null;
  return { merchantId: merchant.id };
}
