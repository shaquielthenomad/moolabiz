"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { DashboardNav } from "../dashboard-client";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  code: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

interface MerchantInfo {
  slug: string;
  businessName: string;
  useVendure: boolean;
}

// Vendure order states mapped to simple dashboard labels
const VENDURE_STATE_LABELS: Record<string, string> = {
  AddingItems: "Draft",
  ArrangingPayment: "Pending",
  // COD order accepted — waiting for merchant to collect cash
  PaymentAuthorized: "Awaiting cash payment",
  PaymentSettled: "Paid",
  PartiallyShipped: "Partially Shipped",
  Shipped: "Shipped",
  PartiallyDelivered: "Partially Delivered",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

// Which states can advance via a simple state transition, and to what.
// PaymentAuthorized is handled separately via the "settle" action.
const VENDURE_NEXT_STATE: Record<string, string> = {
  PaymentSettled: "Shipped",
  Shipped: "Delivered",
};

function displayStatus(status: string): string {
  return VENDURE_STATE_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: string }) {
  const label = displayStatus(status);
  const configMap: Record<string, string> = {
    AddingItems: "bg-slate-50 text-slate-600 border-slate-200",
    ArrangingPayment: "bg-amber-50 text-amber-700 border-amber-200",
    // COD order awaiting cash collection — amber to signal merchant action required
    PaymentAuthorized: "bg-amber-100 text-amber-800 border-amber-300",
    PaymentSettled: "bg-blue-50 text-blue-700 border-blue-200",
    Shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cancelled: "bg-red-50 text-red-600 border-red-200",
    // Legacy statuses
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
        configMap[status] || "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function OrdersClient({
  merchant,
  initialOrders,
  fetchError,
}: {
  merchant: MerchantInfo;
  initialOrders: Order[];
  fetchError: string;
}) {
  const { signOut } = useClerk();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [notification, setNotification] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState("");

  function showNotif(type: "error" | "success", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleUpdateStatus(order: Order, newState: string) {
    setLoading(order.id);
    try {
      const res = await fetch(`/api/dashboard/orders/${order.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: data.state || newState } : o
          )
        );
        showNotif("success", `Order updated to ${displayStatus(newState)}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showNotif("error", err.error || "Could not update order.");
      }
    } catch {
      showNotif("error", "Could not connect. Please try again.");
    }
    setLoading("");
  }

  /**
   * Settle a COD payment — called when merchant clicks "Mark as Paid".
   * Sends { action: "settle" } to the PATCH endpoint, which calls Vendure's
   * settlePayment mutation and moves the order from PaymentAuthorized → PaymentSettled.
   */
  async function handleSettlePayment(order: Order) {
    setLoading(order.id);
    try {
      const res = await fetch(`/api/dashboard/orders/${order.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle" }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? { ...o, status: data.state || "PaymentSettled" }
              : o
          )
        );
        showNotif("success", "Payment marked as collected. Order is now Paid.");
      } else {
        const err = await res.json().catch(() => ({}));
        showNotif("error", err.error || "Could not settle payment.");
      }
    } catch {
      showNotif("error", "Could not connect. Please try again.");
    }
    setLoading("");
  }

  function getNextState(currentStatus: string): string | null {
    return VENDURE_NEXT_STATE[currentStatus] || null;
  }

  async function handleLogout() {
    await signOut({ redirectUrl: "/" });
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Dashboard
            </p>
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

      {notification && (
        <div
          className={`mx-auto max-w-2xl mt-4 px-4 py-3 rounded-lg text-sm font-medium border ${
            notification.type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
          style={{ margin: "1rem 1rem 0" }}
        >
          {notification.message}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        <div className="flex justify-center">
          <DashboardNav current="orders" />
        </div>

        {fetchError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
            {fetchError}
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-700">
              Orders ({orders.length})
            </h2>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500 text-sm">
                  No orders yet. Share your store link to start getting orders:{" "}
                  <a
                    href={`https://${merchant.slug}.store.moolabiz.shop`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 font-medium hover:underline break-all"
                  >
                    https://{merchant.slug}.store.moolabiz.shop
                  </a>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const nextState = getNextState(order.status);
                  const orderDate = new Date(order.createdAt).toLocaleDateString(
                    "en-ZA",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              #{order.code || order.id.slice(0, 8)}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          {order.customerName && (
                            <p className="text-sm font-medium text-slate-900 mt-1">
                              {order.customerName}
                            </p>
                          )}
                          {order.customerPhone && (
                            <p className="text-xs text-slate-400">
                              {order.customerPhone}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">
                          {orderDate}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 pt-2 mb-3">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <span className="text-slate-600">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-slate-500">
                              R{(item.price / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-slate-100 mt-1">
                          <span className="text-slate-700">Total</span>
                          <span className="text-slate-900">
                            R{(order.total / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* COD: merchant must confirm cash was collected */}
                      {order.status === "PaymentAuthorized" && (
                        <button
                          onClick={() => handleSettlePayment(order)}
                          disabled={loading === order.id}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm py-2 rounded-lg transition-colors disabled:opacity-50 mb-2"
                        >
                          {loading === order.id
                            ? "Processing..."
                            : "Mark as Paid (Cash Collected)"}
                        </button>
                      )}

                      {nextState && (
                        <button
                          onClick={() => handleUpdateStatus(order, nextState)}
                          disabled={loading === order.id}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {loading === order.id
                            ? "Updating..."
                            : `Mark as ${displayStatus(nextState)}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

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
