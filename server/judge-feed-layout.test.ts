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

  it("uses a persisted freeform canvas instead of dense grid packing", () => {
    expect(musicReviewSource).toContain("REVIEW_WINDOW_POSITION_KEY");
    expect(musicReviewSource).toContain("min-w-[980px]");
    expect(musicReviewSource).toContain("position={reviewWindowPositions[");
    expect(musicReviewSource).not.toContain("grid-flow-row-dense");
    expect(musicReviewSource).not.toContain("gridRowEnd");
  });
});
