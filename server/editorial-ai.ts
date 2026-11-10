import { TRPCError } from "@trpc/server";
import { parsePastedArticleLinks } from "@shared/article-links";
import { invokeLLM } from "./_core/llm";

export type EditorialArticleDraft = {
  artistName: string;
  title: string;
  content: string;
  catalogLinks: Array<{ url: string; label?: string }>;
  thumbnailUrl: string;
  referenceImages: string[];
  keywords: string;
  seoTitle: string;
  seoDescription: string;
};

export async function generateEditorialArticleDraft(sourceText: string): Promise<EditorialArticleDraft> {
  const suppliedLinks = parsePastedArticleLinks(sourceText);
  const allowedUrls = new Set(suppliedLinks.map(link => link.url));
  const result = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "You are the Murder Mitten Media editorial desk assistant. Turn the supplied notes, transcript, or brief into a publishable, accurate article draft. Use only facts present in the source; do not invent quotes, dates, releases, affiliations, achievements, or links. Write in a confident, professional Michigan music and culture publication voice. Return Markdown body text with useful ## section headings when the source supports them. Extract every source URL into catalogLinks, preserving labels when present. Never create, modify, or guess a URL. If a field is not supported by the source, return an empty string or empty array. Keep the headline specific and the SEO fields concise.",
      },
      { role: "user", content: `Fill the Editorial Desk form from this source material:\n\n${sourceText}` },
    ],
    outputSchema: {
      name: "editorial_article_draft",
      strict: true,
      schema: {
        type: "object",
        properties: {
          artistName: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          catalogLinks: { type: "array", items: { type: "object", properties: { url: { type: "string" }, label: { type: "string" } }, required: ["url", "label"], additionalProperties: false }, maxItems: 48 },
          thumbnailUrl: { type: "string" },
          referenceImages: { type: "array", items: { type: "string" }, maxItems: 12 },
          keywords: { type: "string" },
          seoTitle: { type: "string" },
          seoDescription: { type: "string" },
        },
        required: ["artistName", "title", "content", "catalogLinks", "thumbnailUrl", "referenceImages", "keywords", "seoTitle", "seoDescription"],
        additionalProperties: false,
      },
    },
  });
  const raw = result.choices[0]?.message.content;
  let draft: any;
  try { draft = typeof raw === "string" ? JSON.parse(raw) : null; } catch { draft = null; }
  if (!draft || typeof draft.artistName !== "string" || typeof draft.title !== "string" || typeof draft.content !== "string" || !Array.isArray(draft.catalogLinks)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ChatGPT returned an incomplete article draft. Please try again." });
  }
  const catalogLinks = draft.catalogLinks
    .filter((link: any) => link && typeof link.url === "string" && allowedUrls.has(link.url))
    .map((link: any) => ({ url: link.url, ...(typeof link.label === "string" && link.label.trim() ? { label: link.label.trim().slice(0, 80) } : {}) }));
  const referenceImages = Array.isArray(draft.referenceImages) ? draft.referenceImages.filter((url: unknown) => typeof url === "string" && /^https?:\/\//i.test(url)).slice(0, 12) : [];
  return {
    artistName: draft.artistName.trim().slice(0, 256),
    title: draft.title.trim().slice(0, 512),
    content: draft.content.trim().slice(0, 200_000),
    catalogLinks,
    thumbnailUrl: typeof draft.thumbnailUrl === "string" && /^https?:\/\//i.test(draft.thumbnailUrl) ? draft.thumbnailUrl.trim().slice(0, 512) : "",
    referenceImages,
    keywords: typeof draft.keywords === "string" ? draft.keywords.trim().slice(0, 5000) : "",
    seoTitle: typeof draft.seoTitle === "string" ? draft.seoTitle.trim().slice(0, 160) : "",
    seoDescription: typeof draft.seoDescription === "string" ? draft.seoDescription.trim().slice(0, 160) : "",
  };
}
