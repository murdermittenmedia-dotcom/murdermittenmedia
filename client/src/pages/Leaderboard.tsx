/* ============================================================
   MURDER MITTEN MEDIA — Leaderboard Page
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Trophy, Flame, Trash2, Swords, Mic, Star, Heart } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { ArtistLink } from "@/components/ArtistLink";
import { UserBadges } from "@/components/UserBadges";
import { Link } from "wouter";

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

// Fan level display info
const FAN_LEVEL_INFO: Record<string, { label: string; color: string; icon: string }> = {
  supporter:           { label: "Supporter",           color: "#6B7280", icon: "👋" },
  top_supporter:       { label: "Top Supporter",       color: "#3B82F6", icon: "⭐" },
  biggest_fan:         { label: "Biggest Fan",         color: "#8B5CF6", icon: "💜" },
  early_supporter:     { label: "Early Supporter",     color: "#F59E0B", icon: "🌟" },
  verified_tastemaker: { label: "Verified Tastemaker", color: "#10B981", icon: "🎯" },
};

function getFanLevelInfo(level: string) {
  return FAN_LEVEL_INFO[level] ?? FAN_LEVEL_INFO.supporter;
}

// XP thresholds for fan levels
const FAN_XP_THRESHOLDS = [0, 100, 300, 600, 1200];
const FAN_LEVELS_ORDER = ["supporter", "top_supporter", "biggest_fan", "early_supporter", "verified_tastemaker"];

function FanXpBar({ fanXP, fanLevel }: { fanXP: number; fanLevel: string }) {
  const levelIdx = FAN_LEVELS_ORDER.indexOf(fanLevel);
  const currentMin = FAN_XP_THRESHOLDS[levelIdx] ?? 0;
  const nextMin = FAN_XP_THRESHOLDS[levelIdx + 1];
  const isMax = !nextMin;
  const pct = isMax ? 100 : Math.min(100, Math.round(((fanXP - currentMin) / (nextMin - currentMin)) * 100));
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/30 shrink-0">{fanXP} XP</span>
    </div>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<"artists" | "fans">("artists");
  const { data: entries, isLoading: artistsLoading } = trpc.leaderboard.combined.useQuery();
  const { data: fans, isLoading: fansLoading } = trpc.leaderboard.topFans.useQuery();

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-16 z-10 backdrop-blur-sm">
        <div className="container py-4">
          <h1 className="font-['Anton'] text-2xl tracking-wider">
            LEADERBOARD
          </h1>
          {/* Tab switcher */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab("artists")}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all ${
                activeTab === "artists"
                  ? "bg-red-600 text-white"
                  : "border border-white/20 text-white/50 hover:text-white hover:border-white/40"
              }`}
            >
              <Swords className="w-3 h-3 inline mr-1.5" />
              Artists
            </button>
            <button
              onClick={() => setActiveTab("fans")}
              className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all ${
                activeTab === "fans"
                  ? "bg-blue-600 text-white"
                  : "border border-white/20 text-white/50 hover:text-white hover:border-white/40"
              }`}
            >
              <Heart className="w-3 h-3 inline mr-1.5" />
              Top Fans
            </button>
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-4xl">

        {/* ── ARTISTS TAB ──────────────────────────────────────── */}
        {activeTab === "artists" && (
          <>
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

            {artistsLoading && (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 animate-pulse border border-white/5" />
                ))}
              </div>
            )}

            {!artistsLoading && (!entries || entries.length === 0) && (
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
                            <div className="font-semibold text-white inline-flex items-center gap-1">
                              <ArtistLink artistName={entry.artistName} userId={entry.userId} />
                              {entry.userId && <UserBadges userId={entry.userId} size="xs" maxVisible={2} />}
                            </div>
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
                          <div className="font-semibold text-white inline-flex items-center gap-1">
                            <ArtistLink artistName={entry.artistName} userId={entry.userId} />
                            {entry.userId && <UserBadges userId={entry.userId} size="xs" maxVisible={2} />}
                          </div>
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
          </>
        )}

        {/* ── TOP FANS TAB ─────────────────────────────────────── */}
        {activeTab === "fans" && (
          <>
            <div className="flex flex-wrap gap-4 mb-6 p-4 border border-blue-500/20 bg-blue-950/10">
              <div className="text-xs text-white/50">
                <span className="text-white font-semibold">Fan XP earned by:</span>{" "}
                voting, forum posts &amp; comments, daily logins, watching live streams
              </div>
              <div className="flex items-center gap-4 text-xs text-white/40 ml-auto">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-blue-400" /> Fan Level</span>
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" /> Fan XP</span>
              </div>
            </div>

            {fansLoading && (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 animate-pulse border border-white/5" />
                ))}
              </div>
            )}

            {!fansLoading && (!fans || fans.length === 0) && (
              <div className="text-center py-20 text-white/40">
                <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-['Anton'] tracking-wider">No fans yet</p>
                <p className="text-sm mt-1">Fan XP is earned by voting, commenting, and engaging with the platform</p>
              </div>
            )}

            {fans && fans.length > 0 && (
              <div className="space-y-1">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_10rem] gap-3 px-4 py-2 text-xs text-white/30 uppercase tracking-widest border-b border-white/10">
                  <span>Rank</span>
                  <span>Fan</span>
                  <span className="text-center">Fan Level</span>
                  <span className="text-center">Fan XP</span>
                </div>

                {fans.map((fan) => {
                  const rankColor = RANK_COLORS[fan.rank - 1] ?? "text-white/50";
                  const isTop3 = fan.rank <= 3;
                  const levelInfo = getFanLevelInfo(fan.fanLevel);

                  return (
                    <div
                      key={fan.id}
                      className={`border transition-all duration-200 ${
                        isTop3
                          ? "border-blue-500/30 bg-blue-950/20 hover:bg-blue-950/30"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Mobile layout */}
                      <div className="md:hidden p-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-['Anton'] text-xl w-10 text-center ${rankColor}`}>
                            {getRankBadge(fan.rank)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/profile/${fan.id}`} className="font-semibold text-white hover:text-red-400 transition-colors truncate">
                                {fan.displayName}
                              </Link>
                              <UserBadges userId={fan.id} size="xs" maxVisible={2} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs" style={{ color: levelInfo.color }}>
                                {levelInfo.icon} {levelInfo.label}
                              </span>
                            </div>
                            <FanXpBar fanXP={fan.fanXP} fanLevel={fan.fanLevel} />
                          </div>
                          <div className={`font-['Anton'] text-xl ${isTop3 ? "text-blue-400" : "text-white/70"}`}>
                            {fan.fanXP}
                          </div>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-[3rem_1fr_8rem_10rem] gap-3 px-4 py-3 items-center">
                        <span className={`font-['Anton'] text-lg text-center ${rankColor}`}>
                          {getRankBadge(fan.rank)}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/profile/${fan.id}`} className="font-semibold text-white hover:text-red-400 transition-colors">
                              {fan.displayName}
                            </Link>
                            <UserBadges userId={fan.id} size="xs" maxVisible={2} />
                          </div>
                          <FanXpBar fanXP={fan.fanXP} fanLevel={fan.fanLevel} />
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-semibold" style={{ color: levelInfo.color }}>
                            {levelInfo.icon} {levelInfo.label}
                          </span>
                        </div>
                        <div className={`font-['Anton'] text-xl text-center ${isTop3 ? "text-blue-400" : "text-white/70"}`}>
                          {fan.fanXP} <span className="text-xs text-white/30 font-sans font-normal">XP</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
