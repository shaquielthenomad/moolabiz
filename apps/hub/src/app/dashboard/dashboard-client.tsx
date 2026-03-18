"use client";

import { useState } from "react";

interface MerchantData {
  id: string;
  businessName: string;
  whatsappNumber: string;
  paymentProvider: string;
  plan: string;
  planName: string;
  planPrice: string;
  status: string;
  subdomain: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        {/* Pulsing green dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Active
      </span>
    );
  }

  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-amber-100 text-amber-800 border border-amber-200">
        {/* Warning icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-amber-600" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        Suspended
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-red-100 text-red-800 border border-red-200">
        {/* X icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
        Cancelled
      </span>
    );
  }

  // Fallback for pending, provisioning, etc.
  const fallbackColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    provisioning: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${
        fallbackColors[status] || "bg-gray-100 text-gray-800 border-gray-200"
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0" aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function DashboardClient({ merchant }: { merchant: MerchantData }) {
  const [status, setStatus] = useState(merchant.status);
  const [loading, setLoading] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  async function handleAction(action: "pause" | "cancel" | "reactivate") {
    setLoading(action);
    try {
      const res = await fetch(`/api/dashboard/${action}`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.status) {
        setStatus(data.status);
      } else {
        alert(data.error || "Something went wrong. Try again.");
      }
    } catch {
      alert("Could not connect. Check your internet and try again.");
    }
    setLoading("");
    setShowCancelConfirm(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const memberSince = new Date(merchant.createdAt).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const botUrl = merchant.subdomain
    ? `https://${merchant.subdomain}`
    : null;

  return (
    <main className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 px-4 py-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-amber-900 font-semibold text-xs tracking-wide uppercase">
              MoolaBiz Dashboard
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1 drop-shadow-sm">
              Welcome, {merchant.businessName}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 backdrop-blur text-amber-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Your Bot</h2>
            <StatusBadge status={status} />
          </div>

          <div className="space-y-3 text-sm">
            {botUrl && (
              <div className="flex items-start justify-between">
                <span className="text-gray-500">Bot URL</span>
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 font-semibold hover:underline text-right break-all"
                >
                  {merchant.subdomain}
                </a>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Plan</span>
              <span className="font-semibold text-gray-900">
                {merchant.planName} &mdash; {merchant.planPrice}/month
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-gray-900 capitalize">{status}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {/* View Bot */}
            {botUrl && status === "active" && (
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-4 rounded-xl shadow-md transition-colors"
              >
                View my bot
              </a>
            )}

            {/* Pause */}
            {status === "active" && (
              <button
                onClick={() => handleAction("pause")}
                disabled={!!loading}
                className={`flex items-center justify-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold text-base py-4 rounded-xl transition-colors ${
                  loading === "pause" ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading === "pause" ? "Pausing..." : "Pause my bot"}
              </button>
            )}

            {/* Reactivate */}
            {(status === "suspended" || status === "cancelled") && (
              <button
                onClick={() => handleAction("reactivate")}
                disabled={!!loading}
                className={`flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-4 rounded-xl shadow-md transition-colors ${
                  loading === "reactivate" ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading === "reactivate"
                  ? "Reactivating..."
                  : "Reactivate my bot"}
              </button>
            )}

            {/* Change Plan */}
            <button
              disabled
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-bold text-base py-4 rounded-xl cursor-not-allowed"
            >
              Change plan (coming soon)
            </button>

            {/* Cancel */}
            {status !== "cancelled" && !showCancelConfirm && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center justify-center gap-2 text-red-500 hover:text-red-700 font-semibold text-sm py-3 transition-colors"
              >
                Cancel my subscription
              </button>
            )}

            {/* Cancel Confirm */}
            {showCancelConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center space-y-3">
                <p className="text-red-700 font-semibold text-sm">
                  Are you sure? Your bot will be stopped and customers won&apos;t be
                  able to order.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => handleAction("cancel")}
                    disabled={!!loading}
                    className={`bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors ${
                      loading === "cancel" ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {loading === "cancel" ? "Cancelling..." : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                  >
                    Keep my bot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Account Details
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Business</dt>
              <dd className="font-semibold text-gray-900">
                {merchant.businessName}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">WhatsApp</dt>
              <dd className="font-semibold text-gray-900">
                {merchant.whatsappNumber}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Payments</dt>
              <dd className="font-semibold text-gray-900 capitalize">
                {merchant.paymentProvider}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Plan</dt>
              <dd className="font-semibold text-gray-900">
                {merchant.planName} ({merchant.planPrice}/mo)
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-semibold text-gray-900">{memberSince}</dd>
            </div>
          </dl>
        </div>

        {/* Help */}
        <div className="text-center text-sm text-gray-500 pt-2">
          <p>
            Need help? WhatsApp us at{" "}
            <a
              href="https://wa.me/27000000000"
              className="text-emerald-600 font-semibold hover:underline"
            >
              +27 00 000 0000
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pt-8">
        &copy; {new Date().getFullYear()} MoolaBiz &mdash; Built in South Africa
      </footer>
    </main>
  );
}
