import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("economy notification contracts", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
  const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

  it("keeps user-facing alerts for manual coin purchase decisions", () => {
    expect(routerSource).toContain("coin_purchase_approved");
    expect(routerSource).toContain("coin_purchase_rejected");
    expect(routerSource).toContain("userId: purchase.userId");
  });

  it("keeps creator alerts for gifts and cashout status changes", () => {
    expect(routerSource).toContain("title: `${senderDisplayName} sent you a gift`");
    expect(routerSource).toContain("type: 'cashout_resolved'");
    expect(routerSource).toContain("userId: cashout.userId");
  });

  it("keeps post-owner upvote alerts scoped away from self-reactions", () => {
    expect(routerSource).toContain("type: \"forum_like\"");
    expect(routerSource).toContain("title: \"Your post got an upvote\"");
    expect(routerSource).toContain("post.userId !== ctx.user.id");
  });

  it("keeps administrator alerts for new members, submissions, and coin requests", () => {
    expect(dbSource).toContain('type: "admin_new_user"');
    expect(dbSource).toContain('type: "admin_new_submission"');
    expect(routerSource).toContain('type: "admin_coin_purchase"');
    expect(dbSource).toContain('link: "/admin"');
  });
});

/**
 * These contract checks intentionally avoid creating financial test records.
 * Runtime mutation behavior remains covered by the server's existing procedure
 * tests and the production build/typecheck performed for each checkpoint.
 */
