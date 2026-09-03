import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldEnableMixedRadioAudio, shouldEndJudgeBroadcast, shouldShowViewerCount } from "../client/src/lib/musicReviewLive";
import { MUSIC_REVIEW_FREE_SUBMISSION_LIMIT } from "../shared/music-review-paywall";
import { REVIEW_PLUS_MONTHLY_PRICE_CENTS, canGenerateReviewBotMessage } from "../shared/review-plus-entitlement";
import { getDailySkipVotesRemaining, hasUnlimitedReviewSkipAccess } from "../shared/review-skip-entitlement";
import { calculateReviewVerdict } from "../shared/review-verdict";

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

  it("enforces the strict daily skip and Review+ entitlement contract", () => {
    expect(getDailySkipVotesRemaining(5, false)).toBe(0);
    expect(getDailySkipVotesRemaining(5, true)).toBeNull();
    expect(hasUnlimitedReviewSkipAccess("judge", false)).toBe(true);
    expect(REVIEW_PLUS_MONTHLY_PRICE_CENTS).toBe(2500);
  });

  it("keeps judge participation inline with a clear request-and-approval entry flow", () => {
    const reviewSource = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(reviewSource).toContain("Request a panel seat");
    expect(reviewSource).toContain("Join your approved seat");
    expect(reviewSource).toContain("requestPanelSeat");
    expect(reviewSource).toContain("getPanelSeatRequests");
    expect(reviewSource).toContain("decidePanelSeat");
    expect(reviewSource).toContain("JudgeLiveBroadcast");
    expect(reviewSource).toContain('id="mitten-panel"');
    expect(reviewSource).toContain('const isJudge = user?.role === "judge";');
    expect(reviewSource).not.toContain("Step into the");
    expect(reviewSource).not.toContain("ReviewWorkspaceWindow");
    expect(appSource).toContain('<Redirect to="/review" />');
    expect(appSource).not.toContain('path={"/judge"} component={JudgeConsole}');
  });

  it("keeps the compatibility popout protected while embedding the main admin controls on the review page", () => {
    const reviewSource = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    const popoutSource = reviewSource.slice(reviewSource.indexOf("if (isAdminPopout)"), reviewSource.indexOf("\n  return (", reviewSource.indexOf("if (isAdminPopout)")));
    expect(popoutSource).toContain("<AdminPanel");
    expect(popoutSource).toContain("Admin access required");
    expect(popoutSource).not.toContain("<SiteNav");
    expect(popoutSource).not.toContain("JudgePanelStrip");
    expect(reviewSource).toContain("Producer controls");
    expect(reviewSource).toContain("isAdminPanelOpen");
    expect(reviewSource).not.toContain("window.open('/admin-popout'");
  });

  it("uses one guarded server handoff for queue completion and emits live activity notifications", () => {
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const serverSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    const navSource = readFileSync(resolve(process.cwd(), "client/src/components/SiteNav.tsx"), "utf8");
    expect(routerSource).toContain("completeAndAdvance");
    expect(routerSource).toContain("stale: true");
    expect(serverSource).toContain("setCurrentPlaying(next.id)");
    expect(serverSource).toContain("site:review_skip_requested");
    expect(serverSource).toContain("review:participant_joined");
    expect(navSource).toContain("site:review_skip_requested");
  });

  it("keeps Bot Chat truly off and retains a branded verdict for review history", () => {
    expect(canGenerateReviewBotMessage(true, false)).toBe(false);
    expect(calculateReviewVerdict({ crowdFire: 8, crowdTrash: 2, judgeFire: 1, judgeTrash: 0 })).toMatchObject({ verdict: "Certified Fire", totalVoteCount: 10 });
  });
});
