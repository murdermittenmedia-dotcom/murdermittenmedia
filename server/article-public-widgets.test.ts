import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public article link widgets", () => {
  it("renders dedicated music, watch, connect, and external-link sections", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/ArticleReader.tsx"), "utf8");
    expect(source).toContain('> Music</div>');
    expect(source).toContain('> Watch</div>');
    expect(source).toContain('> Connect</div>');
    expect(source).toContain('> More from the artist</div>');
    expect(source).toContain('link.embedUrl');
    expect(source).toContain('href={link.url}');
  });
});
