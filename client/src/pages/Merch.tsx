/* ============================================================
   MURDER MITTEN MEDIA — Merch Page
   Dynamic product catalog from DB, hero product, cart integration
   Mobile-optimized: no horizontal overflow, responsive layout
   ============================================================ */

import { useState, useMemo } from "react";
import { SiteNav } from "@/components/SiteNav";
import { ShoppingCart, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
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

  if (colorImages.length > 0) {
    return colorImages.map((img) => img.url);
  }

  return product.images.map((img) => img.url);
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
  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  return sizes.length > 0 ? sizes : [];
}

// ─── Image Carousel Component ─────────────────────────────────────────────────
function ImageCarousel({ images, productName }: { images: string[]; productName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full max-w-full aspect-square bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden">
        <p className="text-white/40 text-sm">No images available</p>
      </div>
    );
  }

  const prev = () => setActiveIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setActiveIdx((i) => (i + 1) % images.length);

  return (
    <div className="w-full max-w-full space-y-3 min-w-0">
      {/* Main image */}
      <div className="relative group w-full max-w-full aspect-square bg-zinc-900 border border-white/10 rounded overflow-hidden min-w-0">
        <img
          src={images[activeIdx]}
          alt={productName}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {activeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="w-full max-w-full flex gap-2 overflow-x-auto pb-1 min-w-0">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded border transition-all min-w-0 ${
                activeIdx === idx
                  ? "border-red-600 ring-1 ring-red-600"
                  : "border-white/20 hover:border-white/40"
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

// ─── Main Merch Page ──────────────────────────────────────────────────────────
export default function Merch() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // ─── State ────────────────────────────────────────────────────────────────
  const [heroColor, setHeroColor] = useState<string>("Black");
  const [heroSize, setHeroSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  // ─── tRPC: fetch products from DB ─────────────────────────────────────────
  const productsQuery = trpc.shop.getProducts.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
  const products = productsQuery.data || [];

  // ─── tRPC: cart operations ─────────────────────────────────────────────────
  const cartQuery = trpc.merch.cart.getCart.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const addToCartMutation = trpc.merch.cart.addItem.useMutation();
  const utils = trpc.useUtils();

  // ─── Derived state ────────────────────────────────────────────────────────
  const heroProduct = useMemo(
    () => products.find((p) => p.featured),
    [products]
  );
  const otherProducts = useMemo(() => {
    if (!heroProduct) return products;
    return products.filter((p) => p.id !== heroProduct.id);
  }, [products, heroProduct]);

  const heroColors = useMemo(() => heroProduct ? getProductColors(heroProduct) : [], [heroProduct]);
  const heroSizes = useMemo(() => heroProduct ? getProductSizes(heroProduct, heroColor) : [], [heroProduct, heroColor]);
  const heroImages = useMemo(
    () => heroProduct ? getProductImages(heroProduct, heroColor) : [],
    [heroProduct, heroColor]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────
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
      await addToCartMutation.mutateAsync({
        productId: product.id,
        color,
        size,
        quantity: qty,
      });
      toast.success(`Added ${qty} to cart!`);
      utils.merch.cart.getCart.invalidate();
      setQuantity(1);
      setHeroSize("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add to cart");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!productsQuery.isLoading && !heroProduct) {
    return (
      <div className="w-full max-w-full min-h-screen bg-[#080808] text-white overflow-x-hidden">
        <SiteNav />
        <div className="w-full max-w-full flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShoppingCart className="w-16 h-16 text-white/20" />
          <p className="font-['Anton'] text-3xl uppercase text-white/40">Drop Coming Soon</p>
          <p className="text-white/40 text-sm">Check back for new merch drops.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      {/* ── HERO PRODUCT ──────────────────────────────────────────────────── */}
      <section className="w-full max-w-full relative pt-12 pb-6 md:pt-16 md:pb-10 overflow-x-hidden">
        <div className="container w-full max-w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start min-w-0">
          {/* Left: Image Carousel */}
          <div className="w-full max-w-full min-w-0 overflow-hidden">
            {heroProduct && <ImageCarousel images={heroImages} productName={heroProduct.name} />}
          </div>

          {/* Right: Product Info */}
          <div className="w-full max-w-full min-w-0 flex flex-col gap-4 md:gap-6 md:sticky md:top-28 overflow-x-hidden">
            {/* Badges */}
            <div className="w-full max-w-full flex flex-wrap gap-1.5 min-w-0">
              {heroProduct?.badge && (
                <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest flex-shrink-0">
                  {heroProduct.badge}
                </span>
              )}
              <span className="border border-white/30 text-white/60 px-3 py-1 text-xs uppercase tracking-widest flex-shrink-0">
                First Collection
              </span>
            </div>

            <div className="w-full max-w-full min-w-0 overflow-x-hidden">
              <h1 className="font-['Anton'] text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-2 uppercase leading-none break-words w-full max-w-full">
                {heroProduct?.name}
              </h1>
              {heroProduct?.subtitle && (
                <p className="text-white/50 text-sm uppercase tracking-widest mb-2 w-full max-w-full break-words">
                  {heroProduct.subtitle}
                </p>
              )}
              <p className="text-2xl md:text-3xl font-bold text-red-600 mb-2 md:mb-3 w-full max-w-full">
                ${heroProduct ? (heroProduct.price / 100).toFixed(2) : "0.00"}
              </p>
              {heroProduct?.compareAtPrice && (
                <p className="text-white/40 line-through text-lg mb-2 w-full max-w-full">
                  ${(heroProduct.compareAtPrice / 100).toFixed(2)}
                </p>
              )}
              <p className="text-white/70 text-sm leading-relaxed mb-3 w-full max-w-full whitespace-normal break-words">
                {heroProduct?.description}
              </p>
            </div>

            {/* Color Selection */}
            <div className="w-full max-w-full min-w-0 overflow-x-hidden">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-2 w-full max-w-full">
                Color: <span className="text-white">{heroColor}</span>
              </p>
              <div className="w-full max-w-full flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
                {heroColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setHeroColor(color)}
                    className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold uppercase tracking-widest transition-all border min-w-0 ${
                      heroColor === color
                        ? "bg-red-600 text-white border-red-600"
                        : "border-white/30 text-white/70 hover:border-white/60"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="w-full max-w-full min-w-0 overflow-x-hidden">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-2 w-full max-w-full">Size</p>
              <div className="w-full max-w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-1.5 min-w-0">
                {heroSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setHeroSize(size)}
                    className={`w-full max-w-full py-2 sm:py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-widest transition-all border min-w-0 ${
                      heroSize === size
                        ? "bg-red-600 text-white border-red-600"
                        : "border-white/30 text-white/70 hover:border-white/60"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + CTA */}
            <div className="w-full max-w-full min-w-0 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center overflow-x-hidden">
              <div className="w-full sm:w-auto flex items-center border border-white/30 bg-black/40 flex-shrink-0 min-w-0">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 sm:px-4 py-2 sm:py-3 text-white/60 hover:text-white text-sm sm:text-base flex-shrink-0"
                >
                  −
                </button>
                <span className="px-4 sm:px-6 py-2 sm:py-3 text-white font-semibold text-sm sm:text-base flex-shrink-0">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 sm:px-4 py-2 sm:py-3 text-white/60 hover:text-white text-sm sm:text-base flex-shrink-0"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  if (!heroSize) {
                    toast.error("Please select a size");
                    return;
                  }
                  if (heroProduct) {
                    handleAddToCart(heroProduct, heroColor, heroSize, quantity);
                  }
                }}
                disabled={!heroSize || addToCartMutation.isPending}
                className="w-full max-w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-2.5 sm:py-3 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs sm:text-sm min-w-0"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin flex-shrink-0" />
                ) : (
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                )}
                <span className="hidden sm:inline flex-shrink-0">{heroSize ? "Add to Cart" : "Select a Size"}</span>
                <span className="sm:hidden flex-shrink-0">{heroSize ? "Add" : "Select"}</span>
              </button>
            </div>

            {/* Shipping info */}
            <p className="text-white/40 text-xs mt-2 w-full max-w-full break-words">
              {heroProduct?.shippingEstimate || "3–7 business days"} · Free on orders over $100 · Estimated arrival
            </p>
          </div>
        </div>
      </section>

      {/* ── COLLECTION ────────────────────────────────────────────────────── */}
      {otherProducts.length > 0 && (
        <section className="w-full max-w-full py-10 md:py-16 border-t border-white/10 overflow-x-hidden">
          <div className="container w-full max-w-full">
            <h2 className="font-['Anton'] text-3xl md:text-4xl uppercase mb-6 w-full max-w-full break-words">
              The Collection
            </h2>
            <div className="w-full max-w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
              {otherProducts.map((product) => {
                const colors = getProductColors(product);
                const firstColor = colors[0] || "Black";
                const images = getProductImages(product, firstColor);
                const firstImage = images[0];

                return (
                  <button
                    key={product.id}
                    onClick={() => navigate(`/merch/${product.slug}`)}
                    className="w-full max-w-full text-left min-w-0 overflow-x-hidden"
                  >
                    <div className="w-full max-w-full relative aspect-square bg-zinc-900 border border-white/10 rounded overflow-hidden mb-4 group hover:border-red-600/50 transition-colors min-w-0">
                      {firstImage && (
                        <img
                          src={firstImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      {product.badge && (
                        <span className="absolute top-3 left-3 bg-red-600 text-white px-2 py-1 text-xs font-bold uppercase tracking-widest">
                          {product.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="font-['Anton'] text-lg uppercase mb-1 group-hover:text-red-600 transition-colors w-full max-w-full break-words">
                      {product.name}
                    </h3>
                    <p className="text-white/60 text-sm mb-2 w-full max-w-full break-words">
                      {product.subtitle}
                    </p>
                    <p className="text-red-600 font-bold w-full max-w-full">
                      ${(product.price / 100).toFixed(2)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
