import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public article link widgets", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/ArticleReader.tsx"), "utf8");

  it("renders dedicated music, watch, connect, and external-link sections", () => {
    expect(source).toContain('> Music</div>');
    expect(source).toContain('> Watch</div>');
    expect(source).toContain('> Connect</div>');
    expect(source).toContain('> More from the artist</div>');
    expect(source).toContain('link.embedUrl');
    expect(source).toContain('href={link.url}');
  });

  it("places the article body before catalog media and offsets the fixed menu", () => {
    expect(source).toContain("pt-24 pb-24 md:pt-28");
    expect(source).toContain("object-contain");
    expect(source.indexOf("<ArticleBody")).toBeLessThan(source.indexOf("<CatalogEmbeds links={catalogLinks} />"));
    expect(source).not.toContain("<CatalogEmbeds links={catalogLinks} />\n            <div className=\"my-10");
    expect(source).not.toContain("article.caption && <p className=\"mt-6 border-l-2");
  });
});
