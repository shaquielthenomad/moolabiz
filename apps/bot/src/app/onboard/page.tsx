"use client";

import { useState, useEffect, useCallback } from "react";

export default function OnboardPage() {
  const [businessName, setBusinessName] = useState("Your Store");
  const [connected, setConnected] = useState(false);
  const [controlUi, setControlUi] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = document.title.replace(/ \| MoolaBiz$/, "");
      if (t) setBusinessName(t);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboard/qr");
      if (!res.ok) return;
      const data = await res.json();
      if (data.controlUi) setControlUi(data.controlUi);
      if (data.connected) {
        setConnected(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch {
      // provisioner not ready
    }
  }, []);

  // Initial fetch + poll every 5s
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

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
          <a href="https://moolabiz.shop/dashboard" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors">
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

        {/* Easy Mode Control UI link */}
        <div className="flex justify-center">
          {loading ? (
            <div className="w-72 h-72 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 bg-slate-50">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Setting up your bot...</p>
            </div>
          ) : controlUi ? (
            <div className="w-full space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75H16.5v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75H16.5v-.75z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-emerald-800">
                  Your bot is ready! Scan the QR code to connect WhatsApp.
                </p>
                <a
                  href={controlUi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
                >
                  Open QR Scanner
                </a>
              </div>
            </div>
          ) : (
            <div className="w-72 h-72 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 bg-slate-50">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Preparing your bot...</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
          <p className="text-sm font-semibold text-slate-700 mb-2">How to connect:</p>
          <ol className="space-y-1.5 text-sm text-slate-500">
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">1.</span>
              Click &quot;Open QR Scanner&quot; above
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">2.</span>
              Open WhatsApp on your phone
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">3.</span>
              <span>
                Go to Settings &gt; Linked Devices
                <span className="block text-xs text-slate-400 mt-0.5">On WhatsApp Business: tap the menu &gt; Linked Devices</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">4.</span>
              Tap &quot;Link a Device&quot; and scan the QR code
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-400 text-center">
          This page updates automatically when connected. Powered by MoolaBiz.
        </p>
      </div>
    </main>
  );
}
