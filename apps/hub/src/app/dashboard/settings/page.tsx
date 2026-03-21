import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, session.merchantId))
    .limit(1);

  if (!merchant) redirect("/login");

  return (
    <SettingsClient
      slug={merchant.slug}
      subdomain={`${merchant.slug}.store.moolabiz.shop`}
      apiSecret={merchant.apiSecret || ""}
      paymentProvider={merchant.paymentProvider}
    />
  );
}
