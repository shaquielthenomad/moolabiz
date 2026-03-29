import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
  "/api/webhooks(.*)",
  "/api/webhook(.*)",
  "/api/provision(.*)",
  "/api/channel-token(.*)",
  "/api/health(.*)",
  "/api/waitlist(.*)",
  "/api/checkout(.*)",
  "/api/storefront(.*)",
  "/api/vendure-bridge(.*)",
  "/api/admin/auth(.*)",
  "/pricing(.*)",
  "/about(.*)",
  "/setup-complete(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
