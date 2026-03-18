"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("+27");
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
        setError(data.error || "Could not log in. Try again.");
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
    <main className="min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 px-4 pt-10 pb-6 text-center">
        <a href="/" className="text-amber-900 font-semibold text-sm tracking-wide uppercase">
          MoolaBiz
        </a>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 drop-shadow-sm">
          Log in to your shop
        </h1>
      </section>

      {/* Login Form */}
      <section className="max-w-md mx-auto px-4 -mt-4">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-5"
        >
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm text-center"
            >
              {error}
            </div>
          )}

          {/* WhatsApp Number */}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Your WhatsApp number
            </span>
            <input
              type="tel"
              required
              pattern="\+27\d{9}"
              title="Enter your number like +27821234567"
              placeholder="+27821234567"
              value={whatsappNumber}
              onChange={(e) => {
                let val = e.target.value.replace(/[\s\-()]/g, "");
                if (!val.startsWith("+27")) val = "+27";
                setWhatsappNumber(val);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
            />
          </label>

          {/* PIN */}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Your 4-digit PIN
            </span>
            <input
              type="password"
              required
              maxLength={4}
              pattern="[0-9]{4}"
              inputMode="numeric"
              title="Enter your 4-digit PIN"
              placeholder="****"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(val);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base tracking-[0.3em] text-center text-2xl"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-colors ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Logging in..." : "Log in to your shop"}
          </button>

          {/* Forgot PIN */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-amber-900 mb-0.5">Forgot your PIN?</p>
            <p className="text-xs text-amber-700 leading-snug">
              WhatsApp us at{" "}
              <a
                href="https://wa.me/27600000000?text=Hi%2C%20I%20forgot%20my%20MoolaBiz%20PIN%20and%20need%20help%20resetting%20it."
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:text-amber-900 transition-colors"
              >
                +27 60 000 0000
              </a>{" "}
              and we&apos;ll help you reset it — usually within a few minutes.
            </p>
          </div>

          <p className="text-center text-sm text-gray-500">
            Don&apos;t have a shop bot yet?{" "}
            <a href="/#signup" className="text-emerald-600 font-semibold hover:underline">
              Get one &rarr;
            </a>
          </p>
        </form>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-8">
        &copy; {new Date().getFullYear()} MoolaBiz &mdash; Built in South Africa
      </footer>
    </main>
  );
}
