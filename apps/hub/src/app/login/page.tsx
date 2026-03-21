"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("+");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber, pin }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Could not log in. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Could not connect. Check your internet and try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-slate-900 tracking-tight">
            MoolaBiz
          </a>
          <a
            href="/#signup"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Create account
          </a>
        </div>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-slate-500 text-sm">
              Log in to manage your store
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5"
          >
            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="whatsapp"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                WhatsApp number
              </label>
              <input
                id="whatsapp"
                type="tel"
                required
                pattern="^\+\d{7,15}$"
                title="Enter your number in international format, e.g. +27821234567"
                placeholder="+27821234567"
                value={whatsappNumber}
                onChange={(e) => {
                  let val = e.target.value.replace(/[\s\-()]/g, "");
                  if (!val.startsWith("+")) val = "+";
                  setWhatsappNumber(val);
                }}
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                4-digit PIN
              </label>
              <input
                id="pin"
                type="password"
                required
                maxLength={4}
                pattern="[0-9]{4}"
                inputMode="numeric"
                title="Enter your 4-digit PIN"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(val);
                }}
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base tracking-[0.35em] text-center text-2xl transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition-colors ${
                loading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>

            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <a
                href="/#signup"
                className="text-[#059669] font-medium hover:underline"
              >
                Start selling
              </a>
            </p>
          </form>

          {/* Forgot PIN */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Forgot your PIN?{" "}
              <a
                href="mailto:support@moolabiz.shop?subject=PIN%20Reset%20Request&body=Hi%2C%20I%20forgot%20my%20MoolaBiz%20PIN%20and%20need%20help%20resetting%20it."
                className="text-slate-700 font-medium hover:underline"
              >
                Email us at support@moolabiz.shop
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6">
        <p className="text-center text-xs text-slate-400">
          &copy; 2026 MoolaBiz &mdash; Made in South Africa
        </p>
      </footer>
    </main>
  );
}
