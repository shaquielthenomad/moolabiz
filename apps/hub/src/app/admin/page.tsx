import { redirect } from "next/navigation";
import { checkAdminSession } from "@/lib/admin-auth";

/**
 * /admin — redirects authenticated admins to /admin/dashboard,
 * or non-admins to /sign-in.
 *
 * Admin users must have publicMetadata.role === "admin" set in Clerk.
 */
export default async function AdminPage() {
  const isAdmin = await checkAdminSession();
  if (isAdmin) {
    redirect("/admin/dashboard");
  }
  redirect("/sign-in");
}
