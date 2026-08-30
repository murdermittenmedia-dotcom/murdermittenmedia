import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FloatingPlayer contracts", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/FloatingPlayer.tsx"), "utf8");

  it("declares isLiveStream before the mic broadcast hook consumes it", () => {
    const declaration = source.indexOf('const isLiveStream = !!track?.isStream;');
    const hook = source.indexOf('useAdminMicBroadcast({');
    expect(declaration).toBeGreaterThan(-1);
    expect(hook).toBeGreaterThan(-1);
    expect(declaration).toBeLessThan(hook);
  });
});

/**
 * This contract test is intentionally source-level: the defect is an initialization-order
 * regression that can crash the shared player before any backend behavior is exercised.
 */
