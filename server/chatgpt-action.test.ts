import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ChatGPT website Editorial Desk Action", () => {
  it("publishes an OpenAPI Action contract with protected draft creation", () => {
    const server = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    const auth = readFileSync(resolve(process.cwd(), "server/chatgpt-action.ts"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");

    expect(server).toContain("/api/chatgpt/openapi.json");
    expect(server).toContain("/api/chatgpt/editorial-drafts");
    expect(server).toContain("isValidChatGPTActionKey");
    expect(server).toContain("generateEditorialArticleDraft(sourceText)");
    expect(auth).toContain("chatgpt-editorial-action:v1");
    expect(admin).toContain("Connect ChatGPT website to this Editorial Desk");
    expect(admin).toContain("Bearer API key");
  });
});
