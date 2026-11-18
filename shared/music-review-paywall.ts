export const MUSIC_REVIEW_FREE_SUBMISSION_LIMIT = 2;

export const MUSIC_REVIEW_PAID_OPTIONS = [
  { type: "reentry5", price: 5, label: "$5 Reentry — 1 more song, normal queue" },
  { type: "reentry10", price: 10, label: "$10 Reentry — 1 more song, normal queue" },
  { type: "skip", price: 20, label: "$20 Reentry + Skip the Line — pending admin approval" },
] as const;

export type MusicReviewPaidSubmissionType = (typeof MUSIC_REVIEW_PAID_OPTIONS)[number]["type"];
export type MusicReviewManualPaymentMethod = "Cash App" | "PayPal";

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

/** Only this upload namespace can be used as a relative proof reference.
 * storagePut appends an eight-hex random suffix to the UUID we supply. */
export function isManualPaymentReceiptUrl(receiptUrl?: string | null) {
  if (typeof receiptUrl !== "string") return false;
  const value = receiptUrl.trim();
  if (!value || value.length > 512 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (/^\/manus-storage\/review-payment-proofs\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?:_[a-f0-9]{8})?\.(?:png|jpg|webp)$/.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    // Uploaded proofs must use their canonical relative URL, never an arbitrary
    // storage object dressed up as an absolute receipt link.
    return !!url.hostname && !url.username && !url.password && !url.pathname.startsWith("/manus-storage/") && (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
}

export function hasManualPaymentProof(receiptUrl?: string | null, paymentMethod?: string | null) {
  return (paymentMethod === "Cash App" || paymentMethod === "PayPal") && isManualPaymentReceiptUrl(receiptUrl);
}
