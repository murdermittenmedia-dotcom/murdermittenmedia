/* ============================================================
   LabelBadge — renders one or more account type labels as
   colored pill badges next to a username.
   ============================================================ */

export type AccountLabel =
  | "fan"
  | "artist"
  | "producer"
  | "videographer"
  | "blogger"
  | "brand_owner"
  | "audio_engineer"
  | "judge"
  | "admin";

const LABEL_CONFIG: Record<AccountLabel, { display: string; className: string }> = {
  fan:            { display: "FAN",            className: "bg-zinc-700 text-zinc-200 border-zinc-600" },
  artist:         { display: "ARTIST",         className: "bg-red-900/70 text-red-300 border-red-700" },
  producer:       { display: "PRODUCER",       className: "bg-blue-900/70 text-blue-300 border-blue-700" },
  videographer:   { display: "VIDEOGRAPHER",   className: "bg-purple-900/70 text-purple-300 border-purple-700" },
  blogger:        { display: "BLOGGER",        className: "bg-emerald-900/70 text-emerald-300 border-emerald-700" },
  brand_owner:    { display: "BRAND OWNER",    className: "bg-orange-900/70 text-orange-300 border-orange-700" },
  audio_engineer: { display: "AUDIO ENGINEER", className: "bg-cyan-900/70 text-cyan-300 border-cyan-700" },
  judge:          { display: "JUDGE",          className: "bg-yellow-500/20 text-yellow-300 border-yellow-500" },
  admin:          { display: "ADMIN",          className: "bg-red-600/30 text-red-400 border-red-500 font-black" },
};

interface LabelBadgeProps {
  /** Single label key — kept for backward compat */
  label?: AccountLabel | string | null;
  /** Array of label keys — preferred for multi-select */
  labels?: (AccountLabel | string)[] | null;
  /** sm = 10px text (default), xs = 9px for tight spaces */
  size?: "sm" | "xs";
}

export default function LabelBadge({ label, labels, size = "sm" }: LabelBadgeProps) {
  // Normalise to array
  const all: string[] = [];
  if (labels && labels.length > 0) {
    all.push(...labels);
  } else if (label) {
    all.push(label);
  }

  const valid = all.filter((l): l is AccountLabel => l in LABEL_CONFIG);
  if (valid.length === 0) return null;

  const textSize = size === "xs" ? "text-[9px]" : "text-[10px]";

  return (
    <span className="inline-flex flex-wrap gap-0.5 items-center">
      {valid.map((l) => {
        const cfg = LABEL_CONFIG[l];
        return (
          <span
            key={l}
            className={`inline-flex items-center px-1.5 py-0.5 rounded border font-bold tracking-wider shrink-0 ${textSize} ${cfg.className}`}
          >
            {cfg.display}
          </span>
        );
      })}
    </span>
  );
}

/** All labels a user can pick themselves */
export const USER_LABEL_OPTIONS: { value: AccountLabel; display: string }[] = [
  { value: "fan",            display: "FAN" },
  { value: "artist",         display: "ARTIST" },
  { value: "producer",       display: "PRODUCER" },
  { value: "videographer",   display: "VIDEOGRAPHER" },
  { value: "blogger",        display: "BLOGGER" },
  { value: "brand_owner",    display: "BRAND OWNER" },
  { value: "audio_engineer", display: "AUDIO ENGINEER" },
];

/** All labels (admin can grant any) */
export const ALL_LABEL_OPTIONS: { value: AccountLabel; display: string }[] = [
  ...USER_LABEL_OPTIONS,
  { value: "judge", display: "JUDGE" },
  { value: "admin", display: "ADMIN" },
];
