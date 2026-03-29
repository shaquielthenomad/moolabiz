import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlan } from "@/lib/plans";
import { DashboardClient } from "./dashboard-client";
import { MERCHANT_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.clerkId, userId))
    .limit(1);

  // Fallback: the webhook may have provisioned the merchant before
  // provision-after-payment ran, leaving clerkId as null. If so, find
  // the merchant by email and backfill clerkId so future lookups work.
  if (!merchant) {
    const user = await currentUser();
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;

    if (primaryEmail) {
      const [emailMatch] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.email, primaryEmail))
        .limit(1);

      if (
        emailMatch &&
        !emailMatch.clerkId &&
        [
          MERCHANT_STATUS.PENDING,
          MERCHANT_STATUS.PROVISIONING,
          MERCHANT_STATUS.ACTIVE,
        ].includes(emailMatch.status as "pending" | "provisioning" | "active")
      ) {
        // Backfill the clerkId so subsequent lookups don't need this fallback
        await db
          .update(merchants)
          .set({ clerkId: userId, updatedAt: new Date() })
          .where(eq(merchants.id, emailMatch.id));

        merchant = { ...emailMatch, clerkId: userId };
      }
    }
  }

  if (!merchant) {
    redirect("/sign-in");
  }

  const plan = getPlan(merchant.plan);

  return (
    <DashboardClient
      merchant={{
        id: merchant.id,
        slug: merchant.slug,
        businessName: merchant.businessName,
        whatsappNumber: merchant.whatsappNumber,
        paymentProvider: merchant.paymentProvider,
        plan: merchant.plan,
        planName: plan?.name || merchant.plan,
        planPrice: plan?.priceDisplay || "---",
        status: merchant.status,
        subdomain: merchant.subdomain,
        openclawContainerId: merchant.openclawContainerId,
        createdAt: merchant.createdAt.toISOString(),
      }}
    />
  );
}
