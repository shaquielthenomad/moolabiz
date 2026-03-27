import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.clerkId, userId))
    .limit(1);

  if (!merchant) redirect("/sign-in");

  return (
    <SettingsClient
      slug={merchant.slug}
      subdomain={`${merchant.slug}.store.moolabiz.shop`}
      apiSecret={merchant.apiSecret || ""}
      paymentProvider={merchant.paymentProvider}
    />
  );
}
