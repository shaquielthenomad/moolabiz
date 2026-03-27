"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { useClerk } from "@clerk/nextjs";
import { DashboardNav } from "../dashboard-client";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  inStock: boolean;
  imageUrl?: string;
  sku?: string;
  stockQuantity?: number;
  variants?: Variant[];
}

interface Variant {
  id: string;
  name: string;
  price: number;
  sku: string;
  stockOnHand: number;
  inStock: boolean;
  options: Record<string, string>;
}

interface MerchantInfo {
  slug: string;
  businessName: string;
  plan: string;
  useVendure: boolean;
}

/** Plans that unlock advanced product fields (variants, SKU, stock qty) */
const ADVANCED_PLANS = ["growth", "pro", "business"];

export function ProductsClient({
  merchant,
  initialProducts,
  fetchError,
}: {
  merchant: MerchantInfo;
  initialProducts: Product[];
  fetchError: string;
}) {
  const { signOut } = useClerk();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState("");

  const showAdvanced = ADVANCED_PLANS.includes(merchant.plan);

  // All API calls now go through the hub's own dashboard API routes
  const apiBase = merchant.useVendure
    ? "/api/dashboard/products"
    : `https://${merchant.slug}.bot.moolabiz.shop/api/products`;

  function showNotif(type: "error" | "success", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleDelete(productId: string) {
    if (!confirm("Delete this product?")) return;
    setLoading(productId);
    try {
      const res = await fetch(`${apiBase}/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        showNotif("success", "Product deleted.");
      } else {
        showNotif("error", "Could not delete product.");
      }
    } catch {
      showNotif("error", "Could not connect to your store.");
    }
    setLoading("");
  }

  async function handleToggleStock(product: Product) {
    setLoading(product.id);
    try {
      const res = await fetch(`${apiBase}/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inStock: !product.inStock }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, inStock: !p.inStock } : p
          )
        );
      } else {
        showNotif("error", "Could not update product.");
      }
    } catch {
      showNotif("error", "Could not connect to your store.");
    }
    setLoading("");
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
          <DashboardNav current="products" />
        </div>

        {fetchError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
            {fetchError}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Products ({products.length})
              </h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {showAddForm ? "Cancel" : "+ Add product"}
              </button>
            </div>

            {showAddForm && (
              <AddProductForm
                apiBase={apiBase}
                showAdvanced={showAdvanced}
                onSuccess={(product: Product) => {
                  setProducts((prev) => [product, ...prev]);
                  setShowAddForm(false);
                  showNotif("success", "Product added.");
                }}
                onError={(msg: string) => showNotif("error", msg)}
              />
            )}

            {products.length === 0 && !showAddForm ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500 text-sm">
                  No products yet. Add your first product using the <span className="font-semibold text-slate-700">+ Add product</span> button above, or message your WhatsApp bot with{" "}
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-700">/add-product</code>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
                  >
                    {editingId === product.id ? (
                      <EditProductForm
                        product={product}
                        apiBase={apiBase}
                        showAdvanced={showAdvanced}
                        onSave={(updated) => {
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === updated.id ? updated : p
                            )
                          );
                          setEditingId(null);
                          showNotif("success", "Product updated.");
                        }}
                        onCancel={() => setEditingId(null)}
                        onError={(msg) => showNotif("error", msg)}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200 cursor-pointer"
                            onClick={() => setEditingId(product.id)}
                          />
                        )}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setEditingId(product.id)}
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 text-sm truncate">
                              {product.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                product.inStock
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {product.inStock ? "In stock" : "Out of stock"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            R{(product.price / 100).toFixed(2)}
                            {product.category && (
                              <span className="ml-2 text-slate-400">
                                {product.category}
                              </span>
                            )}
                          </p>
                          {product.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          {showAdvanced &&
                            product.variants &&
                            product.variants.length > 1 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {product.variants.length} variants
                              </p>
                            )}
                          <p className="text-xs text-emerald-600 mt-1">
                            Tap to edit
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setEditingId(product.id)}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStock(product)}
                            disabled={loading === product.id}
                            className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            {product.inStock ? "Out of stock" : "Back in stock"}
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={loading === product.id}
                            className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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

// ---------------------------------------------------------------------------
// Add Product Form
// ---------------------------------------------------------------------------

function AddProductForm({
  apiBase,
  showAdvanced,
  onSuccess,
  onError,
}: {
  apiBase: string;
  showAdvanced: boolean;
  onSuccess: (product: Product) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const file = fileInputRef.current?.files?.[0];

      let res: Response;
      if (file) {
        // Use FormData when image is present
        const formData = new FormData();
        formData.append("name", name);
        formData.append("price", String(Math.round(parseFloat(price) * 100)));
        formData.append("description", description);
        formData.append("category", category);
        if (showAdvanced && sku) formData.append("sku", sku);
        if (showAdvanced && stockQuantity) formData.append("stockQuantity", stockQuantity);
        formData.append("image", file);

        res = await fetch(apiBase, { method: "POST", body: formData });
      } else {
        // JSON when no image
        const payload: Record<string, unknown> = {
          name,
          price: Math.round(parseFloat(price) * 100),
          description,
          category,
        };
        if (showAdvanced) {
          if (sku) payload.sku = sku;
          if (stockQuantity) payload.stockQuantity = parseInt(stockQuantity, 10);
        }
        res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const product = await res.json();
        onSuccess(product);
        setName("");
        setPrice("");
        setDescription("");
        setCategory("");
        setSku("");
        setStockQuantity("");
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        onError("Could not add product. Please try again.");
      }
    } catch {
      onError("Could not connect to your store.");
    }

    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-slate-700">Add new product</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="productName"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Product name
          </label>
          <input
            id="productName"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chocolate Cake"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="productPrice"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Price (ZAR)
          </label>
          <input
            id="productPrice"
            type="number"
            required
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 150.00"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="productCategory"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Category (optional)
        </label>
        <input
          id="productCategory"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Cakes, Sneakers, Clothing"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="productDescription"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="productDescription"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of your product"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none resize-none"
        />
      </div>

      {/* Product image upload */}
      <div>
        <label
          htmlFor="productImage"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Product image (optional)
        </label>
        <div className="flex items-center gap-3">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="w-16 h-16 rounded-lg object-cover border border-slate-200"
            />
          )}
          <input
            id="productImage"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
          />
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label
              htmlFor="productSku"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              SKU (optional)
            </label>
            <input
              id="productSku"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. CAKE-CHOC-001"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="productStock"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Stock quantity
            </label>
            <input
              id="productStock"
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="e.g. 50"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Adding..." : "Add product"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit Product Form
// ---------------------------------------------------------------------------

function EditProductForm({
  product,
  apiBase,
  showAdvanced,
  onSave,
  onCancel,
  onError,
}: {
  product: Product;
  apiBase: string;
  showAdvanced: boolean;
  onSave: (p: Product) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState((product.price / 100).toString());
  const [description, setDescription] = useState(product.description || "");
  const [category, setCategory] = useState(product.category || "");
  const [sku, setSku] = useState(product.sku || "");
  const [stockQuantity, setStockQuantity] = useState(
    product.stockQuantity?.toString() || ""
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    product.imageUrl || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const file = fileInputRef.current?.files?.[0];

      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("price", String(Math.round(parseFloat(price) * 100)));
        formData.append("description", description);
        formData.append("category", category);
        if (showAdvanced && sku) formData.append("sku", sku);
        if (showAdvanced && stockQuantity) formData.append("stockQuantity", stockQuantity);
        formData.append("image", file);

        res = await fetch(`${apiBase}/${product.id}`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        const payload: Record<string, unknown> = {
          name,
          price: Math.round(parseFloat(price) * 100),
          description,
          category,
        };
        if (showAdvanced) {
          if (sku) payload.sku = sku;
          if (stockQuantity) payload.stockQuantity = parseInt(stockQuantity, 10);
        }
        res = await fetch(`${apiBase}/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const updated = await res.json();
        onSave({
          ...product,
          name: updated.name || name,
          price: updated.price ?? Math.round(parseFloat(price) * 100),
          description: updated.description ?? description,
          category: updated.category ?? category,
          inStock: updated.inStock ?? product.inStock,
          imageUrl: updated.imageUrl ?? product.imageUrl,
          sku: updated.sku ?? sku,
          stockQuantity: updated.stockQuantity ?? product.stockQuantity,
          variants: updated.variants ?? product.variants,
        });
      } else {
        onError("Could not update product.");
      }
    } catch {
      onError("Could not connect to your store.");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Price (ZAR)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Category
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none resize-none"
        />
      </div>

      {/* Product image upload */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Product image
        </label>
        <div className="flex items-center gap-3">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="w-16 h-16 rounded-lg object-cover border border-slate-200"
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
          />
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Stock quantity
            </label>
            <input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-slate-200 text-slate-600 font-medium text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
