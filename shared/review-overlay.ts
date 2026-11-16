import { isReviewSubmissionEligible } from "./review-payment-access";

export type OverlayTrack = {
  id: number;
  songTitle: string;
  artistName: string;
  userId?: number | null;
  status: string;
  position?: number;
  isPaidSubmission?: boolean;
  paidSubmissionConfirmed?: boolean;
  fireCount?: number;
  trashCount?: number;
  reviewedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function timestamp(value?: Date | string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** Display only: never creates its own queue, changes playback, or writes votes. */
export function selectReviewOverlayState<T extends OverlayTrack>(
  snapshot: { state: { isLive: boolean } | null; currentPlaying: T | null; submissions: T[] } | undefined,
  history: T[] | undefined,
) {
  const isLive = snapshot?.state?.isLive ?? false;
  const current = isLive && snapshot?.currentPlaying?.status === "playing" ? snapshot.currentPlaying : null;
  const waiting = (snapshot?.submissions ?? [])
    .filter((track) => track.status === "pending" && isReviewSubmissionEligible(track) && track.id !== current?.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || timestamp(a.createdAt) - timestamp(b.createdAt) || a.id - b.id);
  const previous = (history ?? [])
    .filter((track) => track.status === "reviewed" && track.id !== snapshot?.currentPlaying?.id)
    .sort((a, b) => timestamp(b.reviewedAt ?? b.updatedAt) - timestamp(a.reviewedAt ?? a.updatedAt) || b.id - a.id)[0] ?? null;
  return { isLive, current, next: waiting.slice(0, 3), inLine: waiting.length, previous };
}

export type ReviewOverlayState = ReturnType<typeof selectReviewOverlayState<OverlayTrack>>;
