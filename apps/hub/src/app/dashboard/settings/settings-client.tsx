"use client";

import { useState } from "react";

export default function SettingsClient({
  slug,
  subdomain,
  apiSecret,
  paymentProvider,
}: {
  slug: string;
  subdomain: string;
  apiSecret: string;
  paymentProvider: string;
}) {
  const [yocoKey, setYocoKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!yocoKey.trim()) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`https://${subdomain}/api/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiSecret}`,
        },
        body: JSON.stringify({ key: "yoco_secret_key", value: yocoKey.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save. Try again.");
      } else {
        setSaved(true);
        setYocoKey("");
      }
    } catch {
      setError("Could not connect to your store. Is it deployed?");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-4 mb-8 text-sm">
        <a href="/dashboard" className="text-slate-400 hover:text-slate-600">Overview</a>
        <a href="/dashboard/products" className="text-slate-400 hover:text-slate-600">Products</a>
        <a href="/dashboard/orders" className="text-slate-400 hover:text-slate-600">Orders</a>
        <span className="text-slate-900 font-medium">Settings</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Payment Settings</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Connect your payment provider so customers can pay you directly. Your money goes straight to your account — MoolaBiz never touches it.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Current provider
          </label>
          <p className="text-sm text-slate-900 capitalize">{paymentProvider}</p>
        </div>

        <div>
          <label htmlFor="yocoKey" className="block text-sm font-medium text-slate-700 mb-1.5">
            {paymentProvider === "yoco" ? "Yoco Secret Key" :
             paymentProvider === "ozow" ? "Ozow Private Key" :
             "PayFast Merchant Key"}
          </label>
          <input
            id="yocoKey"
            type="password"
            placeholder={paymentProvider === "yoco" ? "sk_live_..." : "Enter your key"}
            value={yocoKey}
            onChange={(e) => setYocoKey(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-base font-mono"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            {paymentProvider === "yoco"
              ? "Find this in your Yoco Portal → Developers → API Keys"
              : "Find this in your payment provider's dashboard"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm">
            Payment key saved. Your customers can now pay you directly.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !yocoKey.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save payment key"}
        </button>
      </div>

      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">How it works</h3>
        <ol className="text-sm text-slate-500 space-y-1.5 list-decimal list-inside">
          <li>Enter your payment provider API key above</li>
          <li>When a customer orders from your store, they'll be redirected to pay via {paymentProvider}</li>
          <li>Money goes directly to your {paymentProvider} account</li>
          <li>MoolaBiz never holds or processes your customer payments</li>
        </ol>
      </div>
    </div>
  );
}
