import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getJudgePanelTileCountPerDesktopRow, getJudgePanelTileMinHeight, JUDGE_PANEL_LAYOUT } from "../client/src/lib/musicReviewLayout";

const musicReviewSource = readFileSync(new URL("../client/src/pages/MusicReview.tsx", import.meta.url), "utf8");

describe("Mitten Panel judge feed layout", () => {
  it("uses two desktop tiles per row instead of compressing three feeds into thumbnails", () => {
    expect(getJudgePanelTileCountPerDesktopRow()).toBe(2);
  });

  it("keeps a readable minimum tile size across breakpoints", () => {
    expect(JUDGE_PANEL_LAYOUT.mobileTileMinWidth).toBeGreaterThanOrEqual(300);
    expect(getJudgePanelTileMinHeight(false)).toBeGreaterThanOrEqual(220);
    expect(getJudgePanelTileMinHeight(true)).toBeGreaterThan(getJudgePanelTileMinHeight(false));
    expect(JUDGE_PANEL_LAYOUT.tileAspectRatio).toBe("4 / 3");
  });

  it("uses a fixed review-stage grid instead of draggable or resizable windows", () => {
    expect(musicReviewSource).toContain("lg:grid-cols-12");
    expect(musicReviewSource).toContain('id="mitten-panel"');
    expect(musicReviewSource).toContain("lg:col-span-4");
    expect(musicReviewSource).toContain("lg:col-span-8");
    expect(musicReviewSource).not.toContain("REVIEW_WINDOW_POSITION_KEY");
    expect(musicReviewSource).not.toContain("ReviewWorkspaceWindow");
    expect(musicReviewSource).not.toContain("min-w-[980px]");
    expect(musicReviewSource).not.toContain("Step into the");
  });
});
