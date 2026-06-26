/* ============================================================
   MURDER MITTEN MEDIA — Cashout Request Page
   Users can request to cash out their coin balance
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { DollarSign, Clock, CheckCircle, XCircle, LogIn, AlertCircle } from "lucide-react";

const PAYMENT_METHODS = [
  { id: "cashapp", label: "CashApp", placeholder: "$yourtag" },
  { id: "paypal", label: "PayPal", placeholder: "email or @username" },
  { id: "venmo", label: "Venmo", placeholder: "@yourtag" },
  { id: "zelle", label: "Zelle", placeholder: "phone or email" },
] as const;

const COIN_TO_USD = 0.007; // 100 coins = $0.70 (platform keeps 30%)

export default function Cashout() {
  const { user, isAuthenticated } = useAuth();
  const [coins, setCoins] = useState(100);
  const [paymentMethod, setPaymentMethod] = useState<"cashapp" | "paypal" | "venmo" | "zelle">("cashapp");
  const [paymentHandle, setPaymentHandle] = useState("");

  const { data: balance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history, refetch } = trpc.cashout.getMyRequests.useQuery(undefined, { enabled: isAuthenticated });

  const requestMutation = trpc.cashout.request.useMutation({
    onSuccess: () => {
      toast.success("Cashout request submitted! We'll process it within 24-48 hours.");
      refetch();
      setCoins(100);
      setPaymentHandle("");
    },
    onError: (err) => toast.error(err.message),
  });

  const coinBalance = balance?.balance ?? 0;
  const usdValue = (coins * COIN_TO_USD).toFixed(2);
  const selectedMethod = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentHandle.trim()) {
      toast.error("Please enter your payment handle");
      return;
    }
    if (coins > coinBalance) {
      toast.error("Not enough coins");
      return;
    }
    requestMutation.mutate({ coins, paymentMethod, paymentHandle: paymentHandle.trim() });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
          <DollarSign className="w-16 h-16 text-red-600/60" />
          <h1 className="font-['Anton'] text-4xl text-center">CASHOUT</h1>
          <p className="text-white/50 text-center max-w-sm">Log in to request a cashout of your coin balance</p>
          <a
            href={getLoginUrl()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-bold uppercase tracking-widest transition-all"
          >
            <LogIn className="w-4 h-4" />
            Log In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <div className="container pt-8 pb-16 max-w-2xl">
        <div className="mb-8">
          <h1 className="font-['Anton'] text-4xl tracking-wider">CASHOUT</h1>
          <p className="text-white/40 text-sm mt-1">Convert your coins to real money</p>
        </div>

        {/* Balance card */}
        <div className="bg-gradient-to-br from-red-900/30 to-red-950/20 border border-red-600/30 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-sm uppercase tracking-widest">Your Balance</p>
              <p className="font-['Anton'] text-5xl text-red-500 mt-1">{coinBalance.toLocaleString()}</p>
              <p className="text-white/30 text-sm">coins ≈ ${(coinBalance * COIN_TO_USD).toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/30 text-xs uppercase tracking-widest">Rate</p>
              <p className="text-white/60 text-sm">100 coins = $0.70</p>
              <p className="text-white/30 text-xs mt-1">Min cashout: 100 coins</p>
            </div>
          </div>
        </div>

        {/* Request form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/10 p-6 mb-8">
          <h2 className="text-white font-bold text-lg mb-6 uppercase tracking-wider">Request Cashout</h2>

          {/* Coin amount */}
          <div className="mb-5">
            <label className="text-white/60 text-sm uppercase tracking-wider block mb-2">Coins to Cash Out</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={100}
                max={coinBalance}
                step={100}
                value={coins}
                onChange={e => setCoins(Math.max(100, Math.min(coinBalance, parseInt(e.target.value) || 100)))}
                className="flex-1 bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 text-lg font-bold"
              />
              <div className="text-right">
                <p className="text-green-400 font-bold text-xl">${usdValue}</p>
                <p className="text-white/30 text-xs">USD value</p>
              </div>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2 mt-2">
              {[100, 500, 1000, 5000].filter(v => v <= coinBalance).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCoins(v)}
                  className={`text-xs px-3 py-1 border transition-all ${coins === v ? "border-red-600 text-red-400 bg-red-900/20" : "border-white/10 text-white/40 hover:border-white/30"}`}
                >
                  {v}
                </button>
              ))}
              {coinBalance >= 100 && (
                <button
                  type="button"
                  onClick={() => setCoins(coinBalance)}
                  className="text-xs px-3 py-1 border border-white/10 text-white/40 hover:border-white/30 transition-all"
                >
                  Max
                </button>
              )}
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-5">
            <label className="text-white/60 text-sm uppercase tracking-wider block mb-2">Payment Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-2.5 text-sm font-semibold border transition-all ${paymentMethod === m.id ? "border-red-600 text-white bg-red-900/20" : "border-white/10 text-white/50 hover:border-white/30"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment handle */}
          <div className="mb-6">
            <label className="text-white/60 text-sm uppercase tracking-wider block mb-2">
              Your {selectedMethod.label} Handle
            </label>
            <input
              type="text"
              value={paymentHandle}
              onChange={e => setPaymentHandle(e.target.value)}
              placeholder={selectedMethod.placeholder}
              className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20"
            />
          </div>

          <div className="flex items-start gap-3 mb-6 p-3 bg-yellow-900/20 border border-yellow-600/30">
            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-400/80 text-xs leading-relaxed">
              Cashout requests are processed manually within 24-48 hours. Make sure your payment handle is correct. Coins will be deducted once your request is approved.
            </p>
          </div>

          <button
            type="submit"
            disabled={requestMutation.isPending || coins > coinBalance || coinBalance < 100}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-white/10 disabled:text-white/30 text-white py-3 font-bold uppercase tracking-widest transition-all"
          >
            {requestMutation.isPending ? "Submitting..." : `Request $${usdValue} Cashout`}
          </button>
        </form>

        {/* History */}
        {history && history.length > 0 && (
          <div>
            <h2 className="text-white/50 text-sm uppercase tracking-widest mb-4">Cashout History</h2>
            <div className="space-y-2">
              {history.map((req: { id: number; coins: number; paymentMethod: string; paymentHandle: string; status: string; createdAt: Date }) => (
                <div key={req.id} className="flex items-center gap-4 bg-white/[0.03] border border-white/10 p-4">
                  <div className="flex-shrink-0">
                    {req.status === "approved" ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : req.status === "rejected" ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">{req.coins.toLocaleString()} coins → ${(req.coins * COIN_TO_USD).toFixed(2)}</p>
                    <p className="text-white/40 text-sm">{req.paymentMethod} · {req.paymentHandle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs uppercase tracking-wider font-semibold ${req.status === "approved" ? "text-green-400" : req.status === "rejected" ? "text-red-400" : "text-yellow-400"}`}>
                      {req.status}
                    </span>
                    <p className="text-white/30 text-xs mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
