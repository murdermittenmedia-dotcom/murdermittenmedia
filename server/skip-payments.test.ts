import { describe, expect, it } from "vitest";
import { getSkipLineLabel, getSkipLinePriceCents } from "./skip-payments";

describe("skip-line payment mapping", () => {
  it("keeps the three Stripe prices aligned with the UI", () => {
    expect(getSkipLinePriceCents("reentry5")).toBe(500);
    expect(getSkipLinePriceCents("reentry10")).toBe(1000);
    expect(getSkipLinePriceCents("skip")).toBe(2000);
  });

  it("provides clear descriptions for each skip option", () => {
    expect(getSkipLineLabel("reentry5")).toBe("Move 5 spots up");
    expect(getSkipLineLabel("reentry10")).toBe("Move 10 spots up");
    expect(getSkipLineLabel("skip")).toBe("Skip to front");
  });
});
