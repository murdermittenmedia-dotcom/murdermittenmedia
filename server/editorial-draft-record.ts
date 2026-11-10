import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { articles } from "../drizzle/schema";
import { getArticleById, generateSlug, getDb } from "./db";
import { normalizeArticleCatalogLinks } from "./article-media";

export type EditorialDraftInput = {
  artistName?: string;
  title: string;
  content: string;
  catalogLinks?: Array<{ url: string; label?: string }>;
  thumbnailUrl?: string;
  referenceImages?: string[];
  keywords?: string;
  seoTitle?: string;
  seoDescription?: string;
  idempotencyKey?: string;
};

function cleanUrl(value: string, field: string) {
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/.test(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${field} contains an invalid URL.` });
  }
}

export async function createUnpublishedEditorialDraft(input: EditorialDraftInput) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || title.length > 512) throw new TRPCError({ code: "BAD_REQUEST", message: "Headline is required and must be 512 characters or fewer." });
  if (!content || content.length > 200_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Markdown article body is required and must be 200,000 characters or fewer." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const catalogLinks = (input.catalogLinks ?? []).map(link => ({ url: cleanUrl(link.url, "Catalog links"), ...(link.label?.trim() ? { label: link.label.trim().slice(0, 80) } : {}) })).slice(0, 48);
  const referenceImages = (input.referenceImages ?? []).map(url => cleanUrl(url, "Reference images")).slice(0, 12);
  const thumbnailUrl = input.thumbnailUrl?.trim() ? cleanUrl(input.thumbnailUrl, "Cover image") : null;
  const slug = await generateSlug(title);
  const fingerprint = input.idempotencyKey?.trim() || `${title}\n${content}`;
  const instagramPostId = `mcp-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 48)}`;
  const duplicate = await db.select({ id: articles.id, slug: articles.slug, title: articles.title, isPublished: articles.isPublished }).from(articles).where(eq(articles.instagramPostId, instagramPostId)).limit(1);
  if (duplicate[0]) {
    if (duplicate[0].isPublished) throw new TRPCError({ code: "CONFLICT", message: "That idempotency key belongs to an article that is no longer an unpublished draft." });
    return { id: duplicate[0].id, slug: duplicate[0].slug, status: "draft" as const, headline: duplicate[0].title, duplicate: true };
  }
  const values = {
    instagramPostId,
    artistName: input.artistName?.trim().slice(0, 256) || null,
    catalogLinks: catalogLinks.length ? JSON.stringify(normalizeArticleCatalogLinks(catalogLinks)) : null,
    title,
    slug,
    caption: content.slice(0, 240),
    content,
    referenceImages: referenceImages.length ? JSON.stringify(referenceImages) : null,
    thumbnailUrl,
    instagramImageUrl: null,
    mediaType: "ARTICLE",
    mediaUrl: null,
    likeCount: 0,
    commentCount: 0,
    permalink: null,
    publishedAt: null,
    isPublished: false,
    seoTitle: input.seoTitle?.trim().slice(0, 160) || title.slice(0, 160),
    seoDescription: input.seoDescription?.trim().slice(0, 160) || content.replace(/[#>*_`\[\]]/g, "").slice(0, 160),
    keywords: input.keywords?.trim().slice(0, 5000) || null,
    updatedAt: new Date(),
  };
  const result = await db.insert(articles).values(values);
  const id = Number((result as any)[0]?.insertId ?? 0);
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Draft was not created." });
  const article = await getArticleById(id);
  return { id, slug: article?.slug ?? slug, status: "draft" as const, headline: title };
}
