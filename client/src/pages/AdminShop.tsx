/* ============================================================
   MURDER MITTEN MEDIA — Admin Shop Dashboard
   Protected: admin-only access
   ============================================================ */

import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Copy, Package,
  ChevronUp, ChevronDown, BarChart2, ArrowLeft,
  CheckCircle, XCircle, AlertCircle, Clock, ShoppingBag, TriangleAlert
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
type ProductStatus = "draft" | "active" | "sold_out" | "hidden";

interface ShopVariant {
  id: number;
  color: string;
  size: string;
  inventoryQty: number;
  sku?: string | null;
}

interface ShopImage {
  id: number;
  url: string;
  imageType: string;
  sortOrder: number;
}

interface ShopProduct {
  id: number;
  name: string;
  subtitle?: string | null;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  status: ProductStatus;
  featured: boolean;
  sortOrder: number;
  badge?: string | null;
  category?: string | null;
  salesCount: number;
  createdAt: Date | string;
  images: ShopImage[];
  variants: ShopVariant[];
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: ProductStatus }) {
  const map: Record<ProductStatus, { label: string; className: string; icon: React.ReactNode }> = {
    active: { label: "Active", className: "bg-green-900/40 text-green-400 border-green-700/40", icon: <CheckCircle size={11} /> },
    draft: { label: "Draft", className: "bg-zinc-800 text-zinc-400 border-zinc-700", icon: <Clock size={11} /> },
    sold_out: { label: "Sold Out", className: "bg-amber-900/40 text-amber-400 border-amber-700/40", icon: <AlertCircle size={11} /> },
    hidden: { label: "Hidden", className: "bg-zinc-900 text-zinc-500 border-zinc-700", icon: <XCircle size={11} /> },
  };
  const { label, className, icon } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold border rounded-full ${className}`}>
      {icon}{label}
    </span>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────
function ConfirmDialog({
  open, title, message, onConfirm, onCancel, danger = false
}: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#111] border border-white/10 rounded-lg p-6 max-w-sm w-full shadow-2xl">
        <h3 className="font-['Anton'] text-xl text-white mb-2">{title}</h3>
        <p className="text-white/60 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-white/60 border border-white/20 rounded hover:border-white/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${
              danger ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white text-black hover:bg-white/90"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function AdminShop() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.shop.adminGetProducts.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: reviews, isLoading: reviewsLoading } = trpc.shop.adminGetReviews.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const setReviewStatus = trpc.shop.adminSetReviewStatus.useMutation({
    onSuccess: () => { utils.shop.adminGetReviews.invalidate(); toast.success("Review status updated"); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.shop.updateStatus.useMutation({
    onSuccess: () => { utils.shop.adminGetProducts.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.shop.deleteProduct.useMutation({
    onSuccess: () => { utils.shop.adminGetProducts.invalidate(); toast.success("Product deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateProduct = trpc.shop.duplicateProduct.useMutation({
    onSuccess: () => { utils.shop.adminGetProducts.invalidate(); toast.success("Product duplicated as draft"); },
    onError: (e) => toast.error(e.message),
  });

  const reorderProducts = trpc.shop.reorderProducts.useMutation({
    onSuccess: () => utils.shop.adminGetProducts.invalidate(),
  });

  // ─── Auth Guard ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">
        <div className="text-center">
          <XCircle size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="font-['Anton'] text-2xl mb-2">Access Denied</h2>
          <p className="text-white/50 mb-6">Admin access required.</p>
          <Link href="/" className="text-red-500 hover:text-red-400 text-sm">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const confirm = (title: string, message: string, onConfirm: () => void, danger = false) => {
    setConfirmDialog({ open: true, title, message, onConfirm, danger });
  };

  const handleMoveUp = (product: ShopProduct, index: number) => {
    if (!products || index === 0) return;
    const prev = products[index - 1];
    reorderProducts.mutate([
      { id: product.id, sortOrder: prev.sortOrder },
      { id: prev.id, sortOrder: product.sortOrder },
    ]);
  };

  const handleMoveDown = (product: ShopProduct, index: number) => {
    if (!products || index === products.length - 1) return;
    const next = products[index + 1];
    reorderProducts.mutate([
      { id: product.id, sortOrder: next.sortOrder },
      { id: next.id, sortOrder: product.sortOrder },
    ]);
  };

  const totalInventory = (product: ShopProduct) =>
    product.variants.reduce((sum, v) => sum + (v.inventoryQty ?? 0), 0);

  const isInStock = (product: ShopProduct) => totalInventory(product) > 0;
  const isLowStock = (product: ShopProduct) => {
    const stock = totalInventory(product);
    return stock > 0 && stock <= 5;
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a0a0a]">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-3">
              <ShoppingBag size={20} className="text-red-500" />
              <div>
                <h1 className="font-['Anton'] text-xl tracking-wider">SHOP ADMIN</h1>
                <p className="text-white/40 text-xs">Product Management</p>
              </div>
            </div>
          </div>
          <Link
            href="/admin/shop/new"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors rounded"
          >
            <Plus size={16} />
            ADD NEW PRODUCT
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      {products && (
        <div className="border-b border-white/5 bg-[#0d0d0d]">
          <div className="container py-3 flex gap-6 text-sm">
            {[
              { label: "Total Products", value: products.length },
              { label: "Active", value: products.filter(p => p.status === "active").length },
              { label: "Draft", value: products.filter(p => p.status === "draft").length },
              { label: "Total Sales", value: products.reduce((s, p) => s + (p.salesCount ?? 0), 0) },
              { label: "Low Stock", value: products.filter(isLowStock).length },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="text-white/40">{stat.label}:</span>
                <span className="font-semibold text-white">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Review Moderation */}
      <div className="container pt-8">
        <section className="border border-white/10 bg-white/[0.03] rounded-lg overflow-hidden" aria-labelledby="shop-reviews-heading">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-red-500 font-semibold">Real customer signal</p>
              <h2 id="shop-reviews-heading" className="font-['Anton'] text-2xl uppercase">Review moderation</h2>
            </div>
            <span className="text-xs text-white/40">{reviews?.length ?? 0} submitted</span>
          </div>
          {reviewsLoading ? (
            <div className="px-5 py-6 text-sm text-white/45">Loading customer reviews...</div>
          ) : !reviews?.length ? (
            <div className="px-5 py-6 text-sm text-white/45">No customer reviews have been submitted yet. Nothing is seeded or published automatically.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {reviews.map(({ review, productName, artistName, displayName }) => (
                <article key={review.id} className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-white">{productName || "Unknown product"}</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40">by {artistName || displayName || "Customer"}</span>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${review.status === "approved" ? "border-emerald-500/30 text-emerald-400" : review.status === "rejected" ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"}`}>{review.status}</span>
                      {review.verifiedPurchase && <span className="text-[10px] uppercase tracking-widest text-emerald-400">Verified purchase</span>}
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 mb-2" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-white/20">{"★".repeat(5 - review.rating)}</span></div>
                    {review.title && <h3 className="font-semibold text-white">{review.title}</h3>}
                    {review.body && <p className="text-sm text-white/60 leading-relaxed max-w-3xl mt-1">{review.body}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {review.status !== "approved" && <button onClick={() => setReviewStatus.mutate({ id: review.id, status: "approved" })} disabled={setReviewStatus.isPending} className="rounded border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">Approve</button>}
                    {review.status !== "rejected" && <button onClick={() => confirm("Reject review?", "This review will remain hidden from the public product page.", () => setReviewStatus.mutate({ id: review.id, status: "rejected" }), true)} disabled={setReviewStatus.isPending} className="rounded border border-red-500/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-400 hover:bg-red-500/10 disabled:opacity-50">Reject</button>}
                    {review.status !== "pending" && <button onClick={() => setReviewStatus.mutate({ id: review.id, status: "pending" })} disabled={setReviewStatus.isPending} className="rounded border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/60 hover:text-white disabled:opacity-50">Hold</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Product Table */}
      <div className="container py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-24">
            <Package size={48} className="text-white/20 mx-auto mb-4" />
            <h3 className="font-['Anton'] text-2xl text-white/40 mb-2">NO PRODUCTS YET</h3>
            <p className="text-white/30 text-sm mb-6">Add your first product to get started.</p>
            <Link
              href="/admin/shop/new"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-colors rounded"
            >
              <Plus size={16} /> Add First Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-widest">
                  <th className="text-left py-3 pr-4 w-8">#</th>
                  <th className="text-left py-3 pr-4">Product</th>
                  <th className="text-left py-3 pr-4">Price</th>
                  <th className="text-left py-3 pr-4">Status</th>
                  <th className="text-left py-3 pr-4">Inventory</th>
                  <th className="text-left py-3 pr-4">Sales</th>
                  <th className="text-left py-3 pr-4">Created</th>
                  <th className="text-right py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const thumb = product.images.find(i => i.imageType === "thumbnail") ?? product.images[0];
                  const stock = totalInventory(product);
                  const inStock = stock > 0;
                  const lowStock = isLowStock(product);
                  const createdDate = product.createdAt
                    ? new Date(product.createdAt).toLocaleDateString()
                    : "—";

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Order controls */}
                      <td className="py-4 pr-4">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveUp(product as ShopProduct, index)}
                            disabled={index === 0}
                            className="text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveDown(product as ShopProduct, index)}
                            disabled={index === products.length - 1}
                            className="text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>

                      {/* Product info */}
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-zinc-900 border border-white/10 rounded overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb.url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package size={16} className="text-white/20" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-red-400 transition-colors">
                              {product.name}
                            </div>
                            {product.badge && (
                              <span className="text-xs text-red-500 font-medium">{product.badge}</span>
                            )}
                            <div className="text-white/30 text-xs mt-0.5">/{product.slug}</div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-white">
                          ${(product.price / 100).toFixed(2)}
                        </div>
                        {product.compareAtPrice && (
                          <div className="text-white/30 text-xs line-through">
                            ${(product.compareAtPrice / 100).toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 pr-4">
                        <StatusBadge status={product.status as ProductStatus} />
                      </td>

                      {/* Inventory */}
                      <td className="py-4 pr-4">
                        <div className={`font-semibold text-sm ${inStock ? "text-green-400" : "text-red-400"}`}>
                          {inStock ? `${stock} in stock` : "Out of stock"}
                        </div>
                        <div className="text-white/30 text-xs">
                          {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                        </div>
                        {lowStock && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                            <TriangleAlert size={11} aria-hidden="true" /> Low stock
                          </div>
                        )}
                      </td>

                      {/* Sales */}
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-1 text-white/70">
                          <BarChart2 size={13} className="text-white/30" />
                          {product.salesCount ?? 0}
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-4 pr-4 text-white/40 text-xs">{createdDate}</td>

                      {/* Actions */}
                      <td className="py-4">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Edit */}
                          <Link
                            href={`/admin/shop/edit/${product.id}`}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </Link>

                          {/* Toggle visibility */}
                          <button
                            onClick={() => {
                              const newStatus = product.status === "active" ? "hidden" : "active";
                              const action = newStatus === "active" ? "publish" : "hide";
                              confirm(
                                `${action === "publish" ? "Publish" : "Hide"} Product`,
                                `Are you sure you want to ${action} "${product.name}"?`,
                                () => updateStatus.mutate({ id: product.id, status: newStatus }),
                              );
                            }}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title={product.status === "active" ? "Hide" : "Publish"}
                          >
                            {product.status === "active" ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => confirm(
                              "Duplicate Product",
                              `Create a draft copy of "${product.name}"?`,
                              () => duplicateProduct.mutate({ id: product.id }),
                            )}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => confirm(
                              "Delete Product",
                              `Permanently delete "${product.name}"? This cannot be undone.`,
                              () => deleteProduct.mutate({ id: product.id }),
                              true,
                            )}
                            className="p-2 text-white/40 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog(d => ({ ...d, open: false }));
        }}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
