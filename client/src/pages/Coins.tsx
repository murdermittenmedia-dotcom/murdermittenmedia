/* ============================================================
   MURDER MITTEN MEDIA — Buy Coins
   Coin packages → manual payment request → admin approves
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Coins as CoinsIcon, Check, Clock, ChevronRight } from "lucide-react";

// Purchase: 100 coins = $1.00 (1¢/coin)
// Cashout payout: 100 coins = $0.70 (platform retains 30%)
const COIN_PACKAGES = [
  { coins: 100,   usdCents: 100,  label: "Starter Pack",  popular: false },
  { coins: 500,   usdCents: 450,  label: "Fan Pack",      popular: true  },
  { coins: 1200,  usdCents: 1000, label: "Supporter",     popular: false },
  { coins: 3000,  usdCents: 2400, label: "VIP",           popular: false },
];

// Cashout rate: 100 coins = $0.70 (30% platform fee)
export const COINS_PER_DOLLAR_CASHOUT = 143; // 143 coins = $1 payout (1/0.007)

export default function CoinsPage() {
  const { user, isAuthenticated } = useAuth();
  const [selected, setSelected] = useState<typeof COIN_PACKAGES[0] | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: balance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated, select: () => [] });

  const requestMutation = trpc.coins.requestPurchase.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Purchase request sent! We'll add your coins after payment is confirmed.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CoinsIcon className="w-12 h-12 text-yellow-400/30 mb-4" />
          <h2 className="text-white/50 text-xl font-semibold mb-2">Sign In to Buy Coins</h2>
          <p className="text-white/30 text-sm mb-6">You need an account to purchase coins and send gifts on live streams.</p>
          <a href={getLoginUrl("/coins")}>
            <Button className="bg-red-600 hover:bg-red-700 text-white">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <div className="container py-10 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
            <CoinsIcon className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="font-['Anton'] text-2xl tracking-wider">BUY COINS</h1>
            <p className="text-white/40 text-xs uppercase tracking-widest">Use coins to send gifts on live streams</p>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
            <CoinsIcon className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-lg">{balance?.balance ?? 0}</span>
            <span className="text-white/30 text-sm">coins</span>
          </div>
        </div>

        {submitted ? (
          <div className="border border-green-600/40 bg-green-600/10 rounded-xl p-8 text-center">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-white font-semibold text-xl mb-2">Request Sent!</h2>
            <p className="text-white/50 text-sm max-w-sm mx-auto mb-4">
              Your coin purchase request for <strong className="text-white">{selected?.coins.toLocaleString()} coins (${((selected?.usdCents ?? 0) / 100).toFixed(2)})</strong> has been submitted.
            </p>
            <p className="text-white/30 text-xs mb-6">
              Send your payment via CashApp or PayPal to <strong className="text-white">@MurderMittenMedia</strong> with the note: <strong className="text-yellow-400">{paymentNote || `Coins - ${user?.name}`}</strong>
            </p>
            <p className="text-white/30 text-xs">Coins will be added to your account within 24 hours after payment is confirmed.</p>
            <Button
              onClick={() => { setSubmitted(false); setSelected(null); setPaymentNote(""); }}
              variant="outline"
              className="mt-6 border-white/20 text-white/60 hover:text-white"
            >
              Buy More Coins
            </Button>
          </div>
        ) : selected ? (
          /* ── Payment step ── */
          <div className="border border-white/10 bg-white/[0.03] rounded-xl p-6">
            <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-sm mb-4 flex items-center gap-1">
              ← Back to packages
            </button>
            <h2 className="font-['Anton'] text-xl mb-1">COMPLETE YOUR PURCHASE</h2>
            <p className="text-white/40 text-sm mb-6">
              You selected <strong className="text-yellow-400">{selected.coins.toLocaleString()} coins</strong> for <strong className="text-white">${(selected.usdCents / 100).toFixed(2)}</strong>
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <p className="text-white/60 text-sm font-semibold mb-2">How to pay:</p>
              <ol className="text-white/40 text-sm space-y-1.5 list-decimal list-inside">
                <li>Send <strong className="text-white">${(selected.usdCents / 100).toFixed(2)}</strong> via CashApp or PayPal</li>
                <li>Use the tag <strong className="text-yellow-400">@MurderMittenMedia</strong></li>
                <li>Include your username in the payment note</li>
                <li>Click "Submit Request" below</li>
              </ol>
            </div>

            <div className="mb-4">
              <label className="text-white/50 text-xs uppercase tracking-widest block mb-1.5">Your payment note (so we can match it)</label>
              <Input
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder={`e.g. Coins - ${user?.artistName || user?.name}`}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/20"
              />
            </div>

            <Button
              onClick={() => requestMutation.mutate({ coins: selected.coins, amountCents: selected.usdCents, paymentNote: paymentNote || `Coins - ${user?.name}` })}
              disabled={requestMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {requestMutation.isPending ? "Submitting..." : `Submit Request — ${selected.coins.toLocaleString()} coins`}
            </Button>
            <p className="text-white/20 text-xs text-center mt-3">Coins are added manually after payment is verified. Usually within a few hours.</p>
          </div>
        ) : (
          /* ── Package selection ── */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {COIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.coins}
                  onClick={() => setSelected(pkg)}
                  className={`relative text-left border rounded-xl p-5 transition-all hover:border-red-600/50 hover:bg-white/[0.06] group
                    ${pkg.popular ? "border-yellow-400/40 bg-yellow-400/5" : "border-white/10 bg-white/[0.03]"}`}
                >
                  {pkg.popular && (
                    <span className="absolute top-3 right-3 text-xs bg-yellow-400 text-black font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <CoinsIcon className="w-5 h-5 text-yellow-400" />
                    <span className="font-['Anton'] text-2xl text-yellow-400">{pkg.coins.toLocaleString()}</span>
                    <span className="text-white/40 text-sm">coins</span>
                  </div>
                  <div className="text-white font-semibold text-lg mb-0.5">${(pkg.usdCents / 100).toFixed(2)}</div>
                  <div className="text-white/40 text-xs">{pkg.label}</div>
                  <ChevronRight className="absolute bottom-4 right-4 w-4 h-4 text-white/20 group-hover:text-red-400 transition-colors" />
                </button>
              ))}
            </div>

            <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4 text-center mb-8">
              <p className="text-white/30 text-xs">
                Payments are handled manually via CashApp / PayPal to <strong className="text-white">@MurderMittenMedia</strong>.
                Coins are added within 24 hours of payment confirmation.
              </p>
            </div>
          </>
        )}

        {/* Transaction history */}
        {history && history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white/50 text-xs uppercase tracking-widest mb-3">Coin History</h2>
            <div className="space-y-2">
              {history.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between border border-white/10 bg-white/[0.02] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    {tx.status === "pending" ? (
                      <Clock className="w-4 h-4 text-yellow-400/60" />
                    ) : (
                      <Check className="w-4 h-4 text-green-400/60" />
                    )}
                    <div>
                      <p className="text-white/70 text-sm">{tx.description || `${tx.coins > 0 ? "+" : ""}${tx.coins} coins`}</p>
                      <p className="text-white/30 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${tx.coins > 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.coins > 0 ? "+" : ""}{tx.coins}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
