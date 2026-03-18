"use client";

import { useState, useEffect } from "react";

export default function OnboardPage() {
  const [businessName, setBusinessName] = useState("Your Store");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const title = document.title;
      if (title && !title.includes("MoolaBiz")) {
        setBusinessName(title.replace(/ — Shop Online$/, ""));
      }
    }
  }, []);

  // Poll for connection status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/onboard/status");
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setConnected(true);
            clearInterval(interval);
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
          <p className="text-slate-500">
            Your bot is live. Message it on WhatsApp to start setting up your store.
          </p>
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
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-600 tracking-wide uppercase mb-2">MoolaBiz</p>
          <h1 className="text-2xl font-bold text-slate-900">Connect your WhatsApp</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Link your WhatsApp to <span className="font-medium text-slate-700">{businessName}</span>
          </p>
        </div>

        {/* OpenClaw UI in iframe — proxied through our API */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm" style={{ height: "500px" }}>
          <iframe
            src="/api/onboard/proxy/"
            className="w-full h-full"
            title="WhatsApp QR Code"
            allow="clipboard-write"
          />
        </div>

        {/* Instructions below */}
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
              Tap &quot;Link a Device&quot; and scan the code shown above
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-400 text-center">Powered by MoolaBiz</p>
      </div>
    </main>
  );
}
