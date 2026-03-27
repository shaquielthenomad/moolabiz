import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlan } from "@/lib/plans";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.clerkId, userId))
    .limit(1);

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
