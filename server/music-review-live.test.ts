import { describe, expect, it } from "vitest";
import { shouldEnableMixedRadioAudio, shouldEndJudgeBroadcast, shouldShowViewerCount } from "../client/src/lib/musicReviewLive";

describe("Music Review live-room state", () => {
  it("ends a judge broadcast for terminal room disconnect states", () => {
    expect(shouldEndJudgeBroadcast("disconnected")).toBe(true);
    expect(shouldEndJudgeBroadcast("failed")).toBe(true);
    expect(shouldEndJudgeBroadcast("closed")).toBe(true);
    expect(shouldEndJudgeBroadcast("reconnecting")).toBe(false);
    expect(shouldEndJudgeBroadcast("connected")).toBe(false);
  });

  it("hides the viewer count whenever the review is offline", () => {
    expect(shouldShowViewerCount(false, false)).toBe(false);
    expect(shouldShowViewerCount(false, true)).toBe(false);
    expect(shouldShowViewerCount(true, false)).toBe(false);
    expect(shouldShowViewerCount(true, true)).toBe(true);
  });

  it("allows mixed radio audio for listeners when both sources exist", () => {
    expect(shouldEnableMixedRadioAudio({ isAdmin: false, hasRadioTrack: true, hasJudgeMic: true })).toBe(true);
    expect(shouldEnableMixedRadioAudio({ isAdmin: true, hasRadioTrack: true, hasJudgeMic: true })).toBe(false);
    expect(shouldEnableMixedRadioAudio({ isAdmin: false, hasRadioTrack: false, hasJudgeMic: true })).toBe(false);
    expect(shouldEnableMixedRadioAudio({ isAdmin: false, hasRadioTrack: true, hasJudgeMic: false })).toBe(false);
  });
});
