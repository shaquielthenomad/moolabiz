"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
}

function formatPrice(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-800" },
  fulfilled: { label: "Fulfilled", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Order not found");
        return r.json();
      })
      .then((data) => setOrder(data.order))
      .catch(() => setError("Order not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const whatsappNumber =
    typeof window !== "undefined"
      ? (document.querySelector('meta[name="whatsapp"]') as HTMLMetaElement | null)?.content || ""
      : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-300 border-t-amber-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="text-lg font-semibold text-neutral-600">{error || "Order not found"}</p>
        <Link
          href="/"
          className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-white shadow hover:bg-amber-600"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-4 shadow-md">
        <div className="mx-auto max-w-xl">
          <h1 className="text-lg font-bold text-white">Order Confirmation</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        {/* Thank you */}
        <div className="mb-6 text-center">
          <p className="text-4xl mb-2">✅</p>
          <h2 className="text-xl font-bold text-neutral-800">
            Thank you, {order.customer_name || "Customer"}!
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Order #{order.id} has been received
          </p>
        </div>

        {/* Status badge */}
        <div className="mb-5 flex justify-center">
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Order items */}
        <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">
            Items
          </h3>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">
                  {item.name} x{item.quantity}
                </span>
                <span className="text-sm font-semibold text-neutral-800">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-neutral-100 pt-3 flex items-center justify-between">
            <span className="font-semibold text-neutral-600">Total</span>
            <span className="text-xl font-bold text-amber-700">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                `Hi! I just placed order #${order.id}. My name is ${order.customer_name}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white shadow-lg hover:bg-emerald-600 transition-colors"
            >
              💬 Message us on WhatsApp
            </a>
          )}

          <Link
            href="/"
            className="block text-center text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            ← Continue shopping
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-10 py-4 text-center text-xs text-neutral-400">
        Powered by MoolaBiz
      </footer>
    </div>
  );
}
