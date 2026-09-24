import { describe, expect, it } from "vitest";
import { ALL_LABELS, parseAccountLabels } from "./db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account labels", () => {
  it("accepts VERIFIED as an admin-granted public label", () => {
    expect(ALL_LABELS).toContain("verified");
    expect(parseAccountLabels('["verified","not-a-label"]')).toEqual(["verified"]);
  });

  it("exposes VERIFIED in the admin picker and badge renderer", () => {
    const badge = readFileSync(resolve(process.cwd(), "client/src/components/LabelBadge.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    expect(badge).toContain('verified:       { display: "VERIFIED"');
    expect(badge).toContain('{ value: "verified", display: "VERIFIED" }');
    expect(admin).toContain("ALL_LABEL_OPTIONS.map");
  });
});
