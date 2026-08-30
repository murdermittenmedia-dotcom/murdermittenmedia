import { describe, expect, it } from "vitest";
import { getJudgePanelTileCountPerDesktopRow, getJudgePanelTileMinHeight, JUDGE_PANEL_LAYOUT } from "../client/src/lib/musicReviewLayout";

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
});
