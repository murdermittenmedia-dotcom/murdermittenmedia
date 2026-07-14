/* ============================================================
   MURDER MITTEN MEDIA -- Promo Packages Page
   ============================================================ */

import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";

const PACKAGES = [
  {
    id: "repost",
    name: "Repost",
    price: 5,
    tag: "Starter",
    color: "border-white/20",
    features: ["We press the repost button on your existing post"],
    popular: false,
  },
  {
    id: "story",
    name: "Story Post",
    price: 20,
    tag: "Popular",
    color: "border-red-600",
    features: ["24-hour Instagram Story feature"],
    popular: true,
  },
  {
    id: "day-post",
    name: "24 Hour Page Post",
    price: 50,
    tag: "Best Value",
    color: "border-red-600/60",
    features: ["Featured on our page for 24 hours"],
    popular: false,
  },
  {
    id: "perm-post",
    name: "Permanent Page Post",
    price: 100,
    tag: "Premium",
    color: "border-white/20",
    features: ["Posted permanently to our page"],
    popular: false,
  },
  {
    id: "dual-perm",
    name: "2 Permanent Page Posts",
    price: 150,
    tag: "Value Pack",
    color: "border-white/20",
    features: ["2 permanent posts to our page"],
    popular: false,
  },
];

const BUNDLES = [
  {
    id: "bundle-7day",
    name: "7 Day Pinned Post",
    price: 300,
    description: "Your post is pinned at the top of our profile for 7 days",
    savings: "Maximum Visibility",
  },
  {
    id: "monthly",
    name: "Monthly Unlimited Promo Pass",
    price: 500,
    description: "Unlimited reposts • Unlimited story posts • Unlimited 24-hour page posts • Priority scheduling",
    savings: "Best for Artists",
  },
];

const PAYMENTS = [
  {
    name: "CashApp",
    handle: "$MittenMedia",
    link: "https://cash.app/$MittenMedia",
    qr: "/manus-storage/qr_cashapp_4c95b595.png",
    color: "bg-[#00D632]/10 border-[#00D632]/30",
    textColor: "text-[#00D632]",
    icon: "💸",
  },
  {
    name: "PayPal",
    handle: "@MurderMittenPromo",
    link: "https://paypal.me/MurderMittenPromo",
    qr: "/manus-storage/qr_paypal_ff4951d1.png",
    color: "bg-[#003087]/10 border-[#003087]/30",
    textColor: "text-[#009cde]",
    icon: "🅿️",
  },
  {
    name: "Apple Pay",
    handle: "(313) 420-9004",
    link: "tel:3134209004",
    qr: "/manus-storage/qr_applepay_29919676.png",
    color: "bg-white/5 border-white/20",
    textColor: "text-white",
    icon: "🍎",
  },
  {
    name: "Chime",
    handle: "DM for Chime info",
    link: "https://www.instagram.com/murdermittenmedia/",
    qr: null,
    color: "bg-[#00D632]/5 border-[#00D632]/20",
    textColor: "text-[#00D632]",
    icon: "🏦",
  },
];

export default function Promo() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [activeQR, setActiveQR] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />

      {/* -- HERO ---------------------------------------------- */}
      <section className="pt-32 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-4 mb-6">
            <img src="/manus-storage/mmm_logo_8689da6b.png" alt="Murder Mitten Media Logo" className="w-24 h-24 rounded-full object-cover border-2 border-red-600/50 shadow-[0_0_30px_rgba(209,0,0,0.3)]" />
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">The Mitten · Est. 2022</span>
            </div>
          </div>
          <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase mb-4">
            PROMO <span className="text-red-600">PACKAGES</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-6">
            Reach <span className="text-white font-semibold">45,000+ followers</span> and <span className="text-white font-semibold">4.5M+ monthly views</span> on Murder Mitten Media -- Michigan's #1 rap & culture platform.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/40">
            <span>📍 The Mitten</span>
            <span>🎤 Michigan Rap & Culture</span>
            <span>📈 4.5M Monthly Views</span>
            <span>👥 45.8K Followers</span>
          </div>
        </div>
      </section>

      {/* -- PACKAGES ------------------------------------------ */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Choose Your Package</p>
            <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase">PROMO <span className="text-red-600">RATES</span></h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-6">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id === selectedPackage ? null : pkg.id)}
                className={`relative border-2 p-8 cursor-pointer transition-all duration-300 ${pkg.color} ${
                  selectedPackage === pkg.id ? "bg-red-600/10 scale-[1.02]" : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-red-600 text-white text-xs px-4 py-1 uppercase tracking-widest font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-xs text-red-500 uppercase tracking-widest mb-2 font-semibold">{pkg.tag}</div>
                <div className="font-['Anton'] text-4xl text-white mb-1">${pkg.price}</div>
                <div className="text-white/70 font-semibold mb-6 text-sm">{pkg.name}</div>
                <ul className="space-y-2">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                      <span className="text-red-500 text-xs mt-0.5">✓</span> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {selectedPackage === pkg.id && (
                  <div className="mt-6 text-center">
                    <span className="text-xs text-red-400 uppercase tracking-widest">Selected -- Pay below ↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* -- BUNDLES --------------------------------------- */}
          <div className="text-center mb-8 mt-16">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Premium Offers</p>
            <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase">SPECIAL <span className="text-red-600">DEALS</span></h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {BUNDLES.map((bundle) => (
              <div
                key={bundle.id}
                onClick={() => setSelectedPackage(bundle.id === selectedPackage ? null : bundle.id)}
                className={`border-2 p-8 cursor-pointer transition-all duration-300 ${
                  selectedPackage === bundle.id
                    ? "border-red-600 bg-red-600/10 scale-[1.02]"
                    : "border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1 uppercase tracking-wider font-semibold">
                    {bundle.savings}
                  </span>
                </div>
                <div className="font-['Anton'] text-5xl text-red-500 mb-1">${bundle.price}</div>
                <div className="text-white font-semibold mb-2">{bundle.name}</div>
                <div className="text-white/50 text-sm leading-relaxed">{bundle.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- HOW TO ORDER -------------------------------------- */}
      <section className="py-16 border-t border-white/10">
        <div className="container max-w-3xl mx-auto text-center">
          <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">How It Works</p>
          <h2 className="font-['Anton'] text-4xl uppercase mb-10">ORDER <span className="text-red-600">PROCESS</span></h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Pick a Package", desc: "Choose the promo package that fits your budget and goals above." },
              { step: "02", title: "Send Payment", desc: "Pay via CashApp, PayPal, Apple Pay, Zelle, or Chime using the info below." },
              { step: "03", title: "DM Your Content", desc: "Send your post/content to @murdermittenmedia on Instagram with your receipt." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="font-['Anton'] text-5xl text-red-600/30 mb-3">{s.step}</div>
                <div className="font-semibold text-white mb-2">{s.title}</div>
                <div className="text-white/50 text-sm leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- PAYMENT METHODS ----------------------------------- */}
      <section className="py-16 border-t border-white/10">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Accepted Payments</p>
            <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase">PAY <span className="text-red-600">NOW</span></h2>
            <p className="text-white/40 text-sm mt-2">Tap a payment method to see QR code or tap to pay</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {PAYMENTS.map((pay) => (
              <div key={pay.name} className={`border rounded-none p-6 transition-all duration-300 ${pay.color}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{pay.icon}</span>
                  <div>
                    <div className={`font-['Anton'] text-xl uppercase ${pay.textColor}`}>{pay.name}</div>
                    <div className="text-white/60 text-sm">{pay.handle}</div>
                  </div>
                </div>

                {pay.qr && (
                  <div className="mb-4">
                    <div
                      className="cursor-pointer"
                      onClick={() => setActiveQR(activeQR === pay.name ? null : pay.name)}
                    >
                      {activeQR === pay.name ? (
                        <img
                          src={pay.qr}
                          alt={`${pay.name} QR Code`}
                          className="w-full max-w-[180px] mx-auto border border-white/20 p-2 bg-[#0A0A0A]"
                        />
                      ) : (
                        <div className="border border-white/10 bg-white/5 p-3 text-center text-xs text-white/40 hover:border-white/30 transition-colors cursor-pointer">
                          Tap to show QR code
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <a
                  href={pay.link}
                  target={pay.link.startsWith("http") ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  className={`block text-center text-xs uppercase tracking-widest font-semibold py-3 border transition-all duration-200 ${pay.textColor} border-current hover:bg-white/10`}
                >
                  {pay.name === "Chime" ? "DM on Instagram" : `Pay via ${pay.name}`}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <div className="inline-block border border-white/10 bg-white/[0.03] px-8 py-6 max-w-lg">
              <p className="text-white/60 text-sm leading-relaxed">
                After sending payment, DM <span className="text-white font-semibold">@murdermittenmedia</span> on Instagram with your receipt and the content you want posted.
              </p>
              <a
                href="https://www.instagram.com/murdermittenmedia/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-xs font-semibold uppercase tracking-widest transition-all duration-200"
              >
                DM @murdermittenmedia →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/manus-storage/mmm_logo_8689da6b.png" alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs text-center">
            © 2022-{new Date().getFullYear()} Murder Mitten Media ™ · The Mitten
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href="/" className="hover:text-red-500 transition-colors">Home</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
