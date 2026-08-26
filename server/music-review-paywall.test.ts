import { describe, expect, it } from "vitest";
import {
  getMusicReviewSessionLimitMessage,
  hasCashAppPaymentProof,
  MUSIC_REVIEW_FREE_SUBMISSION_LIMIT,
  MUSIC_REVIEW_PAID_OPTIONS,
} from "../shared/music-review-paywall";

describe("Music Review session paywall", () => {
  it("explains the two free submissions are per live session", () => {
    expect(MUSIC_REVIEW_FREE_SUBMISSION_LIMIT).toBe(2);
    expect(getMusicReviewSessionLimitMessage()).toContain("2 free submissions for this live session");
  });

  it("keeps the paid options stable", () => {
    expect(MUSIC_REVIEW_PAID_OPTIONS.map(({ type, price }) => ({ type, price }))).toEqual([
      { type: "reentry5", price: 5 },
      { type: "reentry10", price: 10 },
      { type: "skip", price: 20 },
    ]);
  });

  it("accepts only a Cash App payment method with a non-trivial receipt URL", () => {
    expect(hasCashAppPaymentProof("https://cash.app/receipt/1234", "Cash App")).toBe(true);
    expect(hasCashAppPaymentProof("abc", "Cash App")).toBe(false);
    expect(hasCashAppPaymentProof("https://cash.app/receipt/1234", "PayPal")).toBe(false);
    expect(hasCashAppPaymentProof(undefined, "Cash App")).toBe(false);
  });
});
