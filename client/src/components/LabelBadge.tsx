/**
 * LabelBadge — visible account type label shown next to usernames everywhere.
 * User-selectable: FAN, ARTIST, PRODUCER, VIDEOGRAPHER, BLOGGER, BRAND OWNER
 * Admin-granted:   JUDGE, ADMIN
 */

export type AccountLabel =
  | "fan"
  | "artist"
  | "producer"
  | "videographer"
  | "blogger"
  | "brand_owner"
  | "judge"
  | "admin";

const LABEL_CONFIG: Record<
  AccountLabel,
  { display: string; className: string }
> = {
  fan:          { display: "FAN",          className: "bg-zinc-700 text-zinc-200 border-zinc-600" },
  artist:       { display: "ARTIST",       className: "bg-red-900/70 text-red-300 border-red-700" },
  producer:     { display: "PRODUCER",     className: "bg-blue-900/70 text-blue-300 border-blue-700" },
  videographer: { display: "VIDEOGRAPHER", className: "bg-purple-900/70 text-purple-300 border-purple-700" },
  blogger:      { display: "BLOGGER",      className: "bg-emerald-900/70 text-emerald-300 border-emerald-700" },
  brand_owner:  { display: "BRAND OWNER",  className: "bg-orange-900/70 text-orange-300 border-orange-700" },
  judge:        { display: "JUDGE",        className: "bg-yellow-500/20 text-yellow-300 border-yellow-500" },
  admin:        { display: "ADMIN",        className: "bg-red-600/30 text-red-400 border-red-500" },
};

interface LabelBadgeProps {
  label: AccountLabel | string | null | undefined;
  /** sm = 10px text (default), xs = 9px for tight spaces */
  size?: "sm" | "xs";
}

export default function LabelBadge({ label, size = "sm" }: LabelBadgeProps) {
  if (!label) return null;
  const config = LABEL_CONFIG[label as AccountLabel];
  if (!config) return null;

  const textSize = size === "xs" ? "text-[9px]" : "text-[10px]";

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border font-bold tracking-wider shrink-0 ${textSize} ${config.className}`}
    >
      {config.display}
    </span>
  );
}

/** All labels a user can pick themselves */
export const USER_LABEL_OPTIONS: { value: AccountLabel; display: string }[] = [
  { value: "fan",          display: "FAN" },
  { value: "artist",       display: "ARTIST" },
  { value: "producer",     display: "PRODUCER" },
  { value: "videographer", display: "VIDEOGRAPHER" },
  { value: "blogger",      display: "BLOGGER" },
  { value: "brand_owner",  display: "BRAND OWNER" },
];

/** All labels (admin can grant any) */
export const ALL_LABEL_OPTIONS: { value: AccountLabel; display: string }[] = [
  ...USER_LABEL_OPTIONS,
  { value: "judge", display: "JUDGE" },
  { value: "admin", display: "ADMIN" },
];
