"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SetupContent() {
  const params = useSearchParams();
  const slug = params.get("slug") || "your-business";
  const subdomain = `${slug}.bot.moolabiz.shop`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
        <div className="text-5xl">{"\u{1F389}"}</div>
        <h1 className="text-2xl font-bold text-gray-900">
          Payment received!
        </h1>
        <p className="text-gray-600">
          Your bot will be live at:
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 font-mono text-sm break-all">
          https://{subdomain}
        </div>
        <p className="text-sm text-gray-500">
          This usually takes 5-10 minutes. You&apos;ll get a WhatsApp message when it&apos;s ready.
        </p>

        <div className="text-left space-y-4 bg-emerald-50 rounded-xl p-5 border border-emerald-200">
          <h3 className="font-bold text-emerald-900 text-lg">
            What happens next
          </h3>
          <ol className="list-decimal list-inside space-y-3 text-sm text-emerald-800">
            <li>
              Your bot is being deployed right now
            </li>
            <li>
              Download <strong>WhatsApp Business</strong> from Play Store if you haven&apos;t already
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
      </div>
    </main>
  );
}

export default function SetupCompletePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <SetupContent />
    </Suspense>
  );
}
