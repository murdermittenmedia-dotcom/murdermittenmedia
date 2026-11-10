import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Editorial Desk ChatGPT form filler", () => {
  it("exposes an admin-only structured draft procedure and fills the existing form", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const adminPanel = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");

    expect(router).toContain("generateArticleDraft: adminProcedure");
    expect(router).toContain("name: \"editorial_article_draft\"");
    expect(router).toContain("allowedUrls.has(link.url)");
    expect(adminPanel).toContain("trpc.admin.generateArticleDraft.useMutation");
    expect(adminPanel).toContain("Fill form with ChatGPT");
    expect(adminPanel).toContain("Nothing is published automatically.");
    expect(adminPanel).toContain("parsePastedArticleLinks(articleForm.catalogLinks)");
  });
});
