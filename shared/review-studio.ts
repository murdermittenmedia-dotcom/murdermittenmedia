export type ReviewLiveEventType = "song_started" | "song_completed" | "queue_changed" | "valid_vote_recorded" | "vote_changed" | "admin_votes_added" | "submission_accepted" | "manual_sound_triggered" | "gift_received" | "soundboard_stopped" | "studio_settings_changed";
export type ReviewLiveEvent = {
  id: string; sequence: number; type: ReviewLiveEventType; timestamp: number;
  occurrenceId: string | null; submissionId: number | null;
  actor?: string; songTitle?: string; artistName?: string; reaction?: "fire" | "trash";
  soundId?: string; soundUrl?: string; giftId?: string; units?: number;
  amount?: number; adminUserId?: number; requestedOccurrenceId?: string | null;
  fire?: number; trash?: number; adminFire?: number; adminTrash?: number;
};
export type ReviewAdminVotesInput = {
  submissionId: number; occurrenceId?: string | null; reaction: "fire" | "trash";
  amount: number; requestId: string;
};
export type ReviewAdminVotesResult = {
  success: true; occurrenceId: string; fire: number; trash: number;
  adminFire: number; adminTrash: number; added: number; duplicate: boolean;
};
export type ReviewSound = { id: string; label: string; url: string | null };
export type ReviewStudioSettings = {
  musicVolume: number; soundboardVolume: number; submissionAlertsEnabled: boolean;
  sounds: ReviewSound[]; giftMappings: Array<{ giftId: string; soundId: string }>;
  tiktokEnabled: boolean; tiktokRoomId: string | null;
};
export const REVIEW_STUDIO_DEFAULTS: ReviewStudioSettings = {
  musicVolume: 0.8, soundboardVolume: 0.7, submissionAlertsEnabled: true,
  sounds: [
    { id: "air-horn", label: "Air horn", url: null }, { id: "bomb", label: "DJ bomb drop", url: null },
    { id: "cheering", label: "Cheering", url: null }, { id: "scratch", label: "Record scratch", url: null },
    { id: "crickets", label: "Crickets", url: null }, { id: "buzzer", label: "Wrong-answer buzzer", url: null },
    { id: "news", label: "Breaking-news stinger", url: null }, { id: "cash", label: "Cash register", url: null },
    { id: "voice", label: "Custom voice drop", url: null },
  ], giftMappings: [], tiktokEnabled: false, tiktokRoomId: null,
};
export const REVIEW_SOURCE_PATHS = {
  now: "/broadcast/overlay/now-playing", queue: "/broadcast/overlay/queue", previous: "/broadcast/overlay/previous",
  header: "/broadcast/overlay/header", submissions: "/broadcast/overlay/submissions", soundboard: "/broadcast/overlay/soundboard-audio",
} as const;
export function parseReviewCommentVote(comment: string): "fire" | "trash" | null {
  const text = comment.normalize("NFKC").trim().toLowerCase().replace(/\ufe0f/g, "");
  if (/^(?:(?:fire|🔥|!fire)\s*[!.]?\s*)+$/.test(text)) return "fire";
  if (/^(?:(?:trash|🗑|!trash)\s*[!.]?\s*)+$/.test(text)) return "trash";
  return null;
}
export function reviewActivityText(event: ReviewLiveEvent) {
  const actor = (event.actor ?? "").trim();
  if (!actor) return null;
  if (event.type === "submission_accepted") return `🎵 ${actor} submitted a song!${event.songTitle ? ` ${event.songTitle}` : ""}`;
  if (event.type === "valid_vote_recorded" || event.type === "vote_changed") return event.reaction === "fire" ? `🔥 ${actor} voted FIRE!` : event.reaction === "trash" ? `🗑️ ${actor} voted TRASH!` : null;
  if (event.type === "admin_votes_added" && event.amount && event.reaction) return `Review admin added ${event.amount.toLocaleString("en-US")} ${event.reaction.toUpperCase()} votes.`;
  return null;
}
