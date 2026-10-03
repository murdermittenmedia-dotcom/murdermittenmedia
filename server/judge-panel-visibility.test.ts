import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("judge panel visibility control", () => {
  it("exposes a public visibility query and admin-only toggle", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(router).toContain("getJudgePanelVisibility: publicProcedure");
    expect(router).toContain('getSetting("review_judge_panel_visible")');
    expect(router).toContain("setJudgePanelVisibility: adminProcedure");
    expect(router).toContain('setSetting("review_judge_panel_visible", String(input.visible))');
  });

  it("hides the judge panel completely and keeps it out of broadcast mode", () => {
    const review = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    expect(review).toContain("trpc.queue.getJudgePanelVisibility.useQuery");
    expect(review).toContain("judgePanelVisible && !isBroadcastHub");
    expect(review).toContain("const isBroadcastHub");
    expect(review).toContain("The judge panel is currently hidden by the admin.");
    expect(admin).toContain("Judge Panel Visibility");
    expect(admin).toContain("trpc.queue.setJudgePanelVisibility.useMutation");
  });
});
