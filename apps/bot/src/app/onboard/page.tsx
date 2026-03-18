"use client";

import { useState, useEffect, useCallback } from "react";

export default function OnboardPage() {
  const [businessName, setBusinessName] = useState("Your Store");
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = document.title.replace(/ \| MoolaBiz$/, "");
      if (t) setBusinessName(t);
    }
  }, []);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch("/api/onboard/qr");
      if (!res.ok) return;
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        setLoading(false);
        return;
      }
      if (data.qr) {
        setQr(data.qr);
        setLoading(false);
      } else {
        // No QR yet, keep polling
        setLoading(true);
      }
    } catch {
      // provisioner not ready
    }
  }, []);

  // Initial fetch + poll every 5s
  useEffect(() => {
    fetchQR();
    const interval = setInterval(fetchQR, 5000);
    return () => clearInterval(interval);
  }, [fetchQR]);

  // Connected state
  if (connected) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp connected</h1>
          <p className="text-slate-500">Your bot is live. Message it to start setting up your store.</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-3">
            <p className="text-sm font-semibold text-slate-700">Quick commands:</p>
            <div className="space-y-2 text-sm text-slate-600">
              <p><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">/add-product Chicken Braai R45</code></p>
              <p><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">/set-payment-key sk_live_xxx</code></p>
              <p><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">/orders</code></p>
            </div>
          </div>
          <a href="/" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors">
            Go to your store
          </a>
          <p className="text-xs text-slate-400">Powered by MoolaBiz</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center px-4 py-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-600 tracking-wide uppercase mb-2">MoolaBiz</p>
          <h1 className="text-2xl font-bold text-slate-900">Connect your WhatsApp</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Link your WhatsApp to <span className="font-medium text-slate-700">{businessName}</span>
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          {loading || !qr ? (
            <div className="w-72 h-72 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 bg-slate-50">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Generating QR code...</p>
            </div>
          ) : (
            <pre
              className="bg-white border border-slate-200 rounded-xl p-4 text-[6px] sm:text-[8px] leading-none font-mono select-none overflow-hidden"
              style={{ letterSpacing: "-0.5px", lineHeight: "1" }}
            >
              {qr}
            </pre>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
          <p className="text-sm font-semibold text-slate-700 mb-2">How to scan:</p>
          <ol className="space-y-1.5 text-sm text-slate-500">
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">1.</span>
              Open WhatsApp on your phone
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">2.</span>
              Go to Settings &gt; Linked Devices
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">3.</span>
              Tap &quot;Link a Device&quot; and scan the code above
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-400 text-center">
          QR refreshes automatically. Powered by MoolaBiz.
        </p>
      </div>
    </main>
  );
}
