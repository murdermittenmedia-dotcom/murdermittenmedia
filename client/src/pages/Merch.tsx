import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { ShoppingCart, X } from "lucide-react";
import { Link } from "wouter";

const PRODUCTS = [
  {
    id: 1,
    name: "Spirit of The Mitten Tee",
    price: 4999,
    colors: ["Black", "White"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    description: "Premium heavyweight 100% cotton t-shirt with a structured oversized fit, thick ribbed collar, durable construction, and ultra-soft feel designed for everyday wear.",
    features: ["Large front graphic", "Large back tour graphic"],
    imageUrl: "/manus-storage/6D2A8CF1-3641-4A7C-B0C6-C263A6D2976D_0e0614a3.png",
    frontImageUrl: "/manus-storage/78898EC4-3835-4C0D-B486-086FB812EC3D_7bb2e474.png",
    backImageUrl: "/manus-storage/785A5BEA-B540-4821-8CC6-2BC369E8788A_7f8ff2d2.png",
    isHero: true,
    isLimitedRelease: true,
  },
  {
    id: 2,
    name: "Murder Mitten Classic Logo Tee",
    price: 3499,
    colors: ["Black", "White"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    description: "Premium heavyweight 100% cotton t-shirt with a structured oversized fit, thick ribbed collar, durable construction, and ultra-soft feel designed for everyday wear.",
    features: ["Large front logo graphic"],
    imageUrl: "/manus-storage/7C66A397-27F9-4FC5-8F94-7ACF0BA0BC97_94d060bb.png",
    frontImageUrl: "/manus-storage/IMG_5570_e7d28b19.PNG",
    backImageUrl: "/manus-storage/IMG_5572_a2045412.PNG",
    isHero: false,
    isLimitedRelease: false,
  },
];

export default function Merch() {
  const [selectedProduct, setSelectedProduct] = useState<typeof PRODUCTS[0] | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    if (!selectedColor || !selectedSize) {
      alert("Please select color and size");
      return;
    }
    // TODO: Add to cart logic
    alert(`Added ${quantity}x ${selectedProduct?.name} (${selectedColor}, ${selectedSize}) to cart`);
    setSelectedProduct(null);
  };

  const heroProduct = PRODUCTS.find(p => p.isHero);
  const otherProducts = PRODUCTS.filter(p => !p.isHero);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      {/* Hero Section */}
      {heroProduct && (
        <section className="relative min-h-[80vh] flex items-center pt-20">
          <div className="container grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Product Image */}
            <div className="flex flex-col gap-4">
              <div className="relative bg-white/5 aspect-square rounded-lg overflow-hidden">
                <img
                  src={heroProduct.frontImageUrl}
                  alt={heroProduct.name}
                  className="w-full h-full object-cover"
                />
                {heroProduct.isLimitedRelease && (
                  <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest">
                    Limited First Release
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <img src={heroProduct.frontImageUrl} alt="Front" className="w-full aspect-square object-cover rounded border border-white/20" />
                <img src={heroProduct.backImageUrl} alt="Back" className="w-full aspect-square object-cover rounded border border-white/20" />
                <img src={heroProduct.imageUrl} alt="Detail" className="w-full aspect-square object-cover rounded border border-white/20" />
              </div>
            </div>

            {/* Right: Product Info */}
            <div className="flex flex-col gap-8">
              <div>
                <h1 className="font-['Anton'] text-5xl md:text-6xl mb-4 uppercase">{heroProduct.name}</h1>
                <p className="text-4xl font-bold text-red-600 mb-6">${(heroProduct.price / 100).toFixed(2)}</p>
                <p className="text-white/70 text-lg leading-relaxed mb-6">{heroProduct.description}</p>
                <ul className="space-y-2 text-white/60 text-sm">
                  {heroProduct.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-red-600">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Color Selection */}
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Color</p>
                <div className="flex gap-3">
                  {heroProduct.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedProduct(heroProduct);
                        setSelectedColor(color);
                      }}
                      className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-all ${
                        selectedColor === color
                          ? "bg-red-600 text-white border-red-600"
                          : "border border-white/30 text-white/70 hover:border-white/60"
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
                        setSelectedSize(size);
                      }}
                      className={`py-2 text-sm font-semibold uppercase tracking-widest transition-all ${
                        selectedSize === size
                          ? "bg-red-600 text-white border-red-600"
                          : "border border-white/30 text-white/70 hover:border-white/60"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity & CTA */}
              <div className="flex gap-4 items-center">
                <div className="flex items-center border border-white/30">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-white/60 hover:text-white">−</button>
                  <span className="px-6 py-2 text-white font-semibold">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2 text-white/60 hover:text-white">+</button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedColor || !selectedSize}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white py-3 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Other Products */}
      {otherProducts.length > 0 && (
        <section className="py-24 border-t border-white/10">
          <div className="container">
            <h2 className="font-['Anton'] text-4xl mb-12 uppercase">The Collection</h2>
            <div className="grid md:grid-cols-2 gap-12">
              {otherProducts.map((product) => (
                <div key={product.id} className="group">
                  <div className="relative bg-white/5 aspect-square rounded-lg overflow-hidden mb-6">
                    <img
                      src={product.frontImageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="font-['Anton'] text-2xl mb-2 uppercase">{product.name}</h3>
                  <p className="text-2xl font-bold text-red-600 mb-4">${(product.price / 100).toFixed(2)}</p>
                  <p className="text-white/60 text-sm mb-6">{product.description}</p>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setSelectedColor("");
                      setSelectedSize("");
                    }}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-2 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    View Product
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0a0a0a] border-b border-white/20 flex items-center justify-between p-6">
              <h3 className="font-bold text-lg uppercase">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="text-white/60 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <img src={selectedProduct.frontImageUrl} alt="Front" className="w-full aspect-square object-cover rounded" />
                  <div className="grid grid-cols-2 gap-2">
                    <img src={selectedProduct.backImageUrl} alt="Back" className="w-full aspect-square object-cover rounded" />
                    <img src={selectedProduct.imageUrl} alt="Detail" className="w-full aspect-square object-cover rounded" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-3xl font-bold text-red-600 mb-4">${(selectedProduct.price / 100).toFixed(2)}</p>
                    <p className="text-white/70">{selectedProduct.description}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Color</p>
                    <div className="flex gap-2">
                      {selectedProduct.colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all ${
                            selectedColor === color
                              ? "bg-red-600 text-white"
                              : "border border-white/30 text-white/70 hover:border-white/60"
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Size</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProduct.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`py-2 text-xs font-semibold uppercase tracking-widest transition-all ${
                            selectedSize === size
                              ? "bg-red-600 text-white"
                              : "border border-white/30 text-white/70 hover:border-white/60"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 items-center">
                    <div className="flex items-center border border-white/30">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-white/60 hover:text-white">−</button>
                      <span className="px-4 py-2 text-white font-semibold">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-white/60 hover:text-white">+</button>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      disabled={!selectedColor || !selectedSize}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white py-2 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
