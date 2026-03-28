"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const redirectUrl = params.get("redirect_url");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn
        fallbackRedirectUrl={redirectUrl || "/dashboard"}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
