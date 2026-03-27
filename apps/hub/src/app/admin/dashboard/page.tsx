import { redirect } from "next/navigation";
import { checkAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { PLANS } from "@/lib/plans";
import AdminDashboardClient from "./admin-dashboard-client";

export const metadata = {
  title: "Admin Dashboard",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const isAdmin = await checkAdminSession();
  if (!isAdmin) {
    redirect("/sign-in");
  }

  // Fetch merchants
  const allMerchants = await db
    .select({
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
    })
    .from(merchants);

  // Calculate stats
  const planPriceMap: Record<string, number> = {};
  for (const plan of PLANS) {
    planPriceMap[plan.id] = plan.price;
  }

  const total = allMerchants.length;
  const active = allMerchants.filter((m) => m.status === "active").length;
  const suspended = allMerchants.filter((m) => m.status === "suspended").length;
  const cancelled = allMerchants.filter((m) => m.status === "cancelled").length;
  const pending = allMerchants.filter(
    (m) => m.status === "pending" || m.status === "provisioning"
  ).length;

  let mrrCents = 0;
  for (const m of allMerchants) {
    if (m.status === "active") {
      mrrCents += planPriceMap[m.plan] || 0;
    }
  }

  const stats = {
    total,
    active,
    suspended,
    cancelled,
    pending,
    mrr: mrrCents,
    mrrDisplay: `R${(mrrCents / 100).toFixed(2)}`,
  };

  // Serialize dates for client component
  const serializedMerchants = allMerchants.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <AdminDashboardClient
      initialMerchants={serializedMerchants}
      initialStats={stats}
    />
  );
}
