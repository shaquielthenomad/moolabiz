"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

interface Merchant {
  id: string;
  businessName: string;
  slug: string;
  whatsappNumber: string;
  paymentProvider: string;
  plan: string;
  status: string;
  coolifyAppUuid: string | null;
  subdomain: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  active: number;
  suspended: number;
  cancelled: number;
  pending: number;
  mrr: number;
  mrrDisplay: string;
}

interface Props {
  initialMerchants: Merchant[];
  initialStats: Stats;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-900/50", text: "text-emerald-400", label: "Active" },
  suspended: { bg: "bg-amber-900/50", text: "text-amber-400", label: "Suspended" },
  cancelled: { bg: "bg-red-900/50", text: "text-red-400", label: "Cancelled" },
  pending: { bg: "bg-slate-800", text: "text-slate-400", label: "Pending" },
  provisioning: { bg: "bg-blue-900/50", text: "text-blue-400", label: "Provisioning" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminDashboardClient({ initialMerchants, initialStats }: Props) {
  const { signOut } = useClerk();
  const [merchants, setMerchants] = useState<Merchant[]>(initialMerchants);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [activeTab, setActiveTab] = useState<"merchants" | "killswitch">("merchants");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function refreshData() {
    try {
      const [merchantsRes, statsRes] = await Promise.all([
        fetch("/api/admin/merchants"),
        fetch("/api/admin/stats"),
      ]);
      if (merchantsRes.ok) {
        const data = await merchantsRes.json();
        setMerchants(data.merchants);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch {
      // Silently fail refresh
    }
  }

  async function handleAction(merchantId: string, action: string, merchantName: string) {
    const actionLabels: Record<string, string> = {
      suspend: "suspend",
      reactivate: "reactivate",
      cancel: "cancel",
    };

    const label = actionLabels[action] || action;
    if (!confirm(`Are you sure you want to ${label} "${merchantName}"?`)) return;

    setLoadingAction(`${merchantId}-${action}`);
    try {
      const res = await fetch("/api/admin/merchants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Action failed");
        return;
      }

      showMessage("success", `Successfully ${action}ed "${merchantName}"`);
      await refreshData();
    } catch {
      showMessage("error", "Network error. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDelete(merchantId: string, merchantName: string) {
    if (!confirm(`PERMANENTLY DELETE "${merchantName}"?\n\nThis will remove the Coolify app, OpenClaw container, and all database records. This cannot be undone.`)) return;
    if (!confirm(`Final confirmation: Type action to delete "${merchantName}" permanently.`)) return;

    setLoadingAction(`${merchantId}-delete`);
    try {
      const res = await fetch("/api/admin/merchants/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Delete failed");
        return;
      }

      showMessage("success", `Deleted "${merchantName}"${data.warnings ? ` (warnings: ${data.warnings.join(", ")})` : ""}`);
      await refreshData();
    } catch {
      showMessage("error", "Network error. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSuspendAll() {
    if (!confirm("SUSPEND ALL ACTIVE MERCHANTS?\n\nThis will stop all running bots and storefronts immediately.")) return;
    if (!confirm("Final confirmation: This is an emergency action. Proceed?")) return;

    setLoadingAction("suspend-all");
    try {
      const res = await fetch("/api/admin/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend_all" }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Bulk suspend failed");
        return;
      }

      showMessage("success", data.message || "All merchants suspended");
      await refreshData();
    } catch {
      showMessage("error", "Network error. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col min-h-screen">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">MoolaBiz</h1>
          <p className="text-xs text-slate-500">Admin Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveTab("merchants")}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "merchants"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            Merchants
          </button>
          <button
            onClick={() => setActiveTab("killswitch")}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "killswitch"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            Kill Switches
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Message toast */}
        {message && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-900 text-emerald-200 border border-emerald-700"
                : "bg-red-900 text-red-200 border border-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Merchants" value={stats.total} />
          <StatCard label="Active" value={stats.active} accent="emerald" />
          <StatCard label="Suspended" value={stats.suspended} accent="amber" />
          <StatCard label="Monthly Revenue" value={stats.mrrDisplay} accent="emerald" />
        </div>

        {activeTab === "merchants" && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">All Merchants</h2>
              <button
                onClick={refreshData}
                className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-600"
              >
                Refresh
              </button>
            </div>

            {merchants.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No merchants yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Business</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Slug</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">WhatsApp</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {merchants.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.businessName}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{m.slug}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-3 text-slate-300 capitalize">{m.plan}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{m.whatsappNumber}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(m.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {m.status === "active" && (
                              <ActionButton
                                label="Suspend"
                                variant="amber"
                                loading={loadingAction === `${m.id}-suspend`}
                                onClick={() => handleAction(m.id, "suspend", m.businessName)}
                              />
                            )}
                            {(m.status === "suspended" || m.status === "cancelled") && (
                              <ActionButton
                                label="Reactivate"
                                variant="emerald"
                                loading={loadingAction === `${m.id}-reactivate`}
                                onClick={() => handleAction(m.id, "reactivate", m.businessName)}
                              />
                            )}
                            {m.status === "active" && (
                              <ActionButton
                                label="Cancel"
                                variant="red"
                                loading={loadingAction === `${m.id}-cancel`}
                                onClick={() => handleAction(m.id, "cancel", m.businessName)}
                              />
                            )}
                            <ActionButton
                              label="Delete"
                              variant="red"
                              loading={loadingAction === `${m.id}-delete`}
                              onClick={() => handleDelete(m.id, m.businessName)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "killswitch" && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Emergency Controls</h2>
              <p className="text-sm text-slate-400 mb-6">
                These actions affect all merchants on the platform. Use with extreme caution.
              </p>

              <div className="space-y-4">
                {/* Suspend All */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Suspend All Merchants</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Immediately stops all active merchant bots and storefronts.
                        Each merchant will need to be individually reactivated.
                      </p>
                      <p className="text-xs text-amber-400 mt-2">
                        Currently {stats.active} active merchant{stats.active !== 1 ? "s" : ""} will be affected.
                      </p>
                    </div>
                    <button
                      onClick={handleSuspendAll}
                      disabled={loadingAction === "suspend-all" || stats.active === 0}
                      className="ml-4 shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      {loadingAction === "suspend-all" ? "Suspending..." : "Suspend All"}
                    </button>
                  </div>
                </div>

                {/* Maintenance Mode */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Maintenance Mode</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Sets a global flag that displays &quot;Under maintenance&quot; on all bot storefronts.
                        Bots remain running but customers see the maintenance notice.
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Requires MAINTENANCE_MODE env var to be read by bot storefronts.
                      </p>
                    </div>
                    <span className="ml-4 shrink-0 px-4 py-2 bg-slate-700 text-slate-500 text-sm font-medium rounded-md">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "emerald" | "amber" | "red";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "amber"
      ? "text-amber-400"
      : accent === "red"
      ? "text-red-400"
      : "text-white";

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  variant,
  loading,
  onClick,
}: {
  label: string;
  variant: "emerald" | "amber" | "red";
  loading: boolean;
  onClick: () => void;
}) {
  const styles = {
    emerald: "border-emerald-700 text-emerald-400 hover:bg-emerald-900/50",
    amber: "border-amber-700 text-amber-400 hover:bg-amber-900/50",
    red: "border-red-700 text-red-400 hover:bg-red-900/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-2 py-1 text-xs font-medium rounded border transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading ? "..." : label}
    </button>
  );
}
