export const REVIEW_TRACKING_POLL_MS = 5_000;
export const REVIEW_TRACKING_FRESH_MS = 15_000;

export type ReviewTrackingStatus =
  | "waiting"
  | "up_next"
  | "now_reviewing"
  | "completed"
  | "skipped"
  | "removed";
export const REVIEW_TRACKING_LABELS: Record<ReviewTrackingStatus, string> = {
  waiting: "Waiting",
  up_next: "Up Next",
  now_reviewing: "Now Reviewing",
  completed: "Completed",
  skipped: "Skipped",
  removed: "Removed",
};

export type ReviewTrackingMetadata = {
  observedAtMs: number;
  expiresAtMs: number;
  availability: "live" | "offline" | "unavailable";
  isLive: boolean;
};
export type PublicReviewTrackingItem = {
  /** Domain-separated opaque display key, never a recovery credential or raw ID. */
  key: string;
  artistName: string;
  songTitle: string;
  status: ReviewTrackingStatus;
  label: string;
  /** Current is 0; eligible pending entries are 1-based. Null when not live. */
  position: number | null;
  positionLabel: string;
};
export type PrivateReviewTrackingItem = PublicReviewTrackingItem & {
  submissionId: number;
  /** Includes the current review, if any; null when not live or not eligible. */
  numberAhead: number | null;
  queueEligible: boolean;
  queueEligibilityReason:
    | "eligible"
    | "awaiting_payment_confirmation"
    | "paid_only"
    | "not_in_queue";
};
export type PublicReviewQueueSnapshot = ReviewTrackingMetadata & {
  current: PublicReviewTrackingItem | null;
  upNext: PublicReviewTrackingItem | null;
  waiting: PublicReviewTrackingItem[];
  recent: PublicReviewTrackingItem[];
};
export type MyReviewTrackingSnapshot = ReviewTrackingMetadata & {
  current: PublicReviewTrackingItem | null;
  upNext: PublicReviewTrackingItem | null;
  submissions: PrivateReviewTrackingItem[];
};
export type ResolvedReviewTrackingSnapshot = ReviewTrackingMetadata & {
  current: PublicReviewTrackingItem | null;
  upNext: PublicReviewTrackingItem | null;
  submission: PrivateReviewTrackingItem;
};

/** Call with connectionFresh=false on query error, reconnecting, or browser
 * offline. A cached successful response alone is never proof of live position. */
export function isReviewTrackingSnapshotLive(
  snapshot: ReviewTrackingMetadata | null | undefined,
  nowMs = Date.now(),
  connectionFresh = true
) {
  return (
    !!snapshot &&
    connectionFresh &&
    snapshot.isLive &&
    snapshot.availability === "live" &&
    nowMs >= snapshot.observedAtMs - REVIEW_TRACKING_FRESH_MS &&
    nowMs < snapshot.expiresAtMs
  );
}
export function getReviewTrackingDisplayPosition(
  item: PublicReviewTrackingItem,
  snapshot: ReviewTrackingMetadata | null | undefined,
  nowMs = Date.now(),
  connectionFresh = true
) {
  return isReviewTrackingSnapshotLive(snapshot, nowMs, connectionFresh)
    ? item.position
    : null;
}
