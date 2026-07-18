/* ============================================================
   MURDER MITTEN MEDIA — Merch Page
   All products on one page, each with full color/size/cart controls
   Mobile-optimized: no horizontal overflow, responsive layout
   Cart drawer: merch-only, does not affect global SiteNav
   ============================================================ */

import { useState, useMemo } from "react";
import { SiteNav } from "@/components/SiteNav";
import { ShoppingCart, Loader2, ChevronLeft, ChevronRight, X, Minus, Plus, Trash2 } from "lucide-react";
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

type CartItem = {
  id: number;
  productId: number;
  color: string;
  size: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
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
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-white/60 hover:text-white text-sm flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">−</button>
              <span className="px-4 py-2 text-white font-semibold text-sm flex-shrink-0">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-white/60 hover:text-white text-sm flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">+</button>
            </div>
            <button
              onClick={() => {
                if (!selectedSize) { toast.error("Please select a size"); return; }
                onAddToCart(product, selectedColor, selectedSize, quantity);
              }}
              disabled={!selectedSize || isPending}
              className="w-full max-w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-2.5 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-xs min-w-0 min-h-[44px]"
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

// ─── Cart Drawer (merch-only) ─────────────────────────────────────────────────
function CartDrawer({
  open,
  onClose,
  products,
}: {
  open: boolean;
  onClose: () => void;
  products: ShopProduct[];
}) {
  const utils = trpc.useUtils();
  const { data: cartItems = [] } = trpc.merch.cart.getCart.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: open ? 3000 : false,
  });

  const updateQty = trpc.merch.cart.updateQuantity.useMutation({
    onSuccess: () => utils.merch.cart.getCart.invalidate(),
  });
  const removeItem = trpc.merch.cart.removeItem.useMutation({
    onSuccess: () => utils.merch.cart.getCart.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const clearCart = trpc.merch.cart.clearCart.useMutation({
    onSuccess: () => utils.merch.cart.getCart.invalidate(),
  });
  const createSession = trpc.merch.checkout.createSession.useMutation({
    onError: (e) => toast.error(e.message || "Checkout failed"),
  });

  const items = cartItems as CartItem[];

  // Compute subtotal
  const subtotal = items.reduce((sum, item) => {
    const prod = products.find((p) => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);
  const shipping = subtotal >= 10000 ? 0 : 399;
  const total = subtotal + shipping;
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    const checkoutItems = items.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod?.name || "Product",
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: prod?.price || 0,
      };
    });
    try {
      const result = await createSession.mutateAsync({
        items: checkoutItems,
        shippingAddress: {},
      });
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
      }
    } catch {}
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[360px] bg-[#0a0a0a] border-l border-white/10 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            <span className="font-['Anton'] text-lg uppercase tracking-wider">Cart</span>
            {totalCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {totalCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-2 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
              <ShoppingCart className="w-12 h-12 text-white/20" />
              <p className="text-white/40 text-sm uppercase tracking-widest">Your cart is empty</p>
            </div>
          ) : (
            items.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              const thumb = prod ? getProductImages(prod, item.color)[0] : undefined;
              return (
                <div key={item.id} className="flex gap-3 border border-white/10 bg-white/[0.02] rounded p-3">
                  {thumb && (
                    <img src={thumb} alt="" className="w-16 h-16 object-cover rounded flex-shrink-0 border border-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold break-words leading-tight mb-0.5">
                      {prod?.name || "Product"}
                    </p>
                    <p className="text-white/40 text-xs mb-2">{item.color} / {item.size}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center border border-white/20 rounded overflow-hidden">
                        <button
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem.mutate({ cartItemId: item.id });
                            } else {
                              updateQty.mutate({ cartItemId: item.id, quantity: item.quantity - 1 });
                            }
                          }}
                          className="px-2 py-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-white text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                          className="px-2 py-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 text-sm font-bold">
                          ${prod ? ((prod.price * item.quantity) / 100).toFixed(2) : "—"}
                        </span>
                        <button
                          onClick={() => removeItem.mutate({ cartItemId: item.id })}
                          className="text-white/30 hover:text-red-400 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-white/10 px-4 py-4 space-y-3 flex-shrink-0">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Subtotal</span>
                <span>${(subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : `$${(shipping / 100).toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1.5">
                <span>Total</span>
                <span className="text-red-600">${(total / 100).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={createSession.isPending}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-3 font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {createSession.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Checkout"
              )}
            </button>
            <button
              onClick={() => clearCart.mutate()}
              className="w-full text-white/30 hover:text-white/60 text-xs uppercase tracking-widest py-1 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Cart Icon Button (merch-only) ────────────────────────────────────────────
function MerchCartButton({ onClick }: { onClick: () => void }) {
  const { user } = useAuth();
  const { data: cartItems = [] } = trpc.merch.cart.getCart.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000,
  });
  const items = cartItems as CartItem[];
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      onClick={onClick}
      aria-label={`Open cart${totalCount > 0 ? ` (${totalCount} items)` : ""}`}
      className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-white/70 hover:text-white transition-colors"
    >
      <ShoppingCart className="w-5 h-5" />
      {totalCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      )}
    </button>
  );
}

// ─── Main Merch Page ──────────────────────────────────────────────────────────
export default function Merch() {
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);

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
      setCartOpen(true); // auto-open cart drawer after adding
    } catch (err: any) {
      toast.error(err.message || "Failed to add to cart");
    }
  };

  return (
    <div className="w-full max-w-full min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      <div className="w-full max-w-full container pt-12 pb-16 overflow-x-hidden">
        {/* Page header with cart button */}
        <div className="w-full max-w-full mb-8 min-w-0 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-['Anton'] text-3xl sm:text-4xl uppercase mb-1 break-words w-full max-w-full">
              The Collection
            </h1>
            <p className="text-white/40 text-sm">Murder Mitten Media Official Merch</p>
          </div>
          {/* Cart icon — merch section only */}
          <MerchCartButton onClick={() => setCartOpen(true)} />
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

      {/* Cart Drawer — merch section only, not in global SiteNav */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        products={sortedProducts}
      />
    </div>
  );
}
