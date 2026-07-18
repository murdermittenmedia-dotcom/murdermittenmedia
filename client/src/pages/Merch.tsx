/* ============================================================
   MURDER MITTEN MEDIA — Merch Page
   All products on one page, each with full color/size/cart controls
   Mobile-optimized: no horizontal overflow, responsive layout
   ============================================================ */

import { useState, useMemo } from "react";
import { SiteNav } from "@/components/SiteNav";
import { ShoppingCart, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

// ─── Color-specific image galleries (fallback for Spirit of The Mitten Tee) ──
const SPIRIT_TEE_IMAGES: Record<string, string[]> = {
  White: [
    "/manus-storage/spirit-white-new-front_d5abb7f7.jpg",
    "/manus-storage/spirit-white-new-back_4f8c00df.jpg",
    "/manus-storage/spirit-white-new-slide-1_c10b1b8c.jpg",
    "/manus-storage/spirit-white-new-slide-2_607fb57f.jpg",
    "/manus-storage/spirit-white-new-slide-3_9e5dfd2c.jpg",
    "/manus-storage/spirit-white-new-slide-4_ec3f1f72.jpg",
    "/manus-storage/spirit-white-new-slide-5_5efafb8c.jpg",
    "/manus-storage/spirit-white-new-slide-6_5cc2f171.jpg",
    "/manus-storage/spirit-white-group-new_25af0da3.png",
  ],
  Black: [
    "/manus-storage/spirit-black-new-front_8f102326.jpg",
    "/manus-storage/spirit-black-new-back_dcb729d3.jpg",
    "/manus-storage/spirit-black-new-slide-1_f50d87a3.jpg",
    "/manus-storage/spirit-black-new-slide-2_912aa333.jpg",
    "/manus-storage/spirit-black-new-slide-3_583d7b17.jpg",
    "/manus-storage/spirit-black-new-slide-4_68c24a9c.jpg",
    "/manus-storage/spirit-black-new-slide-5_993605a5.jpg",
    "/manus-storage/spirit-black-new-slide-6_d5879358.jpg",
    "/manus-storage/spirit-black-group-new_a5801d55.png",
  ],
};

// ─── Type definitions ─────────────────────────────────────────────────────────
type ShopImage = {
  id: number;
  url: string;
  storageKey: string | null;
  imageType: string;
  sortOrder: number;
};

type ShopVariant = {
  id: number;
  color: string;
  size: string;
  inventoryQty: number;
};

type ShopProduct = {
  id: number;
  name: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  featured: boolean;
  status: string;
  sortOrder: number;
  shippingEstimate: string | null;
  images: ShopImage[];
  variants: ShopVariant[];
};

// ─── Helper: get color-specific images for a product ─────────────────────────
function getProductImages(product: ShopProduct, color: string): string[] {
  if (!product.images || product.images.length === 0) {
    if (product.slug === "spirit-of-the-mitten-tee") {
      return SPIRIT_TEE_IMAGES[color] || SPIRIT_TEE_IMAGES.Black;
    }
    return [];
  }

  const colorLower = color.toLowerCase();
  const colorImages = product.images.filter((img) => {
    const key = (img.storageKey || img.url || "").toLowerCase();
    return key.includes(colorLower);
  });

  const sortFn = (a: ShopImage, b: ShopImage) => {
    if (a.imageType === "thumbnail" && b.imageType !== "thumbnail") return -1;
    if (a.imageType !== "thumbnail" && b.imageType === "thumbnail") return 1;
    return a.sortOrder - b.sortOrder;
  };

  if (colorImages.length > 0) {
    return [...colorImages].sort(sortFn).map((img) => img.url);
  }

  return [...product.images].sort(sortFn).map((img) => img.url);
}

// ─── Helper: get unique colors from variants ──────────────────────────────────
function getProductColors(product: ShopProduct): string[] {
  const colors = Array.from(new Set(product.variants.map((v) => v.color)));
  return colors.length > 0 ? colors : ["Black", "White"];
}

// ─── Helper: get unique sizes for a color ────────────────────────────────────
function getProductSizes(product: ShopProduct, color?: string): string[] {
  const variants = color
    ? product.variants.filter((v) => v.color === color)
    : product.variants;
  return Array.from(new Set(variants.map((v) => v.size)));
}

// ─── Image Carousel Component ─────────────────────────────────────────────────
function ImageCarousel({ images, productName }: { images: string[]; productName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full max-w-full aspect-square bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden">
        <p className="text-white/40 text-sm">No images</p>
      </div>
    );
  }

  const prev = () => setActiveIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setActiveIdx((i) => (i + 1) % images.length);

  return (
    <div className="w-full max-w-full space-y-2 min-w-0">
      <div className="relative group w-full max-w-full aspect-square bg-zinc-900 border border-white/10 rounded overflow-hidden min-w-0">
        <img src={images[activeIdx]} alt={productName} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {activeIdx + 1}/{images.length}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="w-full max-w-full flex gap-1.5 overflow-x-auto pb-1 min-w-0">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`flex-shrink-0 w-14 h-14 rounded border transition-all ${
                activeIdx === idx ? "border-red-600 ring-1 ring-red-600" : "border-white/20 hover:border-white/40"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover rounded" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Per-product card with full controls ─────────────────────────────────────
function ProductCard({
  product,
  onAddToCart,
  isPending,
}: {
  product: ShopProduct;
  onAddToCart: (product: ShopProduct, color: string, size: string, qty: number) => Promise<void>;
  isPending: boolean;
}) {
  const colors = useMemo(() => getProductColors(product), [product]);
  const [selectedColor, setSelectedColor] = useState(colors[0] || "Black");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  const sizes = useMemo(() => getProductSizes(product, selectedColor), [product, selectedColor]);
  const images = useMemo(() => getProductImages(product, selectedColor), [product, selectedColor]);

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden border border-white/10 bg-white/[0.02] rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-w-0">
        {/* Image carousel */}
        <div className="w-full max-w-full min-w-0 p-4 overflow-hidden">
          <ImageCarousel images={images} productName={product.name} />
        </div>

        {/* Product info */}
        <div className="w-full max-w-full min-w-0 p-4 flex flex-col gap-3 overflow-x-hidden">
          {/* Badges */}
          <div className="w-full max-w-full flex flex-wrap gap-1.5 min-w-0">
            {product.badge && (
              <span className="bg-red-600 text-white px-2 py-0.5 text-xs font-bold uppercase tracking-widest flex-shrink-0">
                {product.badge}
              </span>
            )}
          </div>

          {/* Name + price */}
          <div className="w-full max-w-full min-w-0">
            <h2 className="font-['Anton'] text-xl sm:text-2xl uppercase leading-tight break-words w-full max-w-full mb-1">
              {product.name}
            </h2>
            {product.subtitle && (
              <p className="text-white/50 text-xs uppercase tracking-widest mb-2 break-words w-full max-w-full">
                {product.subtitle}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <p className="text-xl font-bold text-red-600">${(product.price / 100).toFixed(2)}</p>
              {product.compareAtPrice && (
                <p className="text-white/40 line-through text-sm">${(product.compareAtPrice / 100).toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-white/60 text-sm leading-relaxed whitespace-normal break-words w-full max-w-full">
              {product.description}
            </p>
          )}

          {/* Color */}
          <div className="w-full max-w-full min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/50 mb-1.5">
              Color: <span className="text-white">{selectedColor}</span>
            </p>
            <div className="w-full max-w-full flex flex-wrap gap-1.5 min-w-0">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => { setSelectedColor(color); setSelectedSize(""); }}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all border min-w-0 ${
                    selectedColor === color
                      ? "bg-red-600 text-white border-red-600"
                      : "border-white/30 text-white/70 hover:border-white/60"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          {sizes.length > 0 && (
            <div className="w-full max-w-full min-w-0">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-1.5">Size</p>
              <div className="w-full max-w-full grid grid-cols-3 sm:grid-cols-4 gap-1.5 min-w-0">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-full max-w-full py-1.5 text-xs font-semibold uppercase tracking-widest transition-all border min-w-0 ${
                      selectedSize === size
                        ? "bg-red-600 text-white border-red-600"
                        : "border-white/30 text-white/70 hover:border-white/60"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="w-full max-w-full min-w-0 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-auto overflow-x-hidden">
            <div className="w-full sm:w-auto flex items-center border border-white/30 bg-black/40 flex-shrink-0 min-w-0">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-white/60 hover:text-white text-sm flex-shrink-0">−</button>
              <span className="px-4 py-2 text-white font-semibold text-sm flex-shrink-0">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-white/60 hover:text-white text-sm flex-shrink-0">+</button>
            </div>
            <button
              onClick={() => {
                if (!selectedSize) { toast.error("Please select a size"); return; }
                onAddToCart(product, selectedColor, selectedSize, quantity);
              }}
              disabled={!selectedSize || isPending}
              className="w-full max-w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-2.5 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs min-w-0"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              ) : (
                <ShoppingCart className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="flex-shrink-0">{selectedSize ? "Add to Cart" : "Select a Size"}</span>
            </button>
          </div>

          {/* Shipping */}
          <p className="text-white/30 text-xs break-words w-full max-w-full">
            {product.shippingEstimate || "3–7 business days"} · Free on orders over $100
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Merch Page ──────────────────────────────────────────────────────────
export default function Merch() {
  const { user } = useAuth();

  const productsQuery = trpc.shop.getProducts.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
  const products = productsQuery.data || [];

  const addToCartMutation = trpc.merch.cart.addItem.useMutation();
  const utils = trpc.useUtils();

  // Sort: featured first, then by sortOrder
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.sortOrder - b.sortOrder;
    });
  }, [products]);

  const handleAddToCart = async (
    product: ShopProduct,
    color: string,
    size: string,
    qty: number
  ) => {
    if (!user) {
      window.location.href = getLoginUrl("/merch");
      return;
    }
    try {
      await addToCartMutation.mutateAsync({ productId: product.id, color, size, quantity: qty });
      toast.success(`Added ${qty}x ${product.name} to cart!`);
      utils.merch.cart.getCart.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to add to cart");
    }
  };

  return (
    <div className="w-full max-w-full min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      <div className="w-full max-w-full container pt-12 pb-16 overflow-x-hidden">
        {/* Page header */}
        <div className="w-full max-w-full mb-8 min-w-0">
          <h1 className="font-['Anton'] text-3xl sm:text-4xl uppercase mb-1 break-words w-full max-w-full">
            The Collection
          </h1>
          <p className="text-white/40 text-sm">Murder Mitten Media Official Merch</p>
        </div>

        {/* Loading */}
        {productsQuery.isLoading && (
          <div className="w-full max-w-full flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        )}

        {/* Empty */}
        {!productsQuery.isLoading && sortedProducts.length === 0 && (
          <div className="w-full max-w-full flex flex-col items-center justify-center py-24 gap-4">
            <ShoppingCart className="w-16 h-16 text-white/20" />
            <p className="font-['Anton'] text-2xl uppercase text-white/40">Drop Coming Soon</p>
          </div>
        )}

        {/* Products list */}
        <div className="w-full max-w-full flex flex-col gap-8 min-w-0">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
              isPending={addToCartMutation.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
