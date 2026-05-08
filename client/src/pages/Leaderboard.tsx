/* ============================================================
   MURDER MITTEN MEDIA — Leaderboard Page
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { trpc } from "@/lib/trpc";
import { Trophy, Flame, Trash2, Swords, Mic } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { ArtistLink } from "@/components/ArtistLink";

const RANK_COLORS = [
  "text-yellow-400", // 1st
  "text-slate-300",  // 2nd
  "text-amber-600",  // 3rd
];

function getRankBadge(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function Leaderboard() {
  const { data: entries, isLoading } = trpc.leaderboard.combined.useQuery();

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-16 z-10 backdrop-blur-sm">
        <div className="container py-4">
          <h1 className="font-['Anton'] text-2xl tracking-wider">
            LEADERBOARD <span className="text-red-600">ALL-TIME</span>
          </h1>
          <p className="text-white/40 text-xs uppercase tracking-widest mt-0.5">
            Battle W/L · Fire &amp; Trash Ratings · Combined Score
          </p>
        </div>
      </div>

      <div className="container py-6 max-w-4xl">
        {/* Score legend */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 border border-white/10 bg-white/[0.02]">
          <div className="text-xs text-white/50">
            <span className="text-white font-semibold">Score formula:</span>{" "}
            Win ×10 + 🔥 ×2 − 🗑️ ×1
          </div>
          <div className="flex items-center gap-4 text-xs text-white/40 ml-auto">
            <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-red-500" /> Battles</span>
            <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-blue-400" /> Reviews</span>
            <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Fire</span>
            <span className="flex items-center gap-1"><Trash2 className="w-3 h-3 text-white/40" /> Trash</span>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {!isLoading && (!entries || entries.length === 0) && (
          <div className="text-center py-20 text-white/40">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-['Anton'] tracking-wider">No data yet</p>
            <p className="text-sm mt-1">Leaderboard will populate after battles and reviews</p>
          </div>
        )}

        {entries && entries.length > 0 && (
          <div className="space-y-1">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem_5rem_5rem] gap-3 px-4 py-2 text-xs text-white/30 uppercase tracking-widest border-b border-white/10">
              <span>Rank</span>
              <span>Artist</span>
              <span className="text-center">Score</span>
              <span className="text-center">W</span>
              <span className="text-center">L</span>
              <span className="text-center">Battles</span>
              <span className="text-center">🔥</span>
              <span className="text-center">🗑️</span>
            </div>

            {entries.map((entry, index) => {
              const rank = index + 1;
              const rankColor = RANK_COLORS[index] ?? "text-white/50";
              const isTop3 = rank <= 3;
              const winRate = entry.totalBattles > 0
                ? Math.round((entry.wins / entry.totalBattles) * 100)
                : null;

              return (
                <div
                  key={entry.artistName}
                  className={`border transition-all duration-200 ${
                    isTop3
                      ? "border-red-600/30 bg-red-950/20 hover:bg-red-950/30"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Mobile layout */}
                  <div className="md:hidden p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`font-['Anton'] text-xl w-10 text-center ${rankColor}`}>
                        {getRankBadge(rank)}
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-white"><ArtistLink artistName={entry.artistName} userId={entry.userId} /></div>
                        {winRate !== null && (
                          <div className="text-xs text-white/40">{winRate}% win rate</div>
                        )}
                      </div>
                      <div className={`font-['Anton'] text-2xl ${isTop3 ? "text-red-500" : "text-white/70"}`}>
                        {entry.score}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-white/50 pl-13">
                      <span className="text-green-400 font-semibold">{entry.wins}W</span>
                      <span className="text-red-400 font-semibold">{entry.losses}L</span>
                      <span className="flex items-center gap-1"><Swords className="w-3 h-3" />{entry.totalBattles}</span>
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{entry.totalFire}</span>
                      <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" />{entry.totalTrash}</span>
                      {entry.totalReviews > 0 && (
                        <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-blue-400" />{entry.totalReviews}</span>
                      )}
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem_5rem_5rem] gap-3 px-4 py-3 items-center">
                    <span className={`font-['Anton'] text-lg text-center ${rankColor}`}>
                      {getRankBadge(rank)}
                    </span>
                    <div>
                      <div className="font-semibold text-white"><ArtistLink artistName={entry.artistName} userId={entry.userId} /></div>
                      {winRate !== null && (
                        <div className="text-xs text-white/30">{winRate}% win rate · {entry.totalReviews} review{entry.totalReviews !== 1 ? "s" : ""}</div>
                      )}
                    </div>
                    <div className={`font-['Anton'] text-xl text-center ${isTop3 ? "text-red-500" : "text-white/70"}`}>
                      {entry.score}
                    </div>
                    <div className="text-center text-green-400 font-semibold">{entry.wins}</div>
                    <div className="text-center text-red-400 font-semibold">{entry.losses}</div>
                    <div className="text-center text-white/50">{entry.totalBattles}</div>
                    <div className="text-center text-orange-400 font-semibold">{entry.totalFire}</div>
                    <div className="text-center text-white/40">{entry.totalTrash}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
