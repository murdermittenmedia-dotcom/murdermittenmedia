/* ============================================================
   UserBadges — Renders a compact row of badges for a user.
   Fetches from rewards.getBadgesForUser and displays icons
   with tooltips. Used everywhere a username appears.
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
  /** Max badges to show inline (rest shown as +N) */
  maxVisible?: number;
  size?: "xs" | "sm" | "md";
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
  level:     "⭐",
  achievement: "🏆",
  promo:     "🎁",
  wars:      "⚔️",
  review:    "🎵",
  supporter: "💎",
  verified:  "✓",
  rare:      "💫",
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

export function UserBadges({ userId, maxVisible = 3, size = "sm" }: UserBadgesProps) {
  const { data: badges } = trpc.rewards.getBadgesForUser.useQuery(
    { userId: userId! },
    { enabled: !!userId, staleTime: 60_000 }
  );

  if (!userId || !badges || badges.length === 0) return null;

  const visible = badges.slice(0, maxVisible);
  const overflow = badges.length - maxVisible;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {visible.map(b => (
        <BadgePill key={b.id} badge={b as Badge} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-white/40 font-semibold">+{overflow}</span>
      )}
    </span>
  );
}

/** Inline level indicator — shows "Lv.5" next to a name */
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
