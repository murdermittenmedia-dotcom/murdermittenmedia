/* ============================================================
   MURDER MITTEN MEDIA — Admin Shop Product Form
   Add / Edit product with full fields, image upload, variants
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, X, Plus, Trash2, GripVertical,
  Image as ImageIcon, Package, Save, Eye, EyeOff,
  ChevronDown, ChevronUp, AlertCircle, Loader2
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const COLORS = ["Black", "White", "Red", "Navy", "Grey", "Olive", "Tan"];
const BADGES = ["Limited Release", "New Drop", "Best Seller", "Sold Out", "First Collection", "Exclusive"];
const CATEGORIES = ["T-Shirts", "Hoodies", "Hats", "Accessories", "Limited Edition"];
const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "sold_out", label: "Sold Out" },
  { value: "hidden", label: "Hidden" },
] as const;

type ProductStatus = "draft" | "active" | "sold_out" | "hidden";
type ImageType = "thumbnail" | "front" | "back" | "size_chart" | "gallery";

interface VariantRow {
  color: string;
  size: string;
  inventoryQty: number;
  sku: string;
}

interface ImageRow {
  id?: number;
  url: string;
  imageType: ImageType;
  sortOrder: number;
  file?: File;
  uploading?: boolean;
  storageKey?: string | null;
  color?: string; // Color/variation for this image (e.g., "Black", "White")
}

// ─── Slug generator ───────────────────────────────────────────
function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d0d0d] border border-white/10 rounded-lg p-6 ${className}`}>
      <h3 className="font-['Anton'] text-base tracking-wider text-white/80 mb-5 uppercase">{title}</h3>
      {children}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-white/30 text-xs mt-1">{hint}</p>}
    </div>
  );
}

// ─── Text input ───────────────────────────────────────────────
function TextInput({
  value, onChange, placeholder = "", type = "text", className = ""
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60 placeholder-white/20 ${className}`}
    />
  );
}

// ─── Textarea ─────────────────────────────────────────────────
function TextareaInput({ value, onChange, placeholder = "", rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60 placeholder-white/20 resize-none"
    />
  );
}

// ─── Select ───────────────────────────────────────────────────
function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Toggle ───────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-red-600" : "bg-white/20"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-white/70">{label}</span>
    </label>
  );
}

// ─── Main Form ────────────────────────────────────────────────
export default function AdminShopForm() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;
  const productId = params.id ? parseInt(params.id) : undefined;

  const utils = trpc.useUtils();

  // Fetch existing product for edit
  const { data: existingProducts } = trpc.shop.adminGetProducts.useQuery(undefined, {
    enabled: isEdit && user?.role === "admin",
  });
  const existing = existingProducts?.find(p => p.id === productId);

  // ─── Form state ────────────────────────────────────────────
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ProductStatus>("draft");
  const [featured, setFeatured] = useState(false);
  const [badge, setBadge] = useState("");
  const [shippingEstimate, setShippingEstimate] = useState("3–7 business days");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const editingImage = editingImageIndex !== null ? images[editingImageIndex] : null;

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSubtitle(existing.subtitle ?? "");
      setSlug(existing.slug);
      setSlugManual(true);
      setDescription((existing as any).description ?? "");
      setPrice(((existing.price ?? 0) / 100).toFixed(2));
      setCompareAtPrice(existing.compareAtPrice ? (existing.compareAtPrice / 100).toFixed(2) : "");
      setCategory(existing.category ?? "");
      setStatus(existing.status as ProductStatus);
      setFeatured(existing.featured ?? false);
      setBadge(existing.badge ?? "");
      setShippingEstimate((existing as any).shippingEstimate ?? "3–7 business days");
      setSeoTitle((existing as any).seoTitle ?? "");
      setSeoDescription((existing as any).seoDescription ?? "");
      setImages(existing.images.map((img: any) => ({
        id: img.id,
        url: img.url,
        imageType: img.imageType as ImageType,
        sortOrder: img.sortOrder,
        storageKey: img.storageKey,
      })));
      setVariants(existing.variants.map((v: any) => ({
        color: v.color,
        size: v.size,
        inventoryQty: v.inventoryQty,
        sku: v.sku ?? "",
      })));
    }
  }, [existing]);

  // Auto-slug from name
  useEffect(() => {
    if (!slugManual && name) setSlug(toSlug(name));
  }, [name, slugManual]);

  // ─── Mutations ─────────────────────────────────────────────
  const createProduct = trpc.shop.createProduct.useMutation();
  const updateProduct = trpc.shop.updateProduct.useMutation();
  const uploadImage = trpc.shop.uploadImage.useMutation();
  const deleteImageMutation = trpc.shop.deleteImage.useMutation();

  // ─── Image upload ──────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setImages(prev => [...prev, {
          url,
          imageType: "gallery" as ImageType,
          sortOrder: prev.length,
          file,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadPendingImages = async (pid: number) => {
    const pending = images.filter(img => img.file && !img.id);
    for (const img of pending) {
      if (!img.file) continue;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
        reader.readAsDataURL(img.file!);
      });
      await uploadImage.mutateAsync({
        productId: pid,
        base64,
        mimeType: img.file.type as "image/jpeg" | "image/png" | "image/webp",
        imageType: img.imageType,
        sortOrder: img.sortOrder,
      });
    }
  };

  // ─── Variant helpers ───────────────────────────────────────
  const generateSKU = (color: string, size: string) => {
    const colorCode = color.slice(0, 2).toUpperCase();
    const sizeCode = size.toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${colorCode}-${sizeCode}-${timestamp}`;
  };

  const addVariant = () => {
    const newVariant = { color: "Black", size: "M", inventoryQty: 50, sku: "" };
    newVariant.sku = generateSKU(newVariant.color, newVariant.size);
    setVariants(prev => [...prev, newVariant]);
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string | number) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== index) return v;
      const updated = { ...v, [field]: value };
      // Auto-generate SKU if color or size changes
      if ((field === "color" || field === "size") && !updated.sku) {
        updated.sku = generateSKU(updated.color, updated.size);
      }
      return updated;
    }));
  };

  const generateAllVariants = () => {
    const selectedColors = [...new Set(variants.map(v => v.color))];
    const colorsToUse = selectedColors.length > 0 ? selectedColors : ["Black", "White"];
    const rows: VariantRow[] = [];
    for (const color of colorsToUse) {
      for (const size of SIZES) {
        const sku = generateSKU(color, size);
        rows.push({ color, size, inventoryQty: 50, sku });
      }
    }
    setVariants(rows);
  };

  // ─── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    if (!slug.trim()) { toast.error("Slug is required"); return; }
    if (!price || isNaN(parseFloat(price))) { toast.error("Valid price is required"); return; }

    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price) * 100);
      const compareAtCents = compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : undefined;

      const variantData = variants.map(v => ({
        color: v.color,
        size: v.size,
        inventoryQty: v.inventoryQty,
        sku: v.sku || undefined,
      }));

      if (isEdit && productId) {
        await updateProduct.mutateAsync({
          id: productId,
          name: name.trim(),
          subtitle: subtitle.trim() || undefined,
          slug: slug.trim(),
          description: description.trim() || undefined,
          price: priceCents,
          compareAtPrice: compareAtCents ?? null,
          category: category || undefined,
          status,
          featured,
          badge: badge || null,
          shippingEstimate: shippingEstimate || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          variants: variantData,
        });
        await uploadPendingImages(productId);
        toast.success("Product updated!");
      } else {
        const result = await createProduct.mutateAsync({
          name: name.trim(),
          subtitle: subtitle.trim() || undefined,
          slug: slug.trim(),
          description: description.trim() || undefined,
          price: priceCents,
          compareAtPrice: compareAtCents,
          category: category || undefined,
          status,
          featured,
          badge: badge || undefined,
          shippingEstimate: shippingEstimate || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          variants: variantData,
        });
        if (result.productId) {
          await uploadPendingImages(result.productId);
        }
        toast.success("Product created!");
      }

      utils.shop.adminGetProducts.invalidate();
      navigate("/admin/shop");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  // ─── Auth guard ────────────────────────────────────────────
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
          <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="font-['Anton'] text-2xl mb-2">Access Denied</h2>
          <Link href="/" className="text-red-500 hover:text-red-400 text-sm">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-24">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a0a0a] sticky top-0 z-30">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/shop" className="text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="font-['Anton'] text-xl tracking-wider">
              {isEdit ? "EDIT PRODUCT" : "NEW PRODUCT"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/shop"
              className="px-4 py-2 text-sm text-white/50 border border-white/20 rounded hover:border-white/40 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold uppercase tracking-widest transition-colors rounded"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: main fields */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Basic Info */}
            <Section title="Product Info">
              <div className="flex flex-col gap-4">
                <Field label="Product Name *">
                  <TextInput value={name} onChange={setName} placeholder="e.g. Spirit of The Mitten Tee" />
                </Field>
                <Field label="Subtitle" hint="Short tagline shown under the product name">
                  <TextInput value={subtitle} onChange={setSubtitle} placeholder="e.g. Premium Heavyweight Cotton" />
                </Field>
                <Field label="URL Slug *" hint="Used in the product page URL: /shop/[slug]">
                  <div className="flex gap-2">
                    <TextInput
                      value={slug}
                      onChange={(v) => { setSlug(v); setSlugManual(true); }}
                      placeholder="spirit-of-the-mitten-tee"
                    />
                    <button
                      onClick={() => { setSlug(toSlug(name)); setSlugManual(false); }}
                      className="px-3 py-2 text-xs text-white/50 border border-white/20 rounded hover:border-white/40 whitespace-nowrap transition-colors"
                    >
                      Auto
                    </button>
                  </div>
                </Field>
                <Field label="Description">
                  <TextareaInput
                    value={description}
                    onChange={setDescription}
                    placeholder="Describe the product — materials, fit, feel..."
                    rows={5}
                  />
                </Field>
              </div>
            </Section>

            {/* Images */}
            <Section title="Product Images">
              <div className="space-y-4">
                {/* Image grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        onClick={() => setEditingImageIndex(index)}
                        className="relative group aspect-square bg-zinc-900 border border-white/10 rounded overflow-hidden cursor-pointer hover:border-red-600/50 transition-colors"
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm("Delete this image?")) return;
                            if (img.id) {
                              deleteImageMutation.mutateAsync({ imageId: img.id });
                              utils.shop.adminGetProducts.invalidate();
                            }
                            setImages(prev => prev.filter((_, i) => i !== index));
                          }}
                          disabled={deleteImageMutation.isPending}
                          className="absolute top-1 right-1 z-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-colors"
                          title="Delete image"
                        >
                          {deleteImageMutation.isPending ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                        </button>

                        {/* Type + Color badges */}
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white/60 text-[9px] px-1 rounded pointer-events-none flex flex-col gap-0.5">
                          <div>{img.imageType}</div>
                          {img.color && <div className="text-white/40 text-[8px]">{img.color}</div>}
                        </div>

                        {/* Click hint */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <p className="text-white text-xs font-semibold">Edit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 hover:border-red-600/50 rounded-lg p-8 text-center cursor-pointer transition-colors group"
                >
                  <Upload size={24} className="text-white/30 group-hover:text-red-500 mx-auto mb-2 transition-colors" />
                  <p className="text-white/50 text-sm">Click to upload images</p>
                  <p className="text-white/30 text-xs mt-1">JPG, PNG, WebP — max 6MB each</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => handleImageFiles(e.target.files)}
                />
                <p className="text-white/30 text-xs">
                  Click an image to open the editor. Set the type (thumbnail, front, back, size chart, gallery), assign it to a color/variation, and adjust sort order. The thumbnail is shown in the product grid.
                </p>
              </div>
            </Section>

            {/* Variants & Inventory */}
            <Section title="Variants & Inventory">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-white/40 text-xs">Define color + size combinations and set inventory quantities.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={generateAllVariants}
                      className="text-xs px-3 py-1.5 border border-white/20 text-white/60 rounded hover:border-white/40 transition-colors"
                    >
                      Generate All Sizes
                    </button>
                    <button
                      onClick={addVariant}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600/20 border border-red-600/40 text-red-400 rounded hover:bg-red-600/30 transition-colors"
                    >
                      <Plus size={12} /> Add Variant
                    </button>
                  </div>
                </div>

                {variants.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-white/10 rounded">
                    <Package size={24} className="text-white/20 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No variants yet. Add variants or generate all sizes.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-white/40 uppercase tracking-widest px-2">
                      <div className="col-span-3">Color</div>
                      <div className="col-span-3">Size</div>
                      <div className="col-span-3">Qty</div>
                      <div className="col-span-2">SKU</div>
                      <div className="col-span-1"></div>
                    </div>
                    {variants.map((v, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center bg-[#111] border border-white/5 rounded px-2 py-2">
                        <div className="col-span-3">
                          <select
                            value={v.color}
                            onChange={e => updateVariant(index, "color", e.target.value)}
                            className="w-full bg-transparent text-white text-xs border-0 focus:outline-none"
                          >
                            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <select
                            value={v.size}
                            onChange={e => updateVariant(index, "size", e.target.value)}
                            className="w-full bg-transparent text-white text-xs border-0 focus:outline-none"
                          >
                            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min={0}
                            value={v.inventoryQty}
                            onChange={e => updateVariant(index, "inventoryQty", parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent text-white text-xs border-0 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={e => updateVariant(index, "sku", e.target.value)}
                            placeholder="SKU"
                            className="w-full bg-transparent text-white/50 text-xs border-0 focus:outline-none placeholder-white/20"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => removeVariant(index)}
                            className="text-white/20 hover:text-red-500 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* SEO */}
            <Section title="SEO">
              <div className="flex flex-col gap-4">
                <Field label="SEO Title" hint="Defaults to product name if left blank">
                  <TextInput value={seoTitle} onChange={setSeoTitle} placeholder={name || "Product title for search engines"} />
                </Field>
                <Field label="SEO Description">
                  <TextareaInput
                    value={seoDescription}
                    onChange={setSeoDescription}
                    placeholder="Brief description for search engine results (150–160 chars recommended)"
                    rows={3}
                  />
                </Field>
              </div>
            </Section>
          </div>

          {/* Right column: settings */}
          <div className="flex flex-col gap-6">

            {/* Pricing */}
            <Section title="Pricing">
              <div className="flex flex-col gap-4">
                <Field label="Price (USD) *">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="49.99"
                      className="w-full bg-[#111] border border-white/10 text-white text-sm pl-7 pr-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
                    />
                  </div>
                </Field>
                <Field label="Compare-At Price" hint="Show a crossed-out original price for sales">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={compareAtPrice}
                      onChange={e => setCompareAtPrice(e.target.value)}
                      placeholder="59.99"
                      className="w-full bg-[#111] border border-white/10 text-white text-sm pl-7 pr-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
                    />
                  </div>
                </Field>
              </div>
            </Section>

            {/* Status & Visibility */}
            <Section title="Status">
              <div className="flex flex-col gap-4">
                <Field label="Product Status">
                  <SelectInput
                    value={status}
                    onChange={v => setStatus(v as ProductStatus)}
                    options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
                  />
                </Field>
                <Toggle checked={featured} onChange={setFeatured} label="Featured product" />
              </div>
            </Section>

            {/* Organization */}
            <Section title="Organization">
              <div className="flex flex-col gap-4">
                <Field label="Category">
                  <SelectInput
                    value={category}
                    onChange={setCategory}
                    options={[{ value: "", label: "Select category..." }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
                  />
                </Field>
                <Field label="Product Badge" hint="Shown as a label on the product card">
                  <SelectInput
                    value={badge}
                    onChange={setBadge}
                    options={[{ value: "", label: "No badge" }, ...BADGES.map(b => ({ value: b, label: b }))]}
                  />
                </Field>
              </div>
            </Section>

            {/* Shipping */}
            <Section title="Shipping">
              <Field label="Shipping Estimate" hint="Shown on the product page">
                <TextInput
                  value={shippingEstimate}
                  onChange={setShippingEstimate}
                  placeholder="3–7 business days"
                />
              </Field>
              <p className="text-white/30 text-xs mt-3">
                Flat rate: $3.99. Free shipping on orders over $100.
              </p>
            </Section>

            {/* Stripe info (edit mode) */}
            {isEdit && existing && (
              <Section title="Stripe">
                <div className="space-y-2 text-xs text-white/40">
                  <div>
                    <span className="text-white/30">Product ID: </span>
                    <span className="font-mono">{(existing as any).stripeProductId ?? "Not synced"}</span>
                  </div>
                  <div>
                    <span className="text-white/30">Price ID: </span>
                    <span className="font-mono">{(existing as any).stripePriceId ?? "Not synced"}</span>
                  </div>
                  <p className="text-white/20 mt-2">Changing the price will archive the old Stripe price and create a new one automatically.</p>
                </div>
              </Section>
            )}
          </div>
        </div>
      {/* ── IMAGE EDITOR MODAL ────────────────────────────────────────────── */}
      {editingImage && editingImageIndex !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-white/10 rounded-lg max-w-md w-full space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-['Anton'] text-lg uppercase">Edit Image</h3>
              <button
                onClick={() => setEditingImageIndex(null)}
                className="text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Image preview */}
            <div className="aspect-square bg-zinc-900 border border-white/10 rounded overflow-hidden">
              <img src={editingImage.url} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Image Type */}
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">Image Type</label>
              <select
                value={editingImage.imageType}
                onChange={e => setImages(prev => prev.map((im, i) => i === editingImageIndex ? { ...im, imageType: e.target.value as ImageType } : im))}
                className="w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
              >
                {(["thumbnail", "front", "back", "size_chart", "gallery"] as ImageType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-white/30 text-xs mt-1">thumbnail: product grid, front: hero product, back: detail, size_chart: sizing guide, gallery: carousel</p>
            </div>

            {/* Color/Variation */}
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">Color/Variation</label>
              <select
                value={editingImage.color || ""}
                onChange={e => setImages(prev => prev.map((im, i) => i === editingImageIndex ? { ...im, color: e.target.value || undefined } : im))}
                className="w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
              >
                <option value="">— Select (optional) —</option>
                {Array.from(new Set(variants.map(v => v.color))).map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
              <p className="text-white/30 text-xs mt-1">Assign this image to a specific color (e.g., Black, White)</p>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">Sort Order</label>
              <input
                type="number"
                value={editingImage.sortOrder}
                onChange={e => setImages(prev => prev.map((im, i) => i === editingImageIndex ? { ...im, sortOrder: parseInt(e.target.value) || 0 } : im))}
                className="w-full bg-[#111] border border-white/10 text-white text-sm px-3 py-2.5 rounded focus:outline-none focus:border-red-600/60"
              />
              <p className="text-white/30 text-xs mt-1">Lower numbers appear first in the gallery</p>
            </div>

            {/* Delete button */}
            <button
              onClick={async () => {
                if (!confirm("Delete this image?")) return;
                if (editingImage.id) {
                  await deleteImageMutation.mutateAsync({ imageId: editingImage.id });
                  utils.shop.adminGetProducts.invalidate();
                }
                setImages(prev => prev.filter((_, i) => i !== editingImageIndex));
                setEditingImageIndex(null);
              }}
              disabled={deleteImageMutation.isPending}
              className="w-full bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-500 py-2 font-semibold uppercase tracking-widest transition-colors rounded"
            >
              {deleteImageMutation.isPending ? "Deleting..." : "Delete Image"}
            </button>

            {/* Close button */}
            <button
              onClick={() => setEditingImageIndex(null)}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2 font-semibold uppercase tracking-widest transition-colors rounded"
            >
              Done
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
