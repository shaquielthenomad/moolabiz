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

function formatPrice(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

// Shopping bag icon
function BagIcon({ className }: { className?: string }) {
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
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

// WhatsApp icon
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

// Package placeholder icon
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

// Store icon for empty state
function StoreIcon({ className }: { className?: string }) {
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
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const businessName =
    typeof window !== "undefined"
      ? document.title.replace(/ — Shop$/, "").replace(/ Shop$/, "")
      : "Shop";

  const whatsappNumber =
    typeof window !== "undefined"
      ? (document.querySelector('meta[name="whatsapp"]') as HTMLMetaElement | null)?.content || ""
      : "";

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
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(product.id);
      setTimeout(() => {
        setAddedIds((s) => {
          const updated = new Set(s);
          updated.delete(product.id);
          return updated;
        });
      }, 1200);
      return next;
    });
  }, []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Derive categories
  const allCategories = Array.from(new Set(products.map((p) => p.category || "General")));
  const hasCategories = allCategories.length > 1;

  // Filter products
  const filtered = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || (p.category || "General") === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{businessName}</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Browse and order online</p>
          </div>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shrink-0"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* Search + Categories */}
      {!loading && products.length > 0 && (
        <div className="sticky top-[57px] z-20 bg-white border-b border-slate-100 px-4 py-3">
          <div className="mx-auto max-w-4xl space-y-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 transition-all"
              />
            </div>

            {/* Category tabs */}
            {hasCategories && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {["All", ...allCategories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                      activeCategory === cat
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 pt-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700" />
            <p className="text-sm text-slate-500">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-24 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <StoreIcon className="w-8 h-8 text-slate-400" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-800">Store is setting up</p>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Products will be available shortly. You can message the seller directly in the meantime.
              </p>
            </div>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I'd like to place an order.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Message seller on WhatsApp
              </a>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm font-medium text-slate-600">No products match your search</p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="text-xs text-slate-500 underline underline-offset-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              const justAdded = addedIds.has(product.id);
              return (
                <div
                  key={product.id}
                  className="group overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  {product.image_url ? (
                    <div className="aspect-square w-full overflow-hidden bg-slate-100">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-slate-50">
                      <PackageIcon className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="text-sm font-semibold leading-tight text-slate-900 line-clamp-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                    <p className="mt-2 text-lg font-bold text-emerald-600 leading-none">
                      {formatPrice(product.price)}
                    </p>
                    <button
                      onClick={() => addToCart(product)}
                      className={`mt-3 w-full rounded-lg py-2.5 text-xs font-semibold transition-all min-h-[40px] ${
                        justAdded
                          ? "bg-emerald-600 text-white"
                          : inCart
                          ? "bg-slate-900 text-white hover:bg-slate-700"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {justAdded ? "Added" : inCart ? `In cart (${inCart.quantity})` : "Add to cart"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart pill */}
      {totalItems > 0 && (
        <div className="fixed bottom-5 left-0 right-0 z-40 flex justify-center px-4">
          <Link
            href="/cart"
            className="flex items-center gap-3 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 transition-colors"
          >
            <div className="relative">
              <BagIcon className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white leading-none">
                {totalItems}
              </span>
            </div>
            <span>View cart</span>
            <span className="text-slate-400">
              {cart.reduce((s, i) => s + i.product.price * i.quantity, 0) > 0
                ? formatPrice(cart.reduce((s, i) => s + i.product.price * i.quantity, 0))
                : ""}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
