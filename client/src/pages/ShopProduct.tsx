/* ============================================================
   MURDER MITTEN MEDIA — Dynamic Product Page
   Auto-generated from database product record
   ============================================================ */

import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  ShoppingBag, ChevronLeft, ChevronRight, Truck, Shield,
  Star, ArrowLeft, Minus, Plus, Check, AlertCircle, X
} from "lucide-react";

// ─── Image Carousel ───────────────────────────────────────────
function ImageCarousel({ images, productName }: { images: { url: string; imageType: string }[]; productName: string }) {
  const [current, setCurrent] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square bg-zinc-900 border border-white/10 rounded-lg flex items-center justify-center">
        <ShoppingBag size={48} className="text-white/20" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square bg-zinc-950 rounded-lg overflow-hidden border border-white/10">
        <img
          src={images[current].url}
          alt={`${productName} - ${images[current].imageType}`}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent(i => (i - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrent(i => (i + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 right-3 bg-black/60 text-white/70 text-xs px-2 py-1 rounded-full">
              {current + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                i === current ? "border-red-600" : "border-white/10 hover:border-white/30"
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Product Page ────────────────────────────────────────
export default function ShopProduct() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: product, isLoading, error } = trpc.shop.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const addToCart = trpc.merch.cart.addItem.useMutation({
    onSuccess: () => {
      toast.success("Added to cart!");
      utils.merch.cart.getCart.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── State ─────────────────────────────────────────────────
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Derive available colors and sizes from variants
  const colors = product ? Array.from(new Set(product.variants.map((v: any) => v.color as string))) : [];
  const sizes = product ? Array.from(new Set(product.variants.map((v: any) => v.size as string))) : [];

  // Set defaults when product loads
  useEffect(() => {
    if (product && colors.length > 0 && !selectedColor) {
      setSelectedColor(colors[0] as string);
    }
    if (product && sizes.length > 0 && !selectedSize) {
      setSelectedSize(sizes[0] as string);
    }
  }, [product]);

  // Filter images by selected color (if color-specific images exist)
  const displayImages = product
    ? (product.images as any[]).filter((img: any) => img.sortOrder >= 0)
    : [];

  // Check inventory for selected variant
  const selectedVariant = product?.variants.find(
    (v: any) => v.color === selectedColor && v.size === selectedSize
  );
  const inStock = selectedVariant ? (selectedVariant as any).inventoryQty > 0 : false;
  const stockQty = (selectedVariant as any)?.inventoryQty ?? 0;

  // Sizes available for selected color
  const sizesForColor = product
    ? product.variants
        .filter((v: any) => v.color === selectedColor)
        .map((v: any) => v.size)
    : [];

  const handleAddToCart = () => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!product) return;
    if (!selectedColor || !selectedSize) {
      toast.error("Please select a color and size");
      return;
    }
    if (!inStock) {
      toast.error("This variant is out of stock");
      return;
    }

    addToCart.mutate({
      productId: product.id,
      color: selectedColor,
      size: selectedSize,
      quantity,
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  // ─── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="font-['Anton'] text-2xl mb-2">PRODUCT NOT FOUND</h2>
          <p className="text-white/50 mb-6">This product doesn't exist or has been removed.</p>
          <Link href="/merch" className="text-red-500 hover:text-red-400 text-sm">← Back to Shop</Link>
        </div>
      </div>
    );
  }

  const priceDisplay = `$${(product.price / 100).toFixed(2)}`;
  const compareDisplay = product.compareAtPrice ? `$${(product.compareAtPrice / 100).toFixed(2)}` : null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Breadcrumb */}
      <div className="border-b border-white/5">
        <div className="container py-3 flex items-center gap-2 text-sm text-white/40">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/merch" className="hover:text-white transition-colors">Shop</Link>
          <span>/</span>
          <span className="text-white/70">{product.name}</span>
        </div>
      </div>

      <div className="container py-8 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Left: Images */}
          <div>
            <ImageCarousel images={displayImages} productName={product.name} />
          </div>

          {/* Right: Product details */}
          <div className="flex flex-col gap-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {product.badge && (
                <span className="bg-red-600 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  {product.badge}
                </span>
              )}
              {product.category && (
                <span className="border border-white/20 text-white/50 text-xs uppercase tracking-widest px-3 py-1 rounded-full">
                  {product.category}
                </span>
              )}
            </div>

            {/* Name & price */}
            <div>
              <h1 className="font-['Anton'] text-4xl sm:text-5xl leading-none uppercase mb-2">
                {product.name}
              </h1>
              {product.subtitle && (
                <p className="text-white/50 text-sm mb-4">{product.subtitle}</p>
              )}
              <div className="flex items-center gap-3">
                <span className="font-['Anton'] text-3xl text-red-500">{priceDisplay}</span>
                {compareDisplay && (
                  <span className="text-white/30 text-xl line-through">{compareDisplay}</span>
                )}
              </div>
            </div>

            {/* Color selector */}
            {colors.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-widest mb-2">
                  Color: <span className="text-white font-semibold">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <button
                      key={color as string}
                      onClick={() => {
                        setSelectedColor(color as string);
                        // Reset size if not available for this color
                        const availableSizes = product.variants
                          .filter((v: any) => v.color === color)
                          .map((v: any) => v.size);
                        if (!availableSizes.includes(selectedSize)) {
                          setSelectedSize(availableSizes[0] ?? "");
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium border rounded transition-all ${
                        selectedColor === color
                          ? "border-red-600 bg-red-600/10 text-white"
                          : "border-white/20 text-white/60 hover:border-white/50 hover:text-white"
                      }`}
                    >
                      {color as string}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {sizes.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-widest mb-2">
                  Size: <span className="text-white font-semibold">{selectedSize}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => {
                    const available = sizesForColor.includes(size as string);
                    const variant = product.variants.find(
                      (v: any) => v.color === selectedColor && v.size === size
                    );
                    const hasStock = (variant as any)?.inventoryQty > 0;
                    return (
                      <button
                        key={size as string}
                        onClick={() => available && setSelectedSize(size as string)}
                        disabled={!available || !hasStock}
                        className={`w-12 h-12 text-sm font-semibold border rounded transition-all relative ${
                          selectedSize === size
                            ? "border-red-600 bg-red-600/10 text-white"
                            : available && hasStock
                            ? "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
                            : "border-white/10 text-white/20 cursor-not-allowed line-through"
                        }`}
                      >
                        {size as string}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <p className="text-xs text-white/50 uppercase tracking-widest mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 border border-white/20 rounded flex items-center justify-center text-white hover:border-white/50 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-semibold text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(stockQty, q + 1))}
                  disabled={quantity >= stockQty}
                  className="w-10 h-10 border border-white/20 rounded flex items-center justify-center text-white hover:border-white/50 disabled:opacity-30 transition-colors"
                >
                  <Plus size={14} />
                </button>
                {stockQty > 0 && stockQty <= 5 && (
                  <span className="text-amber-400 text-xs font-medium">Only {stockQty} left!</span>
                )}
              </div>
            </div>

            {/* Add to Cart */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!inStock || addToCart.isPending}
                className={`w-full py-4 font-['Anton'] text-lg uppercase tracking-widest transition-all flex items-center justify-center gap-3 rounded ${
                  !inStock
                    ? "bg-zinc-800 text-white/30 cursor-not-allowed"
                    : addedFeedback
                    ? "bg-green-600 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white hover:shadow-[0_0_30px_rgba(209,0,0,0.3)]"
                }`}
              >
                {addedFeedback ? (
                  <><Check size={18} /> Added to Cart</>
                ) : !inStock ? (
                  "Out of Stock"
                ) : addToCart.isPending ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <><ShoppingBag size={18} /> Add to Cart</>
                )}
              </button>
            </div>

            {/* Shipping info */}
            <div className="border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Truck size={16} className="text-red-500 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">$3.99 flat shipping</span>
                  <span className="text-white/40"> · Free on orders over $100</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield size={16} className="text-red-500 flex-shrink-0" />
                <span className="text-white/60">Secure checkout via Stripe</span>
              </div>
              {(product as any).shippingEstimate && (
                <div className="flex items-center gap-3 text-sm">
                  <Star size={16} className="text-red-500 flex-shrink-0" />
                  <span className="text-white/60">Estimated delivery: {(product as any).shippingEstimate}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {(product as any).description && (
              <div>
                <h3 className="text-xs text-white/50 uppercase tracking-widest mb-3">Product Details</h3>
                <p className="text-white/70 text-sm leading-relaxed">{(product as any).description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
