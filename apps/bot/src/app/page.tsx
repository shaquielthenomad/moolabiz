"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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

const BUSINESS_NAME =
  typeof window !== "undefined"
    ? document.title.replace(/ — Shop$/, "")
    : "Shop";

function formatPrice(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bounceCart, setBounceCart] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("moolabiz-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        /* ignore corrupt data */
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

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setBounceCart(true);
    setTimeout(() => setBounceCart(false), 300);
  }, []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Group products by category
  const categories = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const whatsappNumber = typeof window !== "undefined"
    ? (document.querySelector('meta[name="whatsapp"]') as HTMLMetaElement | null)?.content || ""
    : "";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-4 shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{BUSINESS_NAME}</h1>
            <p className="text-xs text-amber-100">Tap a product to add it to your cart</p>
          </div>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-600 transition-colors"
            >
              WhatsApp Us
            </a>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-3 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-300 border-t-amber-600" />
            <p className="text-sm text-neutral-500">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6">
            <div className="w-24 h-24 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center shadow-inner">
              <span className="text-4xl" aria-hidden="true">🛍️</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-extrabold text-neutral-700">Products coming soon!</p>
              <p className="text-sm text-neutral-500 leading-relaxed max-w-xs mx-auto">
                Our menu is being updated. In the meantime, message us directly on WhatsApp to place an order.
              </p>
            </div>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I'd like to place an order.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 rounded-2xl bg-emerald-500 px-7 py-4 text-base font-bold text-white shadow-lg hover:bg-emerald-600 active:scale-95 transition-all"
              >
                <span aria-hidden="true">💬</span> Message us on WhatsApp
              </a>
            )}
          </div>
        ) : (
          Object.entries(categories).map(([category, items]) => (
            <section key={category} className="mb-6">
              {Object.keys(categories).length > 1 && (
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-700">
                  {category}
                </h2>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((product) => (
                  <div
                    key={product.id}
                    className="group overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    {product.image_url ? (
                      <div className="aspect-square w-full overflow-hidden bg-neutral-100">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 text-4xl transition-transform duration-300 group-hover:scale-110">
                        📦
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-semibold leading-tight text-neutral-800 line-clamp-2">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="mt-1 text-xs text-neutral-400 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      {/* Price — prominent, green, Rand-first */}
                      <p className="mt-2 text-xl font-extrabold text-emerald-600 leading-none">
                        {formatPrice(product.price)}
                      </p>
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-white shadow-sm active:scale-95 transition-all hover:bg-emerald-600 hover:shadow-md min-h-[44px]"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating cart button */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3">
          <Link
            href="/cart"
            className={`mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-bold text-white shadow-lg active:scale-95 transition-transform ${bounceCart ? "animate-cart-bounce" : ""}`}
          >
            <span className="text-xl">🛒</span>
            View Cart ({totalItems} {totalItems === 1 ? "item" : "items"})
          </Link>
        </div>
      )}
    </div>
  );
}
