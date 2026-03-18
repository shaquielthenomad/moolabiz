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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Active
      </span>
    );
  }

  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        Suspended
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5 shrink-0"
          aria-hidden="true"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
        Cancelled
      </span>
    );
  }

  const fallbackConfig: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    provisioning: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
        fallbackConfig[status] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function DashboardClient({ merchant }: { merchant: MerchantData }) {
  const [status, setStatus] = useState(merchant.status);
  const [loading, setLoading] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notification, setNotification] = useState<{ type: "error" | "success"; message: string } | null>(null);

  function showNotification(type: "error" | "success", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleAction(action: "pause" | "cancel" | "reactivate") {
    setLoading(action);
    try {
      const res = await fetch(`/api/dashboard/${action}`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.status) {
        setStatus(data.status);
        showNotification("success", action === "pause" ? "Your store has been paused." : action === "cancel" ? "Your subscription has been cancelled." : "Your store is now active.");
      } else {
        showNotification("error", data.error || "Something went wrong. Please try again.");
      }
    } catch {
      showNotification("error", "Could not connect. Check your internet and try again.");
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

  const botUrl = merchant.subdomain ? `https://${merchant.subdomain}` : null;

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dashboard</p>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              {merchant.businessName}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Inline notification */}
      {notification && (
        <div
          className={`mx-auto max-w-2xl mt-4 mx-4 px-4 py-3 rounded-lg text-sm font-medium border ${
            notification.type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
          style={{ marginLeft: "auto", marginRight: "auto", maxWidth: "42rem", margin: "1rem 1rem 0" }}
        >
          {notification.message}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">

        {/* Store status card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Your store</h2>
            <StatusBadge status={status} />
          </div>

          <div className="space-y-3 text-sm">
            {botUrl && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Store URL</span>
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-700 hover:underline text-right break-all"
                >
                  {merchant.subdomain}
                  <ExternalLinkIcon className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900">
                {merchant.planName} &mdash; {merchant.planPrice}/mo
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Actions</h2>
          <div className="space-y-2">
            {botUrl && status === "active" && (
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                View store
              </a>
            )}

            {status === "active" && (
              <button
                onClick={() => handleAction("pause")}
                disabled={!!loading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "pause" ? "Pausing..." : "Pause store"}
              </button>
            )}

            {(status === "suspended" || status === "cancelled") && (
              <button
                onClick={() => handleAction("reactivate")}
                disabled={!!loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "reactivate" ? "Reactivating..." : "Reactivate store"}
              </button>
            )}

            <button
              disabled
              className="w-full bg-slate-50 text-slate-400 font-semibold text-sm py-3 rounded-lg cursor-not-allowed border border-slate-200"
            >
              Change plan — coming soon
            </button>

            {status !== "cancelled" && !showCancelConfirm && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full text-slate-400 hover:text-red-600 font-medium text-sm py-2 transition-colors"
              >
                Cancel subscription
              </button>
            )}

            {showCancelConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-red-700 font-medium">
                  This will stop your store. Customers won&apos;t be able to browse or order.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("cancel")}
                    disabled={!!loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === "cancel" ? "Cancelling..." : "Cancel subscription"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm py-2.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    Keep store
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Account details</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Business name</dt>
              <dd className="font-medium text-slate-900 text-right">{merchant.businessName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">WhatsApp</dt>
              <dd className="font-medium text-slate-900 text-right">{merchant.whatsappNumber}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Payments</dt>
              <dd className="font-medium text-slate-900 capitalize text-right">
                {merchant.paymentProvider}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium text-slate-900 text-right">
                {merchant.planName} ({merchant.planPrice}/mo)
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Member since</dt>
              <dd className="font-medium text-slate-900 text-right">{memberSince}</dd>
            </div>
          </dl>
        </div>

        {/* Support */}
        <div className="text-center text-sm text-slate-500 pt-1">
          Need help?{" "}
          <a
            href="mailto:support@moolabiz.shop"
            className="text-emerald-600 font-medium hover:underline"
          >
            support@moolabiz.shop
          </a>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 pt-8">
        &copy; {new Date().getFullYear()} MoolaBiz
      </footer>
    </main>
  );
}
