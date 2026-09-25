import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("bulk YouTube beat editor", () => {
  it("exposes an owner-scoped bulk update procedure with all three edit types", () => {
    const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(routers).toContain("bulkUpdateBeats: protectedProcedure");
    expect(routers).toContain("bulkUpdateBeats: protectedProcedure");
    expect(routers).toContain("artworkBase64: z.string().optional()");
    expect(routers).toContain("prices: z.object({ basic");
    expect(routers).toContain("input.tags !== undefined");
  });

  it("mounts a selectable producer-facing bulk editor", () => {
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "client/src/components/BulkBeatEditor.tsx"), "utf8");
    expect(producer).toContain("<BulkBeatEditor beats={beats} />");
    expect(component).toContain("Bulk edit beats");
    expect(component).toContain("Select all");
    expect(component).toContain("Replace tags on selected beats");
    expect(component).toContain("Choose one image for the batch");
  });

  it("exposes a confirmed delete control and protects sold beats", () => {
    const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const button = readFileSync(resolve(process.cwd(), "client/src/components/DeleteBeatButton.tsx"), "utf8");
    expect(routers).toContain("deleteBeat: protectedProcedure");
    expect(routers).toContain("This beat has sales and cannot be permanently deleted");
    expect(button).toContain("Permanently delete");
    expect(button).toContain("window.confirm");
  });
});
