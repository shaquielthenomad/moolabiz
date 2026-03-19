"use client";

import { useState } from "react";

interface MerchantData {
  id: string;
  slug: string;
  businessName: string;
  whatsappNumber: string;
  paymentProvider: string;
  plan: string;
  planName: string;
  planPrice: string;
  status: string;
  subdomain: string | null;
  openclawContainerId: string | null;
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

function DashboardNav({ current }: { current: "overview" | "products" | "orders" }) {
  const tabs = [
    { id: "overview" as const, label: "Overview", href: "/dashboard" },
    { id: "products" as const, label: "Products", href: "/dashboard/products" },
    { id: "orders" as const, label: "Orders", href: "/dashboard/orders" },
    { id: "settings" as const, label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <nav className="flex gap-1 bg-slate-100 rounded-lg p-1">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            current === tab.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

export { DashboardNav };

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

        {/* Navigation tabs */}
        <div className="flex justify-center">
          <DashboardNav current="overview" />
        </div>

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

        {/* WhatsApp connection card */}
        {status === "active" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">WhatsApp Bot</h2>
              {merchant.openclawContainerId ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Deployed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" aria-hidden="true" />
                  Not connected
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {merchant.openclawContainerId
                ? "Your WhatsApp bot is running. Scan the QR code to connect your WhatsApp number."
                : "Your WhatsApp bot will be set up when your store finishes deploying."}
            </p>
            {merchant.openclawContainerId && (
              <a
                href={`https://${merchant.slug}.bot.moolabiz.shop/onboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Connect WhatsApp
                <ExternalLinkIcon className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>
        )}

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
