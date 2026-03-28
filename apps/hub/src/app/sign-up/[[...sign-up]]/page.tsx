"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignUpContent() {
  const params = useSearchParams();
  const redirectUrl = params.get("redirect_url");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp
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

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
