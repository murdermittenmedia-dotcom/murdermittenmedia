import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Latest News article list", () => {
  it("does not cap the editorial article list at four stories", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/News.tsx"), "utf8");
    expect(source).toContain("{articles.map(article => (");
    expect(source).not.toContain("articles.slice(0, 4)");
  });
});
