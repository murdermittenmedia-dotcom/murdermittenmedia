import { describe, expect, it } from "vitest";
import { shouldEnableMixedRadioAudio, shouldEndJudgeBroadcast, shouldShowViewerCount } from "../client/src/lib/musicReviewLive";
import { MUSIC_REVIEW_FREE_SUBMISSION_LIMIT } from "../shared/music-review-paywall";

describe("/review 2.0 acceptance contracts", () => {
  it("keeps offline viewer counts hidden and live visibility explicit", () => {
    expect(shouldShowViewerCount(false, true)).toBe(false);
    expect(shouldShowViewerCount(true, false)).toBe(false);
    expect(shouldShowViewerCount(true, true)).toBe(true);
  });

  it("treats reconnecting judge rooms as recoverable but terminal disconnects as ended", () => {
    expect(shouldEndJudgeBroadcast("reconnecting")).toBe(false);
    expect(shouldEndJudgeBroadcast("connected")).toBe(false);
    expect(shouldEndJudgeBroadcast("disconnected")).toBe(true);
    expect(shouldEndJudgeBroadcast("failed")).toBe(true);
  });

  it("keeps judge voice mixing separate from the admin review player path", () => {
    expect(shouldEnableMixedRadioAudio({ isAdmin: false, hasRadioTrack: true, hasJudgeMic: true })).toBe(true);
    expect(shouldEnableMixedRadioAudio({ isAdmin: true, hasRadioTrack: true, hasJudgeMic: true })).toBe(false);
  });

  it("preserves the standard five free submission allowance contract", () => {
    expect(MUSIC_REVIEW_FREE_SUBMISSION_LIMIT).toBe(2);
  });
});
