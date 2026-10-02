import { describe, expect, it } from "vitest";
import { getSkipLineLabel, getSkipLinePriceCents } from "./skip-payments";

describe("skip-line payment mapping", () => {
  it("keeps the single and bundle Stripe prices aligned with the UI", () => {
    expect(getSkipLinePriceCents("skip")).toBe(1000);
    expect(getSkipLinePriceCents("bundle3")).toBe(2000);
  });

  it("provides clear descriptions for each skip option", () => {
    expect(getSkipLineLabel("skip")).toBe("Skip to front");
    expect(getSkipLineLabel("bundle3")).toBe("3 line skips added to balance");
  });
});
