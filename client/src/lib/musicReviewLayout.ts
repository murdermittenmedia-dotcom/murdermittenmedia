export const JUDGE_PANEL_LAYOUT = {
  desktopColumns: 2,
  mobileTileMinWidth: 300,
  tileAspectRatio: "4 / 3",
  tileMinHeight: 220,
  tileSmallScreenMinHeight: 250,
} as const;

export function getJudgePanelTileMinHeight(isSmallScreen: boolean) {
  return isSmallScreen
    ? JUDGE_PANEL_LAYOUT.tileSmallScreenMinHeight
    : JUDGE_PANEL_LAYOUT.tileMinHeight;
}

export function getJudgePanelTileCountPerDesktopRow() {
  return JUDGE_PANEL_LAYOUT.desktopColumns;
}
