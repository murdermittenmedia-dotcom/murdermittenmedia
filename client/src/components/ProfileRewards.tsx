/* ============================================================
   ProfileRewards — Full reward display for a user's profile.
   Shows XP bar, level progress, streak, badges, unlocked
   rewards, locked rewards with progress, and reward history.
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Shield, Clock, Zap, Lock, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// ── Level config (mirrors server/rewards.ts) ──────────────────
const ARTIST_LEVELS = [
  { level: "bronze",        minXP: 0,     label: "Bronze Artist",   color: "#CD7F32", icon: "🥉" },
  { level: "verified",      minXP: 500,   label: "Verified Artist", color: "#C0C0C0", icon: "✅" },
  { level: "trending",      minXP: 1500,  label: "Trending Artist", color: "#FFD700", icon: "📈" },
  { level: "city_motion",   minXP: 3000,  label: "City in Motion",  color: "#FF6B00", icon: "🏙️" },
  { level: "mitten_elite",  minXP: 6000,  label: "Mitten Elite",    color: "#D10000", icon: "🔥" },
  { level: "hall_of_fame",  minXP: 12000, label: "Hall of Fame",    color: "#9B59B6", icon: "🏆" },
];
const FAN_LEVELS = [
  { level: "supporter",           minXP: 0,    label: "Supporter",           color: "#6B7280", icon: "👋" },
  { level: "top_supporter",       minXP: 100,  label: "Top Supporter",       color: "#3B82F6", icon: "⭐" },
  { level: "biggest_fan",         minXP: 300,  label: "Biggest Fan",         color: "#8B5CF6", icon: "💜" },
  { level: "early_supporter",     minXP: 600,  label: "Early Supporter",     color: "#F59E0B", icon: "🌟" },
  { level: "verified_tastemaker", minXP: 1200, label: "Verified Tastemaker", color: "#10B981", icon: "🎯" },
];

const RARITY_COLORS: Record<string, string> = {
  common:       "border-white/20 text-white/60",
  rare:         "border-blue-400/50 text-blue-400",
  epic:         "border-purple-400/50 text-purple-400",
  legendary:    "border-yellow-400/50 text-yellow-400",
  hall_of_fame: "border-red-400/60 text-red-400",
};
const RARITY_BG: Record<string, string> = {
  common:       "bg-white/5",
  rare:         "bg-blue-900/20",
  epic:         "bg-purple-900/20",
  legendary:    "bg-yellow-900/20",
  hall_of_fame: "bg-red-900/30",
};
const RARITY_GLOW: Record<string, string> = {
  common:       "",
  rare:         "shadow-[0_0_8px_rgba(96,165,250,0.3)]",
  epic:         "shadow-[0_0_8px_rgba(167,139,250,0.3)]",
  legendary:    "shadow-[0_0_12px_rgba(250,204,21,0.4)]",
  hall_of_fame: "shadow-[0_0_16px_rgba(239,68,68,0.5)]",
};
const STATUS_COLORS: Record<string, string> = {
  locked:    "text-white/30",
  unlocked:  "text-yellow-400",
  claimable: "text-green-400",
  active:    "text-blue-400",
  redeemed:  "text-white/50",
  expired:   "text-white/20",
  revoked:   "text-red-400/50",
};
const TYPE_ICONS: Record<string, string> = {
  level:       "⭐",
  achievement: "🏆",
  promo:       "🎁",
  wars:        "⚔️",
  review:      "🎵",
  supporter:   "💎",
  verified:    "✓",
  rare:        "💫",
};

function getLevelInfo(xp: number, levels: typeof ARTIST_LEVELS) {
  let current = levels[0];
  for (const tier of levels) {
    if (xp >= tier.minXP) current = tier;
  }
  const idx = levels.indexOf(current);
  const next = levels[idx + 1] ?? null;
  return { current, next };
}

function XPBar({ xp, levels, label }: { xp: number; levels: typeof ARTIST_LEVELS; label: string }) {
  const { current, next } = getLevelInfo(xp, levels);
  const pct = next
    ? Math.min(((xp - current.minXP) / (next.minXP - current.minXP)) * 100, 100)
    : 100;
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{current.icon}</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: current.color }}>
              {current.label}
            </div>
            <div className="text-white/40 text-xs uppercase tracking-widest">{label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-['Anton'] text-xl text-white">{xp.toLocaleString()} XP</div>
          {next && (
            <div className="text-white/40 text-xs">{(next.minXP - xp).toLocaleString()} to {next.label}</div>
          )}
          {!next && (
            <div className="text-xs" style={{ color: current.color }}>MAX LEVEL</div>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: current.color }}
        />
      </div>
      {/* Level milestones */}
      <div className="flex justify-between mt-1">
        {levels.map((tier) => (
          <TooltipProvider key={tier.level} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`text-xs cursor-default ${xp >= tier.minXP ? "opacity-100" : "opacity-25"}`}
                  style={{ color: tier.color }}
                >
                  {tier.icon}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#111] border-white/10 text-white text-xs">
                {tier.label} — {tier.minXP.toLocaleString()} XP
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}

type RewardItem = {
  reward: {
    id: number;
    name: string;
    description?: string | null;
    type: string;
    rarity: string;
    badgeIcon?: string | null;
    badgeColor?: string | null;
  };
  status: string;
  progress: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requirements: Record<string, any>;
  userReward: {
    unlockedAt?: Date | null;
    claimedAt?: Date | null;
    earnedVia?: string | null;
  } | null;
};

function RewardCard({
  item,
  onClaim,
  isClaiming,
}: {
  item: RewardItem;
  onClaim?: (id: number) => void;
  isClaiming?: boolean;
}) {
  const { reward, status, progress, userReward } = item;
  const isLocked = status === "locked";
  const isClaimable = status === "claimable" || status === "unlocked";
  const isActive = status === "active";
  const isRedeemed = status === "redeemed";
  const rarityColor = RARITY_COLORS[reward.rarity] ?? RARITY_COLORS.common;
  const rarityBg = RARITY_BG[reward.rarity] ?? RARITY_BG.common;
  const rarityGlow = RARITY_GLOW[reward.rarity] ?? "";
  const icon = reward.badgeIcon ?? TYPE_ICONS[reward.type] ?? "🏅";
  const statusColor = STATUS_COLORS[status] ?? "text-white/40";

  return (
    <div
      className={`border p-4 transition-all duration-200 ${rarityBg} ${rarityColor} ${rarityGlow} ${
        isLocked ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 flex items-center justify-center text-xl border rounded-sm flex-shrink-0 ${rarityBg} ${rarityColor}`}
          style={reward.badgeColor ? { borderColor: reward.badgeColor, color: reward.badgeColor } : undefined}
        >
          {isLocked ? <Lock className="w-4 h-4 opacity-50" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-white text-sm">{reward.name}</span>
            <span className={`text-[10px] uppercase tracking-widest font-bold ${statusColor}`}>
              {status}
            </span>
            <span className={`text-[10px] uppercase tracking-widest ml-auto ${rarityColor}`}>
              {reward.rarity.replace("_", " ")}
            </span>
          </div>
          {reward.description && (
            <p className="text-white/50 text-xs leading-relaxed mb-2">{reward.description}</p>
          )}
          {/* Progress bar for locked rewards */}
          {isLocked && progress < 100 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-white/30 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-600/60 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {/* Earned info */}
          {userReward?.unlockedAt && (
            <div className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Unlocked {new Date(userReward.unlockedAt).toLocaleDateString()}
              {userReward.earnedVia && ` · via ${userReward.earnedVia.replace(/_/g, " ")}`}
            </div>
          )}
          {/* Claim button */}
          {isClaimable && onClaim && (
            <Button
              size="sm"
              onClick={() => onClaim(reward.id)}
              disabled={isClaiming}
              className="mt-2 bg-green-700 hover:bg-green-600 text-white text-xs uppercase tracking-widest h-7 px-3"
            >
              {isClaiming ? "Claiming..." : "Claim Reward"}
            </Button>
          )}
          {isActive && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-blue-400 font-semibold uppercase tracking-widest">
              <Zap className="w-3 h-3" /> Active
            </span>
          )}
          {isRedeemed && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-white/30 font-semibold uppercase tracking-widest">
              <CheckCircle2 className="w-3 h-3" /> Redeemed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfileRewardsProps {
  userId: number;
  isOwnProfile: boolean;
}

export function ProfileRewards({ userId, isOwnProfile }: ProfileRewardsProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showLocked, setShowLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"badges" | "rewards" | "history">("badges");

  // Fetch reward stats (XP, level, streak) — public endpoint
  const { data: rewardStats } = trpc.rewards.getStatsByUserId.useQuery(
    { userId },
    { staleTime: 60_000 }
  );

  // Fetch badges
  const { data: badges } = trpc.rewards.getBadgesForUser.useQuery(
    { userId },
    { staleTime: 60_000 }
  );

  // Fetch rewards with progress (own profile only — includes locked)
  const { data: myRewards } = trpc.rewards.myRewards.useQuery(undefined, {
    enabled: isOwnProfile && !!user,
    staleTime: 30_000,
  });

  // Fetch public rewards (for visiting profiles — only unlocked/active/redeemed)
  const { data: publicRewards } = trpc.rewards.getPublicForUser.useQuery(
    { userId },
    { enabled: !isOwnProfile, staleTime: 60_000 }
  );

  // Claim reward mutation
  const claimMutation = trpc.rewards.claim.useMutation({
    onSuccess: () => {
      toast.success("Reward claimed!");
      utils.rewards.myRewards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const xp = rewardStats?.xp ?? 0;
  const fanXP = rewardStats?.fanXP ?? 0;
  const streak = rewardStats?.streak ?? 0;

  // Categorize rewards for own profile
  const unlockedRewards: RewardItem[] = (myRewards?.filter(r => ["unlocked", "claimable", "active"].includes(r.status)) ?? []) as RewardItem[];
  const redeemedRewards: RewardItem[] = (myRewards?.filter(r => r.status === "redeemed") ?? []) as RewardItem[];
  const lockedRewards: RewardItem[] = (myRewards?.filter(r => r.status === "locked") ?? []) as RewardItem[];

  const hasAnyContent =
    (rewardStats && (xp > 0 || fanXP > 0 || streak > 0)) ||
    (badges && badges.length > 0) ||
    (myRewards && myRewards.length > 0) ||
    (publicRewards && publicRewards.length > 0);

  if (!hasAnyContent) return null;

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-red-600" />
        <h2 className="font-['Anton'] text-2xl uppercase">Rewards & Achievements</h2>
      </div>

      {/* XP / Level Bars */}
      {rewardStats && (xp > 0 || fanXP > 0 || streak > 0) && (
        <div className="border border-white/10 bg-white/[0.03] p-5 mb-6">
          {/* Streak */}
          {streak > 0 && (
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-['Anton'] text-2xl text-orange-500">{streak}</span>
              <span className="text-white/50 text-sm uppercase tracking-widest">Day Streak</span>
            </div>
          )}
          {xp > 0 && (
            <XPBar xp={xp} levels={ARTIST_LEVELS} label="Artist XP" />
          )}
          {fanXP > 0 && (
            <XPBar xp={fanXP} levels={FAN_LEVELS as unknown as typeof ARTIST_LEVELS} label="Fan XP" />
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 border-b border-white/10">
        {[
          { key: "badges", label: "Badges", icon: <Shield className="w-3.5 h-3.5" /> },
          { key: "rewards", label: "Rewards", icon: <Trophy className="w-3.5 h-3.5" /> },
          ...(isOwnProfile ? [{ key: "history" as const, label: "History", icon: <Clock className="w-3.5 h-3.5" /> }] : []),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-widest border-b-2 transition-all -mb-px ${
              activeTab === tab.key
                ? "border-red-600 text-red-500"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Badges tab */}
      {activeTab === "badges" && (
        <div>
          {(!badges || badges.length === 0) ? (
            <div className="text-center py-8 text-white/30">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No badges yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {badges.map(badge => {
                const rarityColor = RARITY_COLORS[badge.rarity] ?? RARITY_COLORS.common;
                const rarityBg = RARITY_BG[badge.rarity] ?? RARITY_BG.common;
                const rarityGlow = RARITY_GLOW[badge.rarity] ?? "";
                const icon = badge.badgeIcon ?? TYPE_ICONS[badge.badge] ?? "🏅";
                const label = badge.label ?? badge.badge.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <TooltipProvider key={badge.id} delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`border p-3 flex flex-col items-center gap-2 cursor-default transition-all duration-200 hover:scale-105 ${rarityBg} ${rarityColor} ${rarityGlow}`}
                          style={badge.badgeColor ? { borderColor: badge.badgeColor } : undefined}
                        >
                          <span className="text-3xl">{icon}</span>
                          <span className="text-xs font-semibold text-center text-white/80 leading-tight">{label}</span>
                          <span className={`text-[10px] uppercase tracking-widest ${rarityColor}`}>
                            {badge.rarity.replace("_", " ")}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-[#111] border-white/10 text-white text-xs">
                        <p className="font-semibold">{label}</p>
                        <p className="text-white/50 capitalize">{badge.rarity.replace("_", " ")} badge</p>
                        {badge.grantedAt && (
                          <p className="text-white/30">Earned {new Date(badge.grantedAt).toLocaleDateString()}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rewards tab */}
      {activeTab === "rewards" && (
        <div className="space-y-2">
          {/* Own profile: show all rewards with progress */}
          {isOwnProfile && myRewards && (
            <>
              {unlockedRewards.length === 0 && redeemedRewards.length === 0 && (
                <div className="text-center py-8 text-white/30">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No rewards unlocked yet — keep earning XP!</p>
                </div>
              )}
              {unlockedRewards.map(item => (
                <RewardCard
                  key={item.reward.id}
                  item={item}
                  onClaim={(id) => claimMutation.mutate({ rewardId: id })}
                  isClaiming={claimMutation.isPending}
                />
              ))}
              {redeemedRewards.map(item => (
                <RewardCard key={item.reward.id} item={item} />
              ))}
              {/* Locked rewards (collapsible) */}
              {lockedRewards.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowLocked(v => !v)}
                    className="flex items-center gap-2 text-white/40 hover:text-white/70 text-xs uppercase tracking-widest font-semibold py-3 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {lockedRewards.length} Locked Reward{lockedRewards.length !== 1 ? "s" : ""}
                    {showLocked ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showLocked && (
                    <div className="space-y-2">
                      {lockedRewards.map(item => (
                        <RewardCard key={item.reward.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Visiting profile: show only public unlocked rewards */}
          {!isOwnProfile && (
            <>
              {(!publicRewards || publicRewards.length === 0) ? (
                <div className="text-center py-8 text-white/30">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No public rewards yet</p>
                </div>
              ) : (
                publicRewards.map(row => {
                  const { userReward, reward } = row;
                  const item: RewardItem = {
                    reward: reward as RewardItem["reward"],
                    status: userReward.status,
                    progress: 100,
                    requirements: {},
                    userReward: userReward as RewardItem["userReward"],
                  };
                  return <RewardCard key={userReward.id} item={item} />;
                })
              )}
            </>
          )}
        </div>
      )}

      {/* History tab (own profile only) */}
      {activeTab === "history" && isOwnProfile && myRewards && (
        <div className="space-y-2">
          {myRewards.filter(r => r.userReward?.unlockedAt).length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reward history yet</p>
            </div>
          ) : (
            [...myRewards]
              .filter(r => r.userReward?.unlockedAt)
              .sort((a, b) => new Date(b.userReward!.unlockedAt!).getTime() - new Date(a.userReward!.unlockedAt!).getTime())
              .map(item => (
                <div key={item.reward.id} className="border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
                  <span className="text-xl">{item.reward.badgeIcon ?? TYPE_ICONS[item.reward.type] ?? "🏅"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">{item.reward.name}</div>
                    <div className="text-white/40 text-xs">
                      {item.userReward?.earnedVia?.replace(/_/g, " ") ?? "earned"}
                      {" · "}
                      {new Date(item.userReward!.unlockedAt!).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-widest ${STATUS_COLORS[item.status] ?? "text-white/40"}`}>
                    {item.status}
                  </span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
