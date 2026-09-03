export const JUDGE_PANEL_LAYOUT = {
  desktopColumns: 3,
  mobileTileMinWidth: 0,
  tileAspectRatio: "16 / 9",
  tileMinHeight: 0,
  tileSmallScreenMinHeight: 0,
} as const;

export function getJudgePanelTileMinHeight(isSmallScreen: boolean) {
  return isSmallScreen
    ? JUDGE_PANEL_LAYOUT.tileSmallScreenMinHeight
    : JUDGE_PANEL_LAYOUT.tileMinHeight;
}

export function getJudgePanelTileCountPerDesktopRow() {
  return JUDGE_PANEL_LAYOUT.desktopColumns;
}
