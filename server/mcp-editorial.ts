import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createUnpublishedEditorialDraft } from "./editorial-draft-record";

const articleInput = {
  artistName: z.string().trim().max(256).optional().describe("Artist or subject name."),
  headline: z.string().trim().min(1).max(512).describe("Article headline."),
  markdownBody: z.string().trim().min(1).max(200_000).describe("Complete Markdown article body."),
  catalogLinks: z.array(z.object({ url: z.string().trim().url(), label: z.string().trim().max(80).optional() })).max(48).default([]).describe("Music, video, social, and reference links."),
  coverImageUrl: z.string().trim().url().optional().describe("Cover image URL."),
  referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]).describe("Supporting image URLs."),
  seoTitle: z.string().trim().max(160).optional(),
  keywords: z.string().trim().max(5000).optional(),
  seoDescription: z.string().trim().max(160).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional().describe("Stable key to safely retry the same submission without creating duplicates."),
};

export function createEditorialMcpServer() {
  const server = new McpServer({ name: "murder-mitten-media-editorial", version: "1.0.0" });
  server.registerTool("create_editorial_draft", {
    title: "Create Editorial Draft",
    description: "Create one complete, unpublished Murder Mitten Media Editorial Desk article draft. This tool never publishes, deletes, or edits an existing article. Review and publish separately in the admin Editorial Desk.",
    inputSchema: articleInput,
    outputSchema: {
      draftId: z.number().int().positive(),
      status: z.literal("draft"),
      headline: z.string(),
      adminEditUrl: z.string().url(),
      duplicate: z.boolean(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    const draft = await createUnpublishedEditorialDraft({
      artistName: input.artistName,
      title: input.headline,
      content: input.markdownBody,
      catalogLinks: input.catalogLinks,
      thumbnailUrl: input.coverImageUrl,
      referenceImages: input.referenceImageUrls,
      seoTitle: input.seoTitle,
      keywords: input.keywords,
      seoDescription: input.seoDescription,
      idempotencyKey: input.idempotencyKey,
    });
    const result = {
      draftId: draft.id,
      status: draft.status,
      headline: draft.headline,
      adminEditUrl: `https://murdermittenmedia.com/admin?tab=settings&articleId=${draft.id}`,
      duplicate: "duplicate" in draft ? Boolean(draft.duplicate) : false,
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });
  return server;
}
