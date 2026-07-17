import { useState, useMemo, useCallback, useEffect } from "react";
import { SiteNav } from "@/components/SiteNav";
import { ShoppingCart, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

// ─── Color-specific image galleries ─────────────────────────────────────────
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

// ─── Product data ─────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 1,
    name: "Spirit of The Mitten Tee",
    price: 4999,
    colors: ["Black", "White"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    description:
      "Premium heavyweight 100% cotton t-shirt with a structured oversized fit, thick ribbed collar, durable construction, and ultra-soft feel designed for everyday wear.",
    features: ["Large front graphic", "Large back tour graphic"],
    getImages: (color: string) => SPIRIT_TEE_IMAGES[color] || SPIRIT_TEE_IMAGES.Black,
    isHero: true,
    isLimitedRelease: true,
  },
  {
    id: 2,
    name: "Murder Mitten Classic Logo Tee",
    price: 3499,
    colors: ["Black", "White"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    description:
      "Premium heavyweight 100% cotton t-shirt with a structured oversized fit, thick ribbed collar, durable construction, and ultra-soft feel designed for everyday wear.",
    features: ["Large front logo graphic"],
    getImages: (color: string) => [
      color === "White"
        ? "/manus-storage/spirit-white-new-front_d5abb7f7.jpg"
        : "/manus-storage/spirit-black-new-front_8f102326.jpg",
    ],
    isHero: false,
    isLimitedRelease: false,
  },
];

// ─── Image Carousel ───────────────────────────────────────────────────────────
function ImageCarousel({ images, productName }: { images: string[]; productName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset to first image when images array changes (color switch)
  useEffect(() => {
    setActiveIdx(0);
  }, [images]);

  const prev = () => setActiveIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setActiveIdx((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative bg-[#111] aspect-[3/4] max-h-[70vw] md:max-h-none rounded-lg overflow-hidden group">
        <img
          src={images[activeIdx]}
          alt={`${productName} - view ${activeIdx + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
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
            {/* Slide counter */}
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {activeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                idx === activeIdx ? "border-red-600" : "border-white/20 hover:border-white/40"
              }`}
            >
              <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Merch() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  // tRPCroduct modal state
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [showCart, setShowCart] = useState(false);

  // Hero product color selection (separate from modal)
  const [heroColor, setHeroColor] = useState<string>("Black");

  // tRPC queries and mutations
  const cartQuery = trpc.merch.cart.getCart.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const addToCartMutation = trpc.merch.cart.addItem.useMutation({
    onSuccess: () => {
      cartQuery.refetch();
    },
  });
  const updateCartMutation = trpc.merch.cart.updateQuantity.useMutation({
    onSuccess: () => cartQuery.refetch(),
  });
  const removeCartMutation = trpc.merch.cart.removeItem.useMutation({
    onSuccess: () => cartQuery.refetch(),
  });
  const checkoutMutation = trpc.merch.checkout.createSession.useMutation();

  const cartItems = cartQuery.data || [];

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      return sum + (product?.price || 0) * item.quantity;
    }, 0);
  }, [cartItems]);

  const shippingCost = cartTotal >= 10000 ? 0 : 399; // $3.99 flat, free over $100
  const orderTotal = cartTotal + shippingCost;

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // ─── Add to cart ──────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(
    async (product: typeof PRODUCTS[0], color: string, size: string, qty: number) => {
      if (!user) {
        window.location.href = getLoginUrl();
        return;
      }
      if (!color) {
        toast.error("Please select a color");
        return;
      }
      if (!size) {
        toast.error("Please select a size");
        return;
      }

      try {
        await addToCartMutation.mutateAsync({
          productId: product.id,
          color,
          size,
          quantity: qty,
        });
        toast.success(`Added to cart! ${product.name} — ${color} / ${size}`);
        // Close modal if open
        setSelectedProduct(null);
        setSelectedColor("");
        setSelectedSize("");
        setQuantity(1);
      } catch (err: any) {
        console.error("Add to cart error:", err);
        toast.error(err?.message || "Failed to add to cart. Please try again.");
      }
    },
    [user, addToCartMutation, toast]
  );

  // ─── Checkout ─────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      const items = cartItems.map((item) => {
        const product = PRODUCTS.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product?.name || "Unknown",
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: product?.price || 0,
        };
      });

      const shippingAddress = {
        name: user.name || user.artistName || "Customer",
        email: user.email,
        address: "To be filled during checkout",
        city: "",
        state: "",
        zip: "",
        country: "US",
      };

      const result = await checkoutMutation.mutateAsync({ items, shippingAddress });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: any) {
      console.error("Checkout failed:", err);
        toast.error(err?.message || "Checkout failed. Please try again.");
    }
  };

  const heroProduct = PRODUCTS.find((p) => p.isHero)!;
  const heroImages = heroProduct.getImages(heroColor);
  const otherProducts = PRODUCTS.filter((p) => !p.isHero);

  // Modal images
  const modalImages = selectedProduct
    ? selectedProduct.getImages(selectedColor || selectedProduct.colors[0])
    : [];

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      {/* ── HERO PRODUCT ──────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-10 md:pt-24 md:pb-16">
        <div className="container grid md:grid-cols-2 gap-6 md:gap-12 items-start">
          {/* Left: Image Carousel */}
          <div>
            <ImageCarousel images={heroImages} productName={heroProduct.name} />
          </div>

          {/* Right: Product Info */}
          <div className="flex flex-col gap-5 md:gap-8 md:sticky md:top-28">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {heroProduct.isLimitedRelease && (
                <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  Limited First Release
                </span>
              )}
              <span className="border border-white/30 text-white/60 px-3 py-1 text-xs uppercase tracking-widest">
                First Collection
              </span>
            </div>

            <div>
              <h1 className="font-['Anton'] text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-3 uppercase leading-none break-words">
                {heroProduct.name}
              </h1>
              <p className="text-3xl md:text-4xl font-bold text-red-600 mb-4 md:mb-6">
                ${(heroProduct.price / 100).toFixed(2)}
              </p>
              <p className="text-white/70 text-base leading-relaxed mb-4">
                {heroProduct.description}
              </p>
              <ul className="space-y-1 text-white/50 text-sm">
                {heroProduct.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-red-600">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Color Selection */}
            <div>
              <p className="text-xs uppercase tracking-widest text-white/50 mb-3">
                Color: <span className="text-white">{heroColor}</span>
              </p>
              <div className="flex gap-3">
                {heroProduct.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setHeroColor(color)}
                    className={`px-5 py-2 text-sm font-semibold uppercase tracking-widest transition-all border ${
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
            <div>
              <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Size</p>
              <div className="grid grid-cols-3 gap-2">
                {heroProduct.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedProduct(heroProduct);
                      setSelectedColor(heroColor);
                      setSelectedSize(size);
                    }}
                    className={`py-2 text-sm font-semibold uppercase tracking-widest transition-all border ${
                      selectedProduct?.id === heroProduct.id && selectedSize === size
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
            <div className="flex gap-4 items-center">
              <div className="flex items-center border border-white/30">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 text-white/60 hover:text-white"
                >
                  −
                </button>
                <span className="px-6 py-3 text-white font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-3 text-white/60 hover:text-white"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  if (!selectedProduct || selectedProduct.id !== heroProduct.id) {
                    // Auto-select this product with current hero color
                    if (!selectedSize) {
                      toast.error("Please select a size");
                      return;
                    }
                    handleAddToCart(heroProduct, heroColor, selectedSize, quantity);
                  } else {
                    handleAddToCart(heroProduct, heroColor, selectedSize, quantity);
                  }
                }}
                disabled={
                  !selectedSize ||
                  (selectedProduct?.id === heroProduct.id && addToCartMutation.isPending)
                }
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-3 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-5 h-5" />
                )}
                {selectedSize ? "Add to Cart" : "Select a Size"}
              </button>
            </div>

            {/* Shipping note */}
            <p className="text-xs text-white/40 text-center">
              $3.99 shipping · Free on orders over $100 · Estimated 5–7 business days
            </p>
          </div>
        </div>
      </section>

      {/* ── OTHER PRODUCTS ────────────────────────────────────────────────── */}
      {otherProducts.length > 0 && (
        <section className="py-12 md:py-20 border-t border-white/10">
          <div className="container">
            <h2 className="font-['Anton'] text-3xl md:text-4xl mb-8 md:mb-12 uppercase">The Collection</h2>
            <div className="grid md:grid-cols-2 gap-12">
              {otherProducts.map((product) => (
                <div key={product.id} className="group">
                  <div className="relative bg-[#111] aspect-[3/4] rounded-lg overflow-hidden mb-6">
                    <img
                      src={product.getImages("Black")[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <h3 className="font-['Anton'] text-2xl mb-2 uppercase">{product.name}</h3>
                  <p className="text-2xl font-bold text-red-600 mb-3">
                    ${(product.price / 100).toFixed(2)}
                  </p>
                  <p className="text-white/60 text-sm mb-6">{product.description}</p>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setSelectedColor(product.colors[0]);
                      setSelectedSize("");
                      setQuantity(1);
                    }}
                    className="w-full border border-white/30 hover:border-white/60 text-white py-3 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    Shop The Drop
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRODUCT MODAL ─────────────────────────────────────────────────── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className="bg-[#0a0a0a] border border-white/20 rounded-lg w-full max-w-3xl my-8">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/20 flex items-center justify-between p-6 rounded-t-lg z-10">
              <h3 className="font-bold text-lg uppercase tracking-wide">{selectedProduct.name}</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Image Carousel */}
                <ImageCarousel images={modalImages} productName={selectedProduct.name} />

                {/* Product Details */}
                <div className="space-y-6">
                  {selectedProduct.isLimitedRelease && (
                    <span className="inline-block bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest">
                      Limited First Release
                    </span>
                  )}

                  <div>
                    <p className="text-3xl font-bold text-red-600 mb-3">
                      ${(selectedProduct.price / 100).toFixed(2)}
                    </p>
                    <p className="text-white/70 text-sm leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>

                  {/* Color */}
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-3">
                      Color: <span className="text-white">{selectedColor}</span>
                    </p>
                    <div className="flex gap-2">
                      {selectedProduct.colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all border ${
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
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Size</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProduct.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`py-2 text-xs font-semibold uppercase tracking-widest transition-all border ${
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

                  {/* Quantity + CTA */}
                  <div className="flex gap-3 items-center">
                    <div className="flex items-center border border-white/30">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-2 text-white/60 hover:text-white"
                      >
                        −
                      </button>
                      <span className="px-4 py-2 text-white font-semibold">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-3 py-2 text-white/60 hover:text-white"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        handleAddToCart(selectedProduct, selectedColor, selectedSize, quantity)
                      }
                      disabled={!selectedColor || !selectedSize || addToCartMutation.isPending}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-2 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {addToCartMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      {!selectedColor
                        ? "Select Color"
                        : !selectedSize
                        ? "Select Size"
                        : "Add to Cart"}
                    </button>
                  </div>

                  <p className="text-xs text-white/40 text-center">
                    $3.99 shipping · Free on orders over $100
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CART BUTTON ───────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowCart(true)}
        className="fixed bottom-8 right-8 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full flex items-center gap-2 font-bold uppercase tracking-widest transition-all shadow-lg z-40"
      >
        <ShoppingCart className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {cartCount}
          </span>
        )}
      </button>

      {/* ── CART SIDEBAR ──────────────────────────────────────────────────── */}
      {showCart && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCart(false);
          }}
        >
          <div className="bg-[#0a0a0a] border-l border-white/20 w-full max-w-md flex flex-col max-h-screen">
            {/* Header */}
            <div className="border-b border-white/20 flex items-center justify-between p-6">
              <h3 className="font-bold text-lg uppercase">
                Shopping Cart{" "}
                {cartCount > 0 && (
                  <span className="text-red-600 text-sm">({cartCount})</span>
                )}
              </h3>
              <button onClick={() => setShowCart(false)} className="text-white/60 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cartQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">Your cart is empty</p>
                  <button
                    onClick={() => setShowCart(false)}
                    className="mt-4 text-red-600 hover:text-red-500 text-sm font-semibold uppercase tracking-widest"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                cartItems.map((item) => {
                  const product = PRODUCTS.find((p) => p.id === item.productId);
                  if (!product) return null;
                  const thumb = product.getImages(item.color)[0];
                  return (
                    <div key={item.id} className="border border-white/20 rounded-lg p-4">
                      <div className="flex gap-4">
                        <img
                          src={thumb}
                          alt={product.name}
                          className="w-16 h-20 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-sm leading-tight">{product.name}</p>
                              <p className="text-xs text-white/60 mt-1">
                                {item.color} / {item.size}
                              </p>
                            </div>
                            <button
                              onClick={() => removeCartMutation.mutateAsync({ cartItemId: item.id })}
                              className="text-white/40 hover:text-white flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-1 border border-white/30 rounded">
                              <button
                                onClick={() =>
                                  updateCartMutation.mutateAsync({
                                    cartItemId: item.id,
                                    quantity: item.quantity - 1,
                                  })
                                }
                                className="px-2 py-1 text-white/60 hover:text-white text-sm"
                              >
                                −
                              </button>
                              <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                              <button
                                onClick={() =>
                                  updateCartMutation.mutateAsync({
                                    cartItemId: item.id,
                                    quantity: item.quantity + 1,
                                  })
                                }
                                className="px-2 py-1 text-white/60 hover:text-white text-sm"
                              >
                                +
                              </button>
                            </div>
                            <p className="font-bold text-sm">
                              ${((product.price * item.quantity) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="border-t border-white/20 p-6 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Subtotal:</span>
                    <span>${(cartTotal / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Shipping:</span>
                    <span className={shippingCost === 0 ? "text-green-500 font-bold" : ""}>
                      {shippingCost === 0 ? "FREE" : `$${(shippingCost / 100).toFixed(2)}`}
                    </span>
                  </div>
                  {shippingCost > 0 && (
                    <>
                      <p className="text-xs text-white/40">
                        Add ${((10000 - cartTotal) / 100).toFixed(2)} more for free shipping
                      </p>
                      <p className="text-xs text-white/40">$3.99 standard shipping</p>
                    </>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2">
                    <span>Total:</span>
                    <span className="text-red-600">${(orderTotal / 100).toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white py-4 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Proceed to Checkout"
                  )}
                </button>

                <p className="text-xs text-white/40 text-center">
                  Secure checkout via Stripe · Apple Pay & Google Pay accepted
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
