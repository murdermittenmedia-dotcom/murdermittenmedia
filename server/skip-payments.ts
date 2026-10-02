export type SkipType = "skip" | "bundle3";

const SKIP_LINE_PRICES_CENTS: Record<SkipType, number> = {
  skip: 1000,
  bundle3: 2000,
};

export function getSkipLinePriceCents(skipType: SkipType): number {
  return SKIP_LINE_PRICES_CENTS[skipType];
}

export function getSkipLineLabel(skipType: SkipType): string {
  return skipType === "bundle3" ? "3 line skips added to balance" : "Skip to front";
}
