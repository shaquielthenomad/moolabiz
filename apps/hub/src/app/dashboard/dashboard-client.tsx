"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

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

/* MoolaBiz "Moola Bubble" mark */
function Mark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M7 3h22a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H15l-7 6v-6H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z" fill="#0E7C5A" />
      <path d="M13.7 20.2V9.8h4.9c2.2 0 3.7 1.3 3.7 3.3 0 1.5-.9 2.6-2.3 3.05l2.6 4.05h-2.5l-2.3-3.75h-1.7v3.75h-2.4Zm2.4-5.65h2.2c1 0 1.6-.5 1.6-1.35S19.3 11.5 18.3 11.5h-2.2v3.05Z" fill="#F0A92B" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-tint text-primary border border-primary/20">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        Active
      </span>
    );
  }

  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-warn-tint text-warn border border-warn/20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        Suspended
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-canvas-sunk text-ink-muted border border-hairline">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
        Cancelled
      </span>
    );
  }

  // pending / provisioning / fallback — all warm neutral/gold
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-moola-tint text-moola-deep border border-moola/20">
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0 animate-pulse" aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function DashboardNav({ current }: { current: "overview" | "products" | "orders" | "settings" }) {
  const tabs = [
    { id: "overview" as const, label: "Overview", href: "/dashboard" },
    { id: "products" as const, label: "Products", href: "/dashboard/products" },
    { id: "orders" as const, label: "Orders", href: "/dashboard/orders" },
    { id: "settings" as const, label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <nav className="flex gap-1 bg-canvas-sunk rounded-xl p-1 border border-hairline">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            current === tab.id
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
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
  const { signOut } = useClerk();
  const [status, setStatus] = useState(merchant.status);
  const [loading, setLoading] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
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
    await signOut({ redirectUrl: "/" });
  }

  const memberSince = new Date(merchant.createdAt).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Store URL points to the Vendure storefront; bot URL is for the onboard/QR page.
  const storeUrl = merchant.slug ? `https://${merchant.slug}.store.moolabiz.shop` : null;
  const storeHost = merchant.slug ? `${merchant.slug}.store.moolabiz.shop` : null;
  const connected = !!merchant.openclawContainerId;

  function copyStoreLink() {
    if (!storeUrl) return;
    navigator.clipboard?.writeText(storeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-canvas pb-16">
      {/* Header */}
      <header className="bg-surface border-b border-hairline px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <Mark className="w-8 h-8" />
            <span className="font-display font-extrabold text-lg text-ink tracking-tight">{merchant.businessName}</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-ink-muted hover:text-ink px-3 py-2 rounded-lg hover:bg-canvas-sunk transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Inline notification */}
      {notification && (
        <div
          className={`max-w-4xl mt-4 px-4 py-3 rounded-xl text-sm font-medium border ${
            notification.type === "error"
              ? "bg-error-tint text-error border-error/20"
              : "bg-primary-tint text-primary border-primary/20"
          }`}
          style={{ marginLeft: "auto", marginRight: "auto", maxWidth: "56rem", margin: "1rem 1rem 0" }}
        >
          {notification.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">

        {/* Tabs */}
        <DashboardNav current="overview" />

        {/* ── Hero: "Your shop" (the open-for-business moment) ─────────────── */}
        <section
          className="relative overflow-hidden rounded-[28px] p-7 text-white"
          style={{ backgroundColor: "#0F2A24", boxShadow: "0 14px 36px rgba(15,42,36,.28)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(420px 240px at 88% 0%, rgba(240,169,43,.16), transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "#9CB3AC" }}>Your shop</p>
              <StatusBadge status={status} />
            </div>
            <h2 className="font-display font-extrabold mt-1.5 text-3xl text-white">{merchant.businessName}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm" style={{ color: "#9CB3AC" }}>
              {status === "active" ? (
                connected ? (
                  <>
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "#F0A92B" }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#F0A92B" }} />
                    </span>
                    Live and taking orders, 24/7
                  </>
                ) : (
                  "Almost there — connect your WhatsApp below to go live"
                )
              ) : (
                "Your store is paused — reactivate any time below"
              )}
            </p>

            {storeHost && (
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-mono" style={{ background: "rgba(255,255,255,.08)", color: "#EAF1EE" }}>
                  <span className="truncate">{storeHost}</span>
                  <button onClick={copyStoreLink} className="ml-auto shrink-0 text-xs font-semibold rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                {storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-ink"
                    style={{ background: "#fff" }}
                  >
                    View store <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Connect WhatsApp — highest-stakes moment, made prominent ─────── */}
        {status === "active" && (
          connected ? (
            <a
              href={`https://${merchant.slug}.bot.moolabiz.shop/onboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-primary-tint border border-primary/20 rounded-2xl p-5 hover:shadow-md transition-shadow"
            >
              <span className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center shrink-0 shadow-sm">
                <WhatsAppIcon className="w-5 h-5 text-primary" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink text-sm">Connect your WhatsApp</span>
                <span className="block text-[13px] text-ink-muted mt-0.5">Scan one QR code to link your number. Your customers keep messaging the number they already know.</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0">
                Scan QR <ExternalLinkIcon className="w-3.5 h-3.5" />
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-4 bg-moola-tint border border-moola/30 rounded-2xl p-5">
              <span className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center shrink-0 shadow-sm">
                <WhatsAppIcon className="w-5 h-5 text-moola-deep" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-ink text-sm">Setting up your WhatsApp bot…</span>
                <span className="block text-[13px] text-ink-muted mt-0.5">This finishes automatically once your store deploys — usually within 5–10 minutes. Refresh shortly.</span>
              </span>
            </div>
          )
        )}

        {/* ── Sales summary (honest placeholder until the data pipeline lands) */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: "Sales today", hint: "Tracking soon" },
            { label: "Orders today", hint: "Tracking soon" },
            { label: "New customers", hint: "Tracking soon" },
          ].map((k) => (
            <div key={k.label} className="bg-surface rounded-2xl border border-hairline p-5 shadow-sm">
              <p className="text-[13px] text-ink-muted font-medium">{k.label}</p>
              <p className="font-display font-extrabold text-2xl text-ink mt-1.5 tnum">—</p>
              <p className="text-xs text-moola-deep mt-1 font-medium">{k.hint}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted -mt-1 px-1">
          Live sales &amp; order summaries arrive here soon. Today, manage orders &amp; products from the tabs above, or just chat to your shop on WhatsApp.
        </p>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl shadow-sm border border-hairline p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Manage</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <a href="/dashboard/products" className="flex items-center justify-center gap-2 bg-canvas-sunk hover:bg-hairline text-ink font-semibold text-sm py-3 rounded-xl transition-colors">
              Manage products
            </a>
            <a href="/dashboard/orders" className="flex items-center justify-center gap-2 bg-canvas-sunk hover:bg-hairline text-ink font-semibold text-sm py-3 rounded-xl transition-colors">
              View orders
            </a>

            {status === "active" && (
              <button
                onClick={() => handleAction("pause")}
                disabled={!!loading}
                className="w-full bg-canvas-sunk hover:bg-hairline text-ink font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "pause" ? "Pausing…" : "Pause store"}
              </button>
            )}

            {(status === "suspended" || status === "cancelled") && (
              <button
                onClick={() => handleAction("reactivate")}
                disabled={!!loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "reactivate" ? "Reactivating…" : "Reactivate store"}
              </button>
            )}

            <button
              disabled
              className="w-full bg-canvas text-ink-muted font-semibold text-sm py-3 rounded-xl cursor-not-allowed border border-hairline"
            >
              Change plan — coming soon
            </button>
          </div>

          {status !== "cancelled" && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full text-ink-muted hover:text-error font-medium text-sm py-2 mt-2 transition-colors"
            >
              Cancel subscription
            </button>
          )}

          {showCancelConfirm && (
            <div className="bg-error-tint border border-error/20 rounded-xl p-4 space-y-3 mt-2">
              <p className="text-sm text-error font-medium">
                This will stop your store. Customers won&apos;t be able to browse or order.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("cancel")}
                  disabled={!!loading}
                  className="flex-1 bg-error hover:opacity-90 text-white font-semibold text-sm py-2.5 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === "cancel" ? "Cancelling…" : "Cancel subscription"}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-surface hover:bg-canvas-sunk text-ink font-semibold text-sm py-2.5 rounded-lg border border-hairline transition-colors"
                >
                  Keep store
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Account details ──────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl shadow-sm border border-hairline p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Account details</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">WhatsApp</dt>
              <dd className="font-medium text-ink text-right">{merchant.whatsappNumber}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Payments</dt>
              <dd className="font-medium text-ink capitalize text-right">{merchant.paymentProvider}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Plan</dt>
              <dd className="font-medium text-ink text-right">{merchant.planName} ({merchant.planPrice}/month)</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Member since</dt>
              <dd className="font-medium text-ink text-right">{memberSince}</dd>
            </div>
          </dl>
        </div>

        {/* Support */}
        <div className="text-center text-sm text-ink-muted pt-1">
          Need help?{" "}
          <a href="mailto:support@moolabiz.shop" className="text-primary font-medium hover:underline">
            support@moolabiz.shop
          </a>
        </div>
      </div>

      <footer className="text-center text-xs text-ink-muted pt-8">
        &copy; {new Date().getFullYear()} MoolaBiz &middot; Built in South Africa 🇿🇦
      </footer>
    </main>
  );
}
