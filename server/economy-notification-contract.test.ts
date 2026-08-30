import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("economy notification contracts", () => {
  const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

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
});

/**
 * These contract checks intentionally avoid creating financial test records.
 * Runtime mutation behavior remains covered by the server's existing procedure
 * tests and the production build/typecheck performed for each checkpoint.
 */
