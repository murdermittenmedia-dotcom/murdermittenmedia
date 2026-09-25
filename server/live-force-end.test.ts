import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin live broadcast force end", () => {
  it("uses the real live end mutation rather than marking payout state", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(page).toContain("trpc.live.end.useMutation");
    expect(page).toContain('endStreamMutation.mutate({ streamId: s.id })');
    expect(router).toContain("if (stream.userId !== ctx.user.id && ctx.user.role !== \"admin\")");
    expect(router).toContain("status: \"ended\", endedAt: now");
    expect(router).toContain("Room delete failed (non-fatal");
  });
});
