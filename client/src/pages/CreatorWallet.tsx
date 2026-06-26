import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, History, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <CheckCircle className="w-3 h-3" /> },
  paid: { label: "Paid", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle className="w-3 h-3" /> },
  on_hold: { label: "On Hold", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelled", color: "bg-white/10 text-white/40 border-white/10", icon: <XCircle className="w-3 h-3" /> },
};

export default function CreatorWallet() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [amountDollars, setAmountDollars] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cashapp" | "paypal" | "applepay">("cashapp");
  const [paymentHandle, setPaymentHandle] = useState("");

  const { data: wallet, refetch: refetchWallet } = trpc.economy.getCreatorWallet.useQuery(undefined, { enabled: isAuthenticated });
  const { data: config } = trpc.economy.getConfig.useQuery();
  const { data: cashouts, refetch: refetchCashouts } = trpc.economy.getCreatorCashoutHistory.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history } = trpc.economy.getWalletHistory.useQuery({ currency: "live_rewards", limit: 30 }, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const cashoutMutation = trpc.economy.requestCreatorCashout.useMutation({
    onSuccess: () => {
      toast.success("Cashout request submitted! Admin will process within 24-48 hours.");
      setAmountDollars("");
      setPaymentHandle("");
      refetchWallet();
      refetchCashouts();
    },
    onError: (err) => toast.error(err.message),
  });

  if (authLoading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-center">
        <DollarSign className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <p className="text-white/60 mb-4">Sign in to access your Creator Wallet</p>
        <a href={getLoginUrl()} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold">Sign In</a>
      </div>
    </div>
  );

  const availableCents = wallet?.available ?? 0;
  const pendingCents = wallet?.pending ?? 0;
  const minCashout = config?.minCashoutCents ?? 500;
  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100);
  const canCashout = amountCents >= minCashout && amountCents <= availableCents && paymentHandle.trim().length > 0 && !wallet?.isFrozen;

  const handleCashout = () => {
    if (!canCashout) return;
    cashoutMutation.mutate({ amountCents, paymentMethod, paymentHandle: paymentHandle.trim() });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-1">
            <DollarSign className="w-7 h-7 text-green-500" />
            <h1 className="font-['Anton'] text-3xl tracking-wider">CREATOR WALLET</h1>
          </div>
          <p className="text-white/50 text-sm">Cash out your Live Rewards earned from viewer gifts during streams</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {wallet?.isFrozen && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-red-400">Wallet Frozen</div>
              <div className="text-white/60 text-sm">{wallet.frozenReason || "Contact support for assistance."}</div>
            </div>
          </div>
        )}

        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#111] border-green-500/30">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-widest text-green-400 font-semibold mb-2">Available</div>
              <div className="text-4xl font-['Anton'] text-green-400">${(availableCents / 100).toFixed(2)}</div>
              <div className="text-white/40 text-xs mt-1">Ready to cash out</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-yellow-500/20">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-semibold mb-2">Pending</div>
              <div className="text-4xl font-['Anton'] text-yellow-400">${(pendingCents / 100).toFixed(2)}</div>
              <div className="text-white/40 text-xs mt-1">Under review</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-2">Lifetime Earned</div>
              <div className="text-4xl font-['Anton'] text-white/80">${((wallet?.lifetimeEarned ?? 0) / 100).toFixed(2)}</div>
              <div className="text-white/40 text-xs mt-1">Total from gifts</div>
            </CardContent>
          </Card>
        </div>

        {/* Cashout form */}
        <Card className="bg-[#111] border-green-500/20 mb-8">
          <CardHeader>
            <CardTitle className="text-green-400">Request Cashout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-lg p-3 text-sm text-white/60">
              Minimum cashout: <span className="text-white font-semibold">${(minCashout / 100).toFixed(2)}</span> · 
              Platform split: <span className="text-white font-semibold">{100 - (config?.creatorSplitPct ?? 70)}%</span> retained ·
              Creator share: <span className="text-green-400 font-semibold">{config?.creatorSplitPct ?? 70}%</span> of gift value
            </div>

            <div>
              <Label className="text-white/70 mb-1 block">Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                <Input
                  type="number"
                  min={(minCashout / 100).toFixed(2)}
                  max={(availableCents / 100).toFixed(2)}
                  step="0.01"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  placeholder={`${(minCashout / 100).toFixed(2)} minimum`}
                  className="pl-8 bg-[#1a1a1a] border-white/20 text-white"
                />
              </div>
              <Button variant="ghost" size="sm" className="text-green-400 text-xs mt-1 p-0 h-auto" onClick={() => setAmountDollars((availableCents / 100).toFixed(2))}>
                Max: ${(availableCents / 100).toFixed(2)}
              </Button>
            </div>

            <div>
              <Label className="text-white/70 mb-1 block">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger className="bg-[#1a1a1a] border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/20">
                  {config?.cashAppEnabled !== false && <SelectItem value="cashapp">CashApp</SelectItem>}
                  {config?.paypalEnabled !== false && <SelectItem value="paypal">PayPal</SelectItem>}
                  {config?.applePayEnabled !== false && <SelectItem value="applepay">Apple Pay</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white/70 mb-1 block">
                {paymentMethod === "cashapp" ? "CashApp Tag (e.g. $MittenMedia)" : paymentMethod === "paypal" ? "PayPal Email" : "Apple Pay Phone/Email"}
              </Label>
              <Input
                value={paymentHandle}
                onChange={(e) => setPaymentHandle(e.target.value)}
                placeholder={paymentMethod === "cashapp" ? "$YourTag" : paymentMethod === "paypal" ? "you@email.com" : "Phone or email"}
                className="bg-[#1a1a1a] border-white/20 text-white"
              />
            </div>

            <Button
              onClick={handleCashout}
              disabled={!canCashout || cashoutMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {cashoutMutation.isPending ? "Submitting..." : `Request $${amountDollars || "0.00"} Cashout`}
            </Button>
          </CardContent>
        </Card>

        {/* Cashout history */}
        {cashouts && cashouts.length > 0 && (
          <Card className="bg-[#111] border-white/10 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white/80 text-base">
                <History className="w-4 h-4" />
                Cashout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cashouts.map((c) => {
                  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">${(c.amountCents / 100).toFixed(2)}</span>
                          <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}>
                            {cfg.icon}{cfg.label}
                          </Badge>
                        </div>
                        <div className="text-white/40 text-xs">{c.paymentMethod.toUpperCase()} · {c.paymentHandle}</div>
                        <div className="text-white/30 text-xs">{new Date(c.createdAt).toLocaleString()}</div>
                        {c.adminNote && <div className="text-white/50 text-xs mt-1 italic">"{c.adminNote}"</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Earnings history */}
        {history && history.length > 0 && (
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="text-white/80 text-base">Earnings History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <div className="text-sm font-medium capitalize">{tx.type.replace(/_/g, " ")}</div>
                      {tx.note && <div className="text-white/40 text-xs">{tx.note}</div>}
                      <div className="text-white/30 text-xs">{new Date(tx.createdAt).toLocaleString()}</div>
                    </div>
                    <div className={`font-semibold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}${(Math.abs(tx.amount) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
