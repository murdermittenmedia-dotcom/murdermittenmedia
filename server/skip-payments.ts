export type SkipType = "reentry5" | "reentry10" | "skip";

const SKIP_LINE_PRICES_CENTS: Record<SkipType, number> = {
  reentry5: 500,
  reentry10: 1000,
  skip: 2000,
};

export function getSkipLinePriceCents(skipType: SkipType): number {
  return SKIP_LINE_PRICES_CENTS[skipType];
}

export function getSkipLineLabel(skipType: SkipType): string {
  if (skipType === "skip") return "Skip to front";
  return skipType === "reentry10" ? "Move 10 spots up" : "Move 5 spots up";
}
