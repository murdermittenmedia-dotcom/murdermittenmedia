import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { SiteNav } from "@/components/SiteNav";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function OrderConfirmation() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // Get sessionId from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) {
      setSessionId(sid);
    }
  }, []);

  // Fetch order status
  const orderQuery = trpc.merch.checkout.getStatus.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId, refetchInterval: 2000 }
  );

  useEffect(() => {
    if (orderQuery.data) {
      if (orderQuery.data.status === "completed") {
        setStatus("success");
      } else if (orderQuery.data.status === "failed" || orderQuery.data.status === "cancelled") {
        setStatus("error");
      }
    }
  }, [orderQuery.data]);

  const order = orderQuery.data;
  const items = order?.items ? JSON.parse(order.items as string) : [];

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <section className="py-24 pt-32">
        <div className="container max-w-2xl">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <Loader2 className="w-16 h-16 text-red-600 animate-spin" />
              <p className="text-lg text-white/70">Processing your order...</p>
            </div>
          )}

          {status === "success" && order && (
            <div className="space-y-8">
              {/* Success Header */}
              <div className="flex flex-col items-center text-center space-y-4 mb-8">
                <CheckCircle className="w-20 h-20 text-green-500" />
                <h1 className="font-['Anton'] text-4xl uppercase">Order Confirmed</h1>
                <p className="text-white/60">Thank you for your purchase!</p>
              </div>

              {/* Order Details */}
              <div className="border border-white/20 rounded-lg p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Order Number</p>
                    <p className="text-lg font-bold">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Order Date</p>
                    <p className="text-lg font-bold">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="border-t border-white/20 pt-6">
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-4">Order Items</p>
                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center pb-3 border-b border-white/10 last:border-0">
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="text-sm text-white/60">{item.color} / {item.size} × {item.quantity}</p>
                        </div>
                        <p className="font-bold">${((item.price * item.quantity) / 100).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-white/20 pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Subtotal:</span>
                    <span>${(order.subtotalCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Shipping:</span>
                    <span className={order.shippingCents === 0 ? "text-green-500 font-bold" : ""}>
                      {order.shippingCents === 0 ? "FREE" : `$${(order.shippingCents / 100).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 mt-2">
                    <span>Total:</span>
                    <span className="text-red-600">${(order.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="border-t border-white/20 pt-6">
                  <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Shipping Address</p>
                  <div className="text-sm text-white/70 space-y-1">
                    {order.shippingAddress && (() => {
                      try {
                        const addr = JSON.parse(order.shippingAddress as string);
                        return (
                          <>
                            <p className="font-semibold">{addr.name}</p>
                            <p>{addr.address}</p>
                            <p>{addr.city}, {addr.state} {addr.zip}</p>
                            <p>{addr.country}</p>
                          </>
                        );
                      } catch {
                        return                   <p className="text-white/50">Shipping address will be confirmed during checkout</p>;
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-white/5 border border-white/20 rounded-lg p-6 space-y-4">
                <h3 className="font-bold uppercase tracking-widest">What's Next?</h3>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex gap-3">
                    <span className="text-red-600 font-bold">✓</span>
                    <span>                    A confirmation email has been sent to <strong>{user?.email || "your email"}</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-600 font-bold">✓</span>
                    <span>Your order will be processed and shipped within 5-7 business days</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-red-600 font-bold">✓</span>
                    <span>You'll receive a tracking number via email once your order ships</span>
                  </li>
                </ul>
              </div>

              {/* Golden Wheel CTA */}
              <div
                className="border-2 border-yellow-500/60 bg-gradient-to-r from-yellow-950/60 to-black/60 rounded-xl p-6 text-center space-y-3"
                style={{ boxShadow: "0 0 30px rgba(255,215,0,0.15)" }}
              >
                <div className="text-3xl">🎡</div>
                <h3 className="font-['Anton'] text-xl uppercase text-yellow-400">Spin the Golden Wheel</h3>
                <p className="text-white/60 text-sm">
                  As a first-time buyer, you've unlocked an exclusive spin for prizes — discount codes, free merch, and more.
                </p>
                <button
                  onClick={() => setLocation("/golden-wheel")}
                  className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold uppercase tracking-widest px-8 py-3 hover:from-yellow-500 hover:to-yellow-300 transition-all"
                  style={{ boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}
                >
                  Claim Your Spin →
                </button>
              </div>

              {/* CTA */}
              <div className="flex gap-4">
                <button
                  onClick={() => setLocation("/merch")}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 font-bold uppercase tracking-widest transition-all"
                >
                  Continue Shopping
                </button>
                <button
                  onClick={() => setLocation("/")}
                  className="flex-1 border border-white/30 hover:border-white/60 text-white py-3 font-bold uppercase tracking-widest transition-all"
                >
                  Back Home
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-8">
              <div className="flex flex-col items-center text-center space-y-4 mb-8">
                <AlertCircle className="w-20 h-20 text-red-600" />
                <h1 className="font-['Anton'] text-4xl uppercase">Order Failed</h1>
                <p className="text-white/60">There was an issue processing your order.</p>
              </div>

              <div className="border border-red-600/30 bg-red-600/10 rounded-lg p-6 text-center">
                <p className="text-white/70 mb-6">
                  Please check your email for details or contact support if you have questions.
                </p>
                <button
                  onClick={() => setLocation("/merch")}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-bold uppercase tracking-widest transition-all"
                >
                  Return to Store
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
