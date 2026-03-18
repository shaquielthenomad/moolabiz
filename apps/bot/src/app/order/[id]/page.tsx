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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string; dotColor: string }> = {
  pending: {
    label: "Pending",
    bgColor: "bg-amber-50",
    textColor: "text-amber-800",
    dotColor: "bg-amber-500",
  },
  paid: {
    label: "Paid",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-800",
    dotColor: "bg-emerald-500",
  },
  fulfilled: {
    label: "Fulfilled",
    bgColor: "bg-blue-50",
    textColor: "text-blue-800",
    dotColor: "bg-blue-500",
  },
  cancelled: {
    label: "Cancelled",
    bgColor: "bg-slate-50",
    textColor: "text-slate-600",
    dotColor: "bg-slate-400",
  },
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-base font-semibold text-slate-700">{error || "Order not found"}</p>
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const orderDate = new Date(order.created_at).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-xl">
          <p className="text-xs text-slate-500 font-medium">Order confirmation</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 space-y-5">
        {/* Success indicator */}
        <div className="flex flex-col items-center gap-3 text-center py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Thank you, {order.customer_name || "Customer"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Your order has been received
            </p>
          </div>
        </div>

        {/* Order meta */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">Order number</p>
              <p className="text-sm font-bold text-slate-900">#{order.id}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusCfg.bgColor} ${statusCfg.textColor}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-400">{orderDate}</p>
        </div>

        {/* Items */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Order items</h2>
          <div className="space-y-2.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-lg font-bold text-slate-900">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                `Hi! I just placed order #${order.id}. My name is ${order.customer_name}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-emerald-600 py-3.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Message seller on WhatsApp
            </a>
          )}

          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Continue shopping
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        Powered by MoolaBiz
      </footer>
    </div>
  );
}
