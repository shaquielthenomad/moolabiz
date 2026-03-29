"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const redirectUrl = params.get("redirect_url");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-emerald-700">MoolaBiz</h1>
        <p className="text-sm text-slate-500 mt-1">Your WhatsApp store</p>
      </div>
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
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
