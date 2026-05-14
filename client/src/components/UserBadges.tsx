/* ============================================================
   UserBadges — Renders a compact row of badges for a user.
   Shows fan level, artist level, and DB-stored badges.
   Used everywhere a username appears.
   ============================================================ */
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Badge {
  id: number;
  badge: string;
  label?: string | null;
  rarity: string;
  badgeIcon?: string | null;
  badgeColor?: string | null;
}

interface UserBadgesProps {
  userId: number | null | undefined;
  maxVisible?: number;
  size?: "xs" | "sm" | "md";
  showFanLevel?: boolean;
  showArtistLevel?: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common:       "text-white/60 border-white/20",
  rare:         "text-blue-400 border-blue-400/40",
  epic:         "text-purple-400 border-purple-400/40",
  legendary:    "text-yellow-400 border-yellow-400/40",
  hall_of_fame: "text-red-400 border-red-400/60",
};
const RARITY_BG: Record<string, string> = {
  common:       "bg-white/5",
  rare:         "bg-blue-900/20",
  epic:         "bg-purple-900/20",
  legendary:    "bg-yellow-900/20",
  hall_of_fame: "bg-red-900/30",
};
const DEFAULT_ICONS: Record<string, string> = {
  level:       "⭐",
  achievement: "🏆",
  promo:       "🎁",
  wars:        "⚔️",
  review:      "🎵",
  supporter:   "💎",
  verified:    "✓",
  rare:        "💫",
};

// Fan level info (mirrors server/rewards.ts FAN_LEVELS)
const FAN_LEVEL_INFO: Record<string, { label: string; color: string; icon: string; rarity: string }> = {
  supporter:           { label: "Supporter",           color: "#6B7280", icon: "👋", rarity: "common"    },
  top_supporter:       { label: "Top Supporter",       color: "#3B82F6", icon: "⭐", rarity: "rare"      },
  biggest_fan:         { label: "Biggest Fan",         color: "#8B5CF6", icon: "💜", rarity: "epic"      },
  early_supporter:     { label: "Early Supporter",     color: "#F59E0B", icon: "🌟", rarity: "legendary" },
  verified_tastemaker: { label: "Verified Tastemaker", color: "#10B981", icon: "🎯", rarity: "legendary" },
};

// Artist level info (mirrors server/rewards.ts ARTIST_LEVELS)
const ARTIST_LEVEL_INFO: Record<string, { label: string; color: string; icon: string; rarity: string }> = {
  bronze:       { label: "Bronze Artist",   color: "#CD7F32", icon: "🥉", rarity: "common"      },
  verified:     { label: "Verified Artist", color: "#C0C0C0", icon: "✅", rarity: "rare"        },
  trending:     { label: "Trending Artist", color: "#FFD700", icon: "📈", rarity: "epic"        },
  city_motion:  { label: "City in Motion",  color: "#FF6B00", icon: "🏙️", rarity: "legendary"  },
  mitten_elite: { label: "Mitten Elite",    color: "#D10000", icon: "🔥", rarity: "legendary"  },
  hall_of_fame: { label: "Hall of Fame",    color: "#9B59B6", icon: "🏆", rarity: "hall_of_fame" },
};

function BadgePill({ badge, size = "sm" }: { badge: Badge; size?: "xs" | "sm" | "md" }) {
  const colorClass = RARITY_COLORS[badge.rarity] ?? RARITY_COLORS.common;
  const bgClass = RARITY_BG[badge.rarity] ?? RARITY_BG.common;
  const icon = badge.badgeIcon ?? DEFAULT_ICONS[badge.badge] ?? "🏅";
  const sizeClass = size === "xs" ? "text-[10px] px-1 py-0.5 gap-0.5" : size === "md" ? "text-sm px-2 py-1 gap-1" : "text-xs px-1.5 py-0.5 gap-0.5";
  const label = badge.label ?? badge.badge.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center border rounded-sm font-semibold uppercase tracking-wider cursor-default select-none ${colorClass} ${bgClass} ${sizeClass}`}
            style={badge.badgeColor ? { borderColor: badge.badgeColor, color: badge.badgeColor } : undefined}
          >
            <span>{icon}</span>
            {size !== "xs" && <span>{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#111] border border-white/10 text-white text-xs">
          <p className="font-semibold">{label}</p>
          <p className="text-white/50 capitalize">{badge.rarity.replace("_", " ")} badge</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SyntheticBadge({
  icon, label, color, rarity, tooltip, size = "sm",
}: {
  icon: string; label: string; color: string; rarity: string; tooltip: string; size?: "xs" | "sm" | "md";
}) {
  const sizeClass = size === "xs" ? "text-[10px] px-1 py-0.5 gap-0.5" : size === "md" ? "text-sm px-2 py-1 gap-1" : "text-xs px-1.5 py-0.5 gap-0.5";
  const bgClass = RARITY_BG[rarity] ?? RARITY_BG.common;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center border rounded-sm font-semibold uppercase tracking-wider cursor-default select-none ${bgClass} ${sizeClass}`}
            style={{ borderColor: color, color }}
          >
            <span>{icon}</span>
            {size !== "xs" && <span>{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-[#111] border border-white/10 text-white text-xs">
          <p className="font-semibold">{label}</p>
          <p className="text-white/50">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function UserBadges({
  userId,
  maxVisible = 3,
  size = "sm",
  showFanLevel = true,
  showArtistLevel = true,
}: UserBadgesProps) {
  const { data: badges } = trpc.rewards.getBadgesForUser.useQuery(
    { userId: userId! },
    { enabled: !!userId, staleTime: 60_000 }
  );
  const { data: stats } = trpc.rewards.getStatsByUserId.useQuery(
    { userId: userId! },
    { enabled: !!userId && (showFanLevel || showArtistLevel), staleTime: 120_000 }
  );

  if (!userId) return null;

  const fanLevel = stats?.fanLevel;
  const artistLevel = stats?.level;
  const hasFanBadge = showFanLevel && fanLevel && fanLevel !== "supporter" && (stats?.fanXP ?? 0) > 0;
  const hasArtistBadge = showArtistLevel && artistLevel && artistLevel !== "bronze" && (stats?.xp ?? 0) > 0;
  const hasBadges = badges && badges.length > 0;

  if (!hasBadges && !hasFanBadge && !hasArtistBadge) return null;

  const visible = (badges ?? []).slice(0, maxVisible);
  const overflow = (badges?.length ?? 0) - maxVisible;
  const fanInfo = fanLevel ? FAN_LEVEL_INFO[fanLevel] : null;
  const artistInfo = artistLevel ? ARTIST_LEVEL_INFO[artistLevel] : null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {hasFanBadge && fanInfo && (
        <SyntheticBadge
          icon={fanInfo.icon}
          label={fanInfo.label}
          color={fanInfo.color}
          rarity={fanInfo.rarity}
          tooltip={`Fan Level · ${stats?.fanXP ?? 0} Fan XP`}
          size={size}
        />
      )}
      {hasArtistBadge && artistInfo && (
        <SyntheticBadge
          icon={artistInfo.icon}
          label={artistInfo.label}
          color={artistInfo.color}
          rarity={artistInfo.rarity}
          tooltip={`Artist Level · ${stats?.xp ?? 0} XP`}
          size={size}
        />
      )}
      {visible.map(b => (
        <BadgePill key={b.id} badge={b as Badge} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-white/40 font-semibold">+{overflow}</span>
      )}
    </span>
  );
}

/** Inline level indicator */
export function UserLevel({ userId }: { userId: number | null | undefined }) {
  const { data: publicProfile } = trpc.profile.getById.useQuery(
    { userId: userId! },
    { enabled: !!userId, staleTime: 120_000 }
  );
  const level = (publicProfile as { level?: number } | undefined)?.level;
  if (!level || Number(level) < 2) return null;
  return (
    <span className="text-[10px] text-red-400/70 font-semibold ml-0.5">
      Lv.{level}
    </span>
  );
}
