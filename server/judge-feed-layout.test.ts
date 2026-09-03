import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getJudgePanelTileCountPerDesktopRow, getJudgePanelTileMinHeight, JUDGE_PANEL_LAYOUT } from "../client/src/lib/musicReviewLayout";

const musicReviewSource = readFileSync(new URL("../client/src/pages/MusicReview.tsx", import.meta.url), "utf8");

describe("Mitten Panel judge feed layout", () => {
  it("uses three broadcast-ready desktop tiles per row for a six-seat panel", () => {
    expect(getJudgePanelTileCountPerDesktopRow()).toBe(3);
  });

  it("uses a stable 16:9 broadcast frame without arbitrary tile-height distortion", () => {
    expect(JUDGE_PANEL_LAYOUT.mobileTileMinWidth).toBe(0);
    expect(getJudgePanelTileMinHeight(false)).toBe(0);
    expect(getJudgePanelTileMinHeight(true)).toBe(0);
    expect(JUDGE_PANEL_LAYOUT.tileAspectRatio).toBe("16 / 9");
  });

  it("uses a fixed review-stage grid instead of draggable or resizable windows", () => {
    expect(musicReviewSource).toContain("lg:grid-cols-12");
    expect(musicReviewSource).toContain('id="mitten-panel"');
    expect(musicReviewSource).toContain("lg:col-span-12");
    expect(musicReviewSource).toContain("lg:col-span-8");
    expect(musicReviewSource).toContain("Array.from({ length: 6 })");
    expect(musicReviewSource).toContain("grid-cols-2 gap-2");
    expect(musicReviewSource).not.toContain("REVIEW_WINDOW_POSITION_KEY");
    expect(musicReviewSource).not.toContain("ReviewWorkspaceWindow");
    expect(musicReviewSource).not.toContain("min-w-[980px]");
    expect(musicReviewSource).not.toContain("Step into the");
  });
});
