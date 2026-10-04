import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("activity names and homepage feature hub", () => {
  it("resolves new-member activity to the account name and profile", () => {
    const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const feedSource = readFileSync(resolve(process.cwd(), "client/src/components/ActivityFeed.tsx"), "utf8");
    expect(dbSource).toContain("const displayName = member?.name || member?.artistName");
    expect(dbSource).toContain("title: displayName && profileId ? `${displayName} joined the Mitten`");
    expect(dbSource).toContain("href: profileId ? `/profile/${profileId}`");
    expect(feedSource).toContain("metadata.displayName && metadata.profileId");
  });

  it("puts the requested destinations on the homepage feature hub", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    for (const destination of ["/news", "/beats", "/merch", "/promo", "/podcast", "/mic", "/daily-wheel", "/fire-or-trash"]) {
      expect(homeSource).toContain(`href: \"${destination}\"`);
    }
    expect(homeSource).toContain("Everything Murder Mitten");
    expect(homeSource).toContain("Latest <span className=\"text-red-600\">Editorials</span>");
  });
});
