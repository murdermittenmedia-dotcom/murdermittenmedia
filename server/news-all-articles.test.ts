import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Latest News editorial page", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/News.tsx"), "utf8");

  it("keeps the full article result set available without a four-story cap", () => {
    expect(source).toContain("filteredArticles.length");
    expect(source).toContain("rest.map((article: any)");
    expect(source).not.toContain("articles.slice(0, 4)");
  });

  it("does not present the News page as an Instagram feed", () => {
    expect(source.toLowerCase()).not.toContain("instagram");
    expect(source).toContain("Murder Mitten Editorial Desk");
    expect(source).toContain("Search editorials");
  });
});
