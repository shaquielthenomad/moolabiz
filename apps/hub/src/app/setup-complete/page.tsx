"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type ProvisionStatus = "loading" | "provisioning" | "success" | "already_active" | "error";

function SetupContent() {
  const params = useSearchParams();
  const slug = params.get("slug") || "your-business";
  const subdomain = `${slug}.bot.moolabiz.shop`;
  const [status, setStatus] = useState<ProvisionStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (slug === "your-business") return;

    async function triggerProvision() {
      try {
        const res = await fetch("/api/provision-after-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Setup failed. Please contact support.");
          setStatus("error");
          return;
        }

        if (data.status === "already_active") {
          setStatus("already_active");
        } else if (data.status === "provisioning") {
          setStatus("provisioning");
        } else {
          setStatus("success");
        }
      } catch {
        setError("Could not connect. Please refresh the page.");
        setStatus("error");
      }
    }

    triggerProvision();
  }, [slug]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <div
              role="status"
              aria-label="Setting up your bot"
              className="mx-auto w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"
            />
            <h1 className="text-2xl font-bold text-gray-900">
              Payment received!
            </h1>
            <p className="text-gray-500">Setting up your shop bot...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl" aria-hidden="true">{"\u{274C}"}</div>
            <h1 className="text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Try Again
            </button>
            <p className="text-xs text-gray-500">
              Need help? Email support@moolabiz.shop
            </p>
          </>
        )}

        {(status === "success" || status === "already_active" || status === "provisioning") && (
          <>
            <div className="text-5xl" aria-hidden="true">{"\u{1F389}"}</div>
            <h1 className="text-2xl font-bold text-gray-900">
              {status === "already_active" ? "Your bot is live!" : "Your bot is being set up!"}
            </h1>
            <p className="text-gray-600">
              {status === "already_active" ? "Your bot is live at:" : "Your bot will be live at:"}
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 font-mono text-sm break-all">
              https://{subdomain}
            </div>
            {status !== "already_active" && (
              <p className="text-sm text-gray-500">
                This usually takes 5-10 minutes.
              </p>
            )}

            <div className="text-left space-y-4 bg-emerald-50 rounded-xl p-5 border border-emerald-200">
              <h3 className="font-bold text-emerald-900 text-lg">
                What happens next
              </h3>
              <ol className="list-decimal list-inside space-y-3 text-sm text-emerald-800">
                <li>
                  {status === "already_active" ? "Your bot is running" : "Your bot is being deployed now"}
                </li>
                <li>
                  Make sure you have <strong>WhatsApp Business</strong> installed
                </li>
                <li>
                  We&apos;ll send setup instructions to your WhatsApp
                </li>
                <li>
                  Reply to confirm and your bot goes live!
                </li>
              </ol>
              <p className="text-xs text-emerald-600 mt-2">
                Need help? Email us at support@moolabiz.shop
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/?text=I%20just%20got%20my%20own%20WhatsApp%20shop%20bot%20from%20MoolaBiz!%20Check%20it%20out%3A%20https://${subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                Share on WhatsApp
              </a>
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back to MoolaBiz
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function SetupCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
