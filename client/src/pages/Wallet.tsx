/* ============================================================
   MURDER MITTEN MEDIA — Wallet Page
   Coins = spend on gifts/tips only (no cashout)
   Live Rewards = cashout (earned from gifts/tips received)
   Fire Votes = convert to Coins
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Coins, Wallet, ArrowRightLeft, History,
  DollarSign, Flame, ShoppingCart, TrendingUp,
  CheckCircle2, Clock, XCircle, AlertCircle, Gift, Info
} from "lucide-react";

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatCoins(n: number) {
  return n.toLocaleString();
}

const statusIcon = (status: string) => {
  if (status === "approved" || status === "paid") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === "rejected") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "held") return <AlertCircle className="w-4 h-4 text-yellow-400" />;
  return <Clock className="w-4 h-4 text-white/40" />;
};

export default function WalletPage() {
  const { loading, isAuthenticated } = useAuth();

  // Live Rewards cashout form state
  const [lrMethod, setLrMethod] = useState<"cashapp" | "paypal" | "applepay">("cashapp");
  const [lrHandle, setLrHandle] = useState("");

  // FV conversion form state
  const [fvAmount, setFvAmount] = useState("");

  // Queries
  const { data: coinBalance, refetch: refetchCoins } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: lrWallet, refetch: refetchLR } = trpc.economy.getCreatorWallet.useQuery(undefined, { enabled: isAuthenticated });
  const { data: fvBalance, refetch: refetchFV } = trpc.economy.getFireVoteBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: lrCashouts } = trpc.economy.getCreatorCashoutHistory.useQuery(undefined, { enabled: isAuthenticated });
  const { data: econConfig } = trpc.economy.getConfig.useQuery();

  // Mutations
  const requestLRCashout = trpc.economy.requestCreatorCashout.useMutation({
    onSuccess: () => {
      toast.success("Live Rewards cashout submitted! We'll process it within 24-48 hours.");
      setLrHandle("");
      refetchLR();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const convertFV = trpc.economy.convertFireVotes.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${data.fireVotesUsed ?? 0} Fire Votes converted to ${data.coinsAwarded ?? 0} Coins!`);
      setFvAmount("");
      refetchFV(); refetchCoins();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading wallet...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <Card className="bg-white/5 border-white/10 max-w-sm w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center">
            <Wallet className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-white/50 text-sm mb-6">You need to be signed in to view your wallet.</p>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full bg-red-600 hover:bg-red-700">Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coins = coinBalance?.balance ?? 0;
  const lrAvailable = lrWallet?.available ?? 0;
  const lrPending = lrWallet?.pending ?? 0;
  const fvBal = fvBalance?.balance ?? 0;
  const fvRate = econConfig?.fireVotesPerConversion ?? 50;
  const coinRate = econConfig?.coinsPerConversion ?? 10;
  const minLRCashout = econConfig?.minCashoutCents ?? 500;

  const lrUSD = formatUSD(lrAvailable);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 backdrop-blur sticky top-0 z-10">
        <div className="container flex items-center gap-3 h-14">
          <Wallet className="w-5 h-5 text-red-500" />
          <h1 className="font-bold text-white">My Wallet</h1>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Coins */}
          <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/10 border-yellow-600/30">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">Coins</span>
              </div>
              <div className="text-3xl font-bold text-white">{formatCoins(coins)}</div>
              <div className="text-white/30 text-xs mt-1 flex items-center gap-1">
                <Gift className="w-3 h-3" /> Use to send gifts &amp; tips
              </div>
            </CardContent>
          </Card>

          {/* Live Rewards */}
          <Card className="bg-gradient-to-br from-green-900/30 to-green-800/10 border-green-600/30">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">Live Rewards</span>
              </div>
              <div className="text-3xl font-bold text-white">{lrUSD}</div>
              {lrPending > 0 && <div className="text-yellow-400/70 text-xs mt-1">{formatUSD(lrPending)} pending review</div>}
              <div className="text-white/30 text-xs mt-0.5">Earned from stream gifts &amp; tips</div>
            </CardContent>
          </Card>

          {/* Fire Votes */}
          <Card className="bg-gradient-to-br from-orange-900/30 to-orange-800/10 border-orange-600/30">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 text-xs font-semibold uppercase tracking-widest">Fire Votes</span>
              </div>
              <div className="text-3xl font-bold text-white">{formatCoins(fvBal)}</div>
              <div className="text-white/30 text-xs mt-1">{fvRate} FV = {coinRate} Coins</div>
              <div className="text-white/30 text-xs mt-0.5">Convert below</div>
            </CardContent>
          </Card>
        </div>

        {/* Coins info banner */}
        <div className="bg-yellow-900/20 border border-yellow-600/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 text-sm font-semibold">Coins are for sending gifts &amp; tips</p>
            <p className="text-white/50 text-xs mt-0.5">
              Coins cannot be cashed out. Use them to send gifts during Cook Up streams or tip artists on Live Music Review.
              When you receive gifts or tips as a creator, those earnings go to your Live Rewards balance — which you can cash out below.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="cashout-lr">
          <TabsList className="bg-white/5 border border-white/10 mb-6 w-full grid grid-cols-3">
            <TabsTrigger value="cashout-lr" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <DollarSign className="w-3 h-3 mr-1" />Cash Out Live Rewards
            </TabsTrigger>
            <TabsTrigger value="convert" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <ArrowRightLeft className="w-3 h-3 mr-1" />Convert Fire Votes
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-white/20 data-[state=active]:text-white">
              <History className="w-3 h-3 mr-1" />History
            </TabsTrigger>
          </TabsList>

          {/* ── Live Rewards Cashout ── */}
          <TabsContent value="cashout-lr">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Cash Out Live Rewards
                </CardTitle>
                <p className="text-white/50 text-sm">Minimum {formatUSD(minLRCashout)} · Earned from gifts &amp; tips during streams</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-900/20 border border-green-600/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Available to Cash Out</span>
                    <span className="text-green-400 font-bold text-lg">{lrUSD}</span>
                  </div>
                  {lrPending > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-white/40 text-xs">Pending Review</span>
                      <span className="text-yellow-400/70 text-xs">{formatUSD(lrPending)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Payment Method</Label>
                  <Select value={lrMethod} onValueChange={(v: any) => setLrMethod(v)}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashapp">CashApp ($MittenMedia)</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="applepay">Apple Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-white/70 text-sm">
                    {lrMethod === "cashapp" ? "Your CashApp $Tag" : lrMethod === "paypal" ? "Your PayPal Email" : "Your Apple Pay Phone"}
                  </Label>
                  <Input
                    value={lrHandle}
                    onChange={(e) => setLrHandle(e.target.value)}
                    placeholder={lrMethod === "cashapp" ? "$yourtag" : lrMethod === "paypal" ? "you@email.com" : "phone number"}
                    className="bg-white/5 border-white/20 text-white mt-1"
                  />
                </div>
                <Button
                  onClick={() => requestLRCashout.mutate({ amountCents: lrAvailable, paymentMethod: lrMethod as any, paymentHandle: lrHandle })}
                  disabled={lrAvailable < minLRCashout || !lrHandle || requestLRCashout.isPending}
                  className="w-full bg-green-700 hover:bg-green-800 text-white"
                >
                  {requestLRCashout.isPending ? "Submitting..." : `Request Cashout · ${lrUSD}`}
                </Button>
                {lrAvailable < minLRCashout && (
                  <p className="text-white/40 text-xs text-center">
                    Minimum cashout is {formatUSD(minLRCashout)}. Keep earning from stream gifts and tips!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Convert Fire Votes ── */}
          <TabsContent value="convert">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-orange-400" />
                  Convert Fire Votes → Coins
                </CardTitle>
                <p className="text-white/50 text-sm">Rate: {fvRate} Fire Votes = {coinRate} Coins · Use coins to send gifts &amp; tips</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-orange-900/20 border border-orange-600/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Fire Vote Balance</span>
                    <span className="text-orange-400 font-bold text-lg">{formatCoins(fvBal)} FV</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-white/40 text-xs">Max convertible</span>
                    <span className="text-white/40 text-xs">{Math.floor(fvBal / fvRate) * fvRate} FV → {Math.floor(fvBal / fvRate) * coinRate} Coins</span>
                  </div>
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Fire Votes to Convert (multiples of {fvRate})</Label>
                  <Input
                    type="number"
                    min={fvRate}
                    step={fvRate}
                    max={Math.floor(fvBal / fvRate) * fvRate}
                    value={fvAmount}
                    onChange={(e) => setFvAmount(e.target.value)}
                    placeholder={`Min ${fvRate} FV`}
                    className="bg-white/5 border-white/20 text-white mt-1"
                  />
                  {fvAmount && Number(fvAmount) >= fvRate && (
                    <p className="text-orange-400 text-xs mt-1">
                      = {Math.floor(Number(fvAmount) / fvRate) * coinRate} Coins
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => convertFV.mutate({ batches: Math.floor(Number(fvAmount) / fvRate) })}
                  disabled={!fvAmount || Number(fvAmount) < fvRate || Number(fvAmount) > fvBal || convertFV.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {convertFV.isPending ? "Converting..." : "Convert Fire Votes"}
                </Button>
                {fvBal < fvRate && (
                  <p className="text-white/40 text-xs text-center">
                    You need at least {fvRate} Fire Votes to convert. Earn them by voting in Music Review and Music Wars!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History ── */}
          <TabsContent value="history">
            <div className="space-y-6">
              {/* Live Rewards Cashout History */}
              <div>
                <h3 className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" /> Live Rewards Cashout History
                </h3>
                {!lrCashouts || lrCashouts.length === 0 ? (
                  <p className="text-white/30 text-sm">No Live Rewards cashout requests yet.</p>
                ) : (
                  <div className="space-y-2">
                    {lrCashouts.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          {statusIcon(r.status)}
                          <div>
                            <div className="text-white text-sm font-medium">{formatUSD(r.amountCents)}</div>
                            <div className="text-white/40 text-xs">{r.paymentMethod} · {r.paymentHandle}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`text-xs ${r.status === 'paid' ? 'border-green-500 text-green-400' : r.status === 'rejected' ? 'border-red-500 text-red-400' : r.status === 'held' ? 'border-yellow-500 text-yellow-400' : 'border-white/20 text-white/40'}`}>
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/coins">
            <Button variant="outline" size="sm" className="border-white/20 text-white/60 hover:text-white">
              <ShoppingCart className="w-4 h-4 mr-2" /> Buy Coins
            </Button>
          </Link>
          <Link href="/fire-vote-wallet">
            <Button variant="outline" size="sm" className="border-white/20 text-white/60 hover:text-white">
              <Flame className="w-4 h-4 mr-2" /> Fire Vote Wallet
            </Button>
          </Link>
          <Link href="/stream-history">
            <Button variant="outline" size="sm" className="border-white/20 text-white/60 hover:text-white">
              <TrendingUp className="w-4 h-4 mr-2" /> Stream History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
