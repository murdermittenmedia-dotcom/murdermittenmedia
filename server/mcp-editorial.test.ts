import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const { createUnpublishedEditorialDraft } = vi.hoisted(() => ({ createUnpublishedEditorialDraft: vi.fn(async () => ({ id: 321, slug: "new-draft", status: "draft" as const, headline: "New Draft", duplicate: false })) }));
vi.mock("./editorial-draft-record", () => ({ createUnpublishedEditorialDraft }));

import { createEditorialMcpServer } from "./mcp-editorial";

describe("remote Editorial MCP", () => {
  it("initializes and discovers only create_editorial_draft", async () => {
    const server = createEditorialMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toEqual(["create_editorial_draft"]);
    await client.close();
    await server.close();
  });

  it("creates a structured draft result and never asks the record service to publish", async () => {
    const server = createEditorialMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({ name: "create_editorial_draft", arguments: { headline: "New Draft", markdownBody: "## Story\n\nBody.", artistName: "Artist", idempotencyKey: "article-test-1" } });
    expect(result.structuredContent).toMatchObject({ draftId: 321, status: "draft", headline: "New Draft" });
    expect(createUnpublishedEditorialDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "New Draft", content: "## Story\n\nBody.", idempotencyKey: "article-test-1" }));
    expect(createUnpublishedEditorialDraft.mock.calls[0]?.[0]).not.toHaveProperty("isPublished");
    await client.close();
    await server.close();
  });

  it("keeps the endpoint authenticated and bounded", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    const recordSource = readFileSync(resolve(process.cwd(), "server/editorial-draft-record.ts"), "utf8");
    expect(source).toContain('app.all("/api/mcp"');
    expect(source).toContain("isValidMcpApiKey");
    expect(source).toContain('status(401).json({ error: "MCP authentication required" })');
    expect(source).toContain('status(429).json({ error: "MCP rate limit exceeded; retry after one minute" })');
    expect(source).toContain('express.json({ limit: "1mb" })');
    expect(recordSource).toContain("isPublished: false");
    expect(recordSource).toContain("idempotencyKey");
  });
});
