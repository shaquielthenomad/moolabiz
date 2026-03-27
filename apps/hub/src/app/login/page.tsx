import { redirect } from "next/navigation";

/**
 * Legacy /login route -- redirects to the Clerk sign-in page.
 */
export default function LoginPage() {
  redirect("/sign-in");
}
