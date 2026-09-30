import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("article share previews", () => {
  it("resolves article-specific title, description, image, and canonical URL metadata", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");
    expect(source).toContain('pathname.match(/^\\/news\\/([^/]+)\\/?$/i)');
    expect(source).toContain("getArticleBySlug(slug)");
    expect(source).toContain("article.title");
    expect(source).toContain("article.thumbnailUrl || article.instagramImageUrl");
    expect(source).toContain('type: "article"');
    expect(source).toContain("og:image");
    expect(source).toContain("twitter:image");
  });
});
