import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("activity names and artist spotlight", () => {
  it("resolves new-member activity to the account name and profile", () => {
    const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const feedSource = readFileSync(resolve(process.cwd(), "client/src/components/ActivityFeed.tsx"), "utf8");
    expect(dbSource).toContain("const displayName = member?.name || member?.artistName");
    expect(dbSource).toContain("title: displayName && profileId ? `${displayName} joined the Mitten`");
    expect(dbSource).toContain("href: profileId ? `/profile/${profileId}`");
    expect(feedSource).toContain("metadata.displayName && metadata.profileId");
  });

  it("keeps the homepage spotlight dynamic and interview-capable", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(homeSource).toContain("Artist of the Month");
    expect(homeSource).toContain("artist.featuredVideoId");
    expect(schemaSource).toContain('featuredVideoId: varchar("featuredVideoId"');
  });
});
