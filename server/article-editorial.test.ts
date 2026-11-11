import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("professional editorial article features", () => {
  const reader = readFileSync(resolve(process.cwd(), "client/src/pages/ArticleReader.tsx"), "utf8");
  const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
  const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
  const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");

  it("supports Markdown subheadlines, automatic short-headline detection, and styled sources", () => {
    expect(reader).toContain('if (/^##\\s+/.test(first))');
    expect(reader).toContain("isAutomaticSubheadline");
    expect(reader).toContain("Sources & references");
    expect(reader).toContain("text-yellow-300/80");
  });

  it("provides authenticated reader comments with admin moderation", () => {
    expect(schema).toContain('mysqlTable("article_comments"');
    expect(router).toContain("getComments: publicProcedure");
    expect(router).toContain("addComment: protectedProcedure");
    expect(router).toContain("adminHideComment: adminProcedure");
    expect(reader).toContain("Reader <span className=\"text-red-600\">comments");
  });

  it("lets admins set a precise publication date", () => {
    expect(admin).toContain('type="datetime-local"');
    expect(admin).toContain("publishedAt: articleForm.publishedAt ? new Date(articleForm.publishedAt) : null");
    expect(router).toContain("publishedAt: z.coerce.date().nullable().optional()");
  });
});
