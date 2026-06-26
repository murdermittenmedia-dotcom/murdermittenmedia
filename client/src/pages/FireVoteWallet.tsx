import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Coins, ArrowRight, History, Info, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-orange-400",
  mythic: "text-red-500",
};

export default function FireVoteWallet() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [batches, setBatches] = useState(1);

  const { data: fvBalance, refetch: refetchFV } = trpc.economy.getFireVoteBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: config } = trpc.economy.getConfig.useQuery();
  const { data: coinBalance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: history } = trpc.economy.getWalletHistory.useQuery({ currency: "fire_votes", limit: 20 }, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const convertMutation = trpc.economy.convertFireVotes.useMutation({
    onSuccess: (data) => {
      toast.success(`Converted! +${data.coinsAwarded} coins added to your wallet`);
      refetchFV();
      utils.coins.getBalance.invalidate();
      utils.economy.getWalletHistory.invalidate();
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
        <Flame className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <p className="text-white/60 mb-4">Sign in to view your Fire Vote wallet</p>
        <a href={getLoginUrl()} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold">Sign In</a>
      </div>
    </div>
  );

  const fvBal = fvBalance?.balance ?? 0;
  const fvPerBatch = config?.fireVotesPerConversion ?? 50;
  const coinsPerBatch = config?.coinsPerConversion ?? 10;
  const maxBatches = Math.floor(fvBal / fvPerBatch);
  const fvNeeded = fvPerBatch * batches;
  const coinsToGet = coinsPerBatch * batches;
  const canConvert = config?.fireVoteConversionEnabled && fvBal >= fvNeeded;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-1">
            <Flame className="w-7 h-7 text-orange-500" />
            <h1 className="font-['Anton'] text-3xl tracking-wider">FIRE VOTE WALLET</h1>
          </div>
          <p className="text-white/50 text-sm">Earn Fire Votes by voting in Music Wars — convert them to Coins</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#111] border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2 text-orange-400">
                <Flame className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest font-semibold">Fire Votes</span>
              </div>
              <div className="text-4xl font-['Anton'] text-orange-400">{fvBal.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-1">Lifetime earned: {(fvBalance?.lifetimeEarned ?? 0).toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#111] border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2 text-yellow-400">
                <span className="text-lg">🪙</span>
                <span className="text-xs uppercase tracking-widest font-semibold">Coins</span>
              </div>
              <div className="text-4xl font-['Anton'] text-yellow-400">{(coinBalance?.balance ?? 0).toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-1">
                <Link href="/coins" className="text-yellow-500 hover:underline">Buy more coins →</Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2 text-white/60">
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest font-semibold">Converted</span>
              </div>
              <div className="text-4xl font-['Anton'] text-white/80">{(fvBalance?.lifetimeConverted ?? 0).toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-1">Fire Votes converted to coins</div>
            </CardContent>
          </Card>
        </div>

        {/* Conversion panel */}
        <Card className="bg-[#111] border-orange-500/20 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <ArrowRight className="w-5 h-5" />
              Convert Fire Votes to Coins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!config?.fireVoteConversionEnabled ? (
              <div className="flex items-center gap-2 text-white/50 py-4">
                <Info className="w-4 h-4" />
                <span>Fire Vote conversion is currently disabled by admin.</span>
              </div>
            ) : (
              <>
                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white/60">Conversion rate</span>
                    <span className="text-orange-400 font-semibold">{fvPerBatch} Fire Votes = {coinsPerBatch} Coins</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Daily coin cap</span>
                    <span className="text-white/80">{config?.fvDailyCoinCap ?? 100} coins/day</span>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm text-white/60 mb-3 block">Number of conversions</label>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setBatches(Math.max(1, batches - 1))} disabled={batches <= 1} className="border-white/20 text-white">−</Button>
                    <span className="text-2xl font-['Anton'] w-12 text-center">{batches}</span>
                    <Button variant="outline" size="sm" onClick={() => setBatches(Math.min(maxBatches || 1, batches + 1))} disabled={batches >= maxBatches} className="border-white/20 text-white">+</Button>
                    <Button variant="ghost" size="sm" onClick={() => setBatches(maxBatches || 1)} disabled={maxBatches === 0} className="text-orange-400 hover:text-orange-300 text-xs">Max</Button>
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-400" />
                      <span className="text-orange-300 font-semibold">{fvNeeded.toLocaleString()} Fire Votes</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40" />
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🪙</span>
                      <span className="text-yellow-300 font-semibold">{coinsToGet.toLocaleString()} Coins</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => convertMutation.mutate({ batches })}
                  disabled={!canConvert || convertMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  {convertMutation.isPending ? "Converting..." : `Convert ${fvNeeded} Fire Votes → ${coinsToGet} Coins`}
                </Button>

                {fvBal < fvNeeded && (
                  <p className="text-white/40 text-xs text-center mt-2">
                    You need {fvNeeded - fvBal} more Fire Votes. Vote in <Link href="/music-wars" className="text-orange-400 hover:underline">Music Wars</Link> to earn more.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* How to earn */}
        <Card className="bg-[#111] border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-white/80 text-base">How to Earn Fire Votes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: "🔥", title: "Vote in Music Wars", desc: "Cast a Fire vote on any battle to earn Fire Votes" },
                { icon: "🎵", title: "Daily Voting", desc: "Vote consistently every day for bonus multipliers" },
                { icon: "🏆", title: "Judge Battles", desc: "Become a certified judge to earn bonus Fire Votes" },
              ].map((item) => (
                <div key={item.title} className="bg-[#1a1a1a] rounded-lg p-4">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-semibold text-sm mb-1">{item.title}</div>
                  <div className="text-white/50 text-xs">{item.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction history */}
        {history && history.length > 0 && (
          <Card className="bg-[#111] border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white/80 text-base">
                <History className="w-4 h-4" />
                Recent Activity
              </CardTitle>
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
                    <div className={`font-semibold ${tx.amount > 0 ? "text-orange-400" : "text-white/50"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} 🔥
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
