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
      setError("Please enter your name");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
      setError("Please enter a valid phone number");
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
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      // Clear cart
      localStorage.removeItem("moolabiz-cart");
      setCart([]);

      // Redirect to order confirmation
      router.push(`/order/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-5xl">🛒</p>
        <p className="text-lg font-semibold text-neutral-600">Your cart is empty</p>
        <Link
          href="/"
          className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-white shadow hover:bg-amber-600 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-4 shadow-md">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link href="/" className="text-white text-2xl">
            ←
          </Link>
          <h1 className="text-lg font-bold text-white">Your Cart</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5">
        {/* Cart items */}
        <div className="space-y-3">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm"
            >
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-amber-50 text-2xl">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-800 truncate">
                  {item.product.name}
                </p>
                <p className="text-base font-bold text-amber-700">
                  {formatPrice(item.product.price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.product.id, -1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-600 active:bg-neutral-200"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.product.id, 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 active:bg-emerald-200"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-5 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 border border-amber-200">
          <span className="text-sm font-semibold text-neutral-600">Order Total</span>
          <span className="text-2xl font-bold text-amber-700">{formatPrice(total)}</span>
        </div>

        {/* Customer details */}
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
            Your Details
          </h2>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          />
          <input
            type="tel"
            placeholder="Phone number (e.g. 072 123 4567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={submitting}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-lg font-bold text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          {submitting ? "Placing order..." : `Pay ${formatPrice(total)}`}
        </button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← Back to shop
        </Link>
      </main>
    </div>
  );
}
