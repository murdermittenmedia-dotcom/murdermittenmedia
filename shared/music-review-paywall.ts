export const MUSIC_REVIEW_FREE_SUBMISSION_LIMIT = 2;

export const MUSIC_REVIEW_PAID_OPTIONS = [
  { type: "reentry5", price: 5, label: "$5 Reentry — 1 more song, normal queue" },
  { type: "reentry10", price: 10, label: "$10 Reentry — 1 more song, normal queue" },
  { type: "skip", price: 20, label: "$20 Reentry + Skip the Line — pending admin approval" },
] as const;

export type MusicReviewPaidSubmissionType = (typeof MUSIC_REVIEW_PAID_OPTIONS)[number]["type"];

export function getMusicReviewSessionLimitMessage(limit = MUSIC_REVIEW_FREE_SUBMISSION_LIMIT) {
  return `You've used your ${limit} free submissions for this live session. Choose a paid option to submit another track:`;
}

export function hasCashAppPaymentProof(receiptUrl?: string | null, paymentMethod?: string | null) {
  if (paymentMethod !== "Cash App" || typeof receiptUrl !== "string") return false;
  try {
    const url = new URL(receiptUrl.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}
