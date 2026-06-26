/* ============================================================
   MURDER MITTEN MEDIA — Stream History
   Shows all past stream summaries for the creator
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Coins, Gift, Heart, Flame, Eye, Users, Clock,
  ChevronDown, ChevronUp, Radio, DollarSign
} from "lucide-react";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(ts: Date | string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function parseJSON(s: string | null | undefined, fallback: any = []) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function SummaryCard({ summary, defaultOpen = false }: { summary: any; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const giftBreakdown = parseJSON(summary.giftBreakdown, []);
  const topGifters = parseJSON(summary.topGifters, []);
  const engagement = parseJSON(summary.engagementSummary, {});

  return (
    <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500" />
              {summary.streamTitle || "Live Stream"}
            </CardTitle>
            <p className="text-white/40 text-xs mt-1">{formatDate(summary.createdAt)}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(v => !v)}
            className="text-white/40 hover:text-white shrink-0"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
          {[
            { icon: Clock, label: "Duration", value: formatDuration(summary.durationSeconds ?? 0), color: "text-white/70" },
            { icon: Eye, label: "Views", value: (summary.totalViews ?? 0).toLocaleString(), color: "text-blue-400" },
            { icon: Users, label: "Peak", value: (summary.peakViewers ?? 0).toLocaleString(), color: "text-purple-400" },
            { icon: Gift, label: "Gifts", value: (summary.totalGifts ?? 0).toLocaleString(), color: "text-yellow-400" },
            { icon: Coins, label: "Coins", value: (summary.totalCoinsGifted ?? 0).toLocaleString(), color: "text-yellow-400" },
            { icon: DollarSign, label: "Earned", value: `$${((summary.totalLiveRewards ?? 0) / 100).toFixed(2)}`, color: "text-green-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-lg p-2 text-center">
              <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
              <div className={`text-sm font-bold ${color}`}>{value}</div>
              <div className="text-white/30 text-[10px]">{label}</div>
            </div>
          ))}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-4">
          {/* Additional stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="text-white/50 text-xs">Total Likes</span>
              </div>
              <div className="text-white font-bold">{(summary.totalLikes ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white/50 text-xs">Fire Votes</span>
              </div>
              <div className="text-white font-bold">{(summary.totalFireVotes ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-white/50 text-xs">Avg Viewers</span>
              </div>
              <div className="text-white font-bold">{(summary.avgViewers ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-white/50 text-xs">New Followers</span>
              </div>
              <div className="text-white font-bold">{(summary.newFollowers ?? 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Top Gifters */}
          {topGifters.length > 0 && (
            <div>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Top Gifters</h4>
              <div className="space-y-1.5">
                {topGifters.slice(0, 5).map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs w-4">#{i + 1}</span>
                      <span className="text-white text-sm">{g.name || `User ${g.userId}`}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      <span>{g.giftCount} gifts</span>
                      <span className="text-yellow-400 font-medium">{g.coins} coins</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gift Breakdown */}
          {giftBreakdown.length > 0 && (
            <div>
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">Gift Breakdown</h4>
              <div className="flex flex-wrap gap-2">
                {giftBreakdown.slice(0, 8).map((g: any, i: number) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs">
                    <span className="text-white/70">{g.giftName}</span>
                    <span className="text-white/40 mx-1">×</span>
                    <span className="text-yellow-400 font-medium">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function StreamHistory() {
  const { user, loading, isAuthenticated } = useAuth();
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  const { data: summaries, isLoading } = trpc.stream.getHistory.useQuery(
    { limit: LIMIT, offset },
    { enabled: isAuthenticated }
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading stream history...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Sign in to view your stream history.</p>
          <a href={getLoginUrl()}>
            <Button className="bg-red-600 hover:bg-red-700">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="border-b border-white/10 bg-[#080808]/90 backdrop-blur sticky top-0 z-10">
        <div className="container flex items-center gap-3 h-14">
          <TrendingUp className="w-5 h-5 text-red-500" />
          <h1 className="font-bold text-white">Stream History</h1>
        </div>
      </div>

      <div className="container py-8 max-w-3xl">
        {!summaries || summaries.length === 0 ? (
          <div className="text-center py-16">
            <Radio className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 text-sm">No stream history yet.</p>
            <p className="text-white/30 text-xs mt-1">Your post-stream summaries will appear here after you go live.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((s: any, i: number) => (
              <SummaryCard key={s.id} summary={s} defaultOpen={i === 0 && offset === 0} />
            ))}

            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="border-white/20 text-white/60 hover:text-white"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + LIMIT)}
                disabled={summaries.length < LIMIT}
                className="border-white/20 text-white/60 hover:text-white"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
