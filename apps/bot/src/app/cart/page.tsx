"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

function formatPrice(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

function ArrowLeftIcon({ className }: { className?: string }) {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
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
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("moolabiz-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem("moolabiz-cart", JSON.stringify(cart));
    } else {
      localStorage.removeItem("moolabiz-cart");
    }
  }, [cart]);

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      localStorage.removeItem("moolabiz-cart");
      setCart([]);
      router.push(`/order/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <PackageIcon className="w-8 h-8 text-slate-300" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-800">Your cart is empty</p>
          <p className="text-sm text-slate-500">Add some products to get started.</p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Back to shop"
          >
            <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-base font-semibold text-slate-900">Your cart</h1>
          <span className="ml-auto text-xs text-slate-500">
            {cart.reduce((s, i) => s + i.quantity, 0)} items
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5 space-y-5">
        {/* Cart items */}
        <div className="space-y-2">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 p-3 shadow-sm"
            >
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="h-14 w-14 rounded-lg object-cover shrink-0 bg-slate-100"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <PackageIcon className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {item.product.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatPrice(item.product.price)} each</p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">
                  {formatPrice(item.product.price * item.quantity)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQuantity(item.product.id, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-base leading-none"
                  aria-label={`Remove one ${item.product.name}`}
                >
                  −
                </button>
                <span className="w-7 text-center text-sm font-semibold text-slate-900">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.product.id, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-base leading-none"
                  aria-label={`Add one ${item.product.name}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold text-slate-900">{formatPrice(total)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Order total</span>
            <span className="text-xl font-bold text-slate-900">{formatPrice(total)}</span>
          </div>
        </div>

        {/* Customer details */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Your details</h2>
          <div className="space-y-2.5">
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 transition-all min-h-[44px]"
            />
            <input
              type="tel"
              placeholder="Phone number (e.g. 072 123 4567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 transition-all min-h-[44px]"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 shrink-0 mt-0.5 text-red-500"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {submitting ? "Placing order..." : `Place order — ${formatPrice(total)}`}
        </button>

        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Continue shopping
        </Link>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-3">
        <div className="mx-auto max-w-xl flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider leading-none mb-0.5">
              Total
            </p>
            <p className="text-lg font-bold text-slate-900 leading-none">
              {formatPrice(total)}
            </p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={submitting}
            className="shrink-0 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[120px]"
          >
            {submitting ? "Placing..." : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
