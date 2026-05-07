import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// ─── Instagram feed cache (5 min TTL) ────────────────────────
interface IgPost {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  likes: number;
  comments: number;
  timestamp: string;
}
let igCache: { posts: IgPost[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchInstagramPosts(): Promise<IgPost[]> {
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_USER_ID;
  if (!igToken || !igUserId) return [];
  try {
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp";
    const url = `https://graph.instagram.com/${igUserId}/media?fields=${fields}&limit=20&access_token=${igToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IG API ${res.status}`);
    const data = await res.json() as { data: any[] };
    return (data.data || []).map((p: any) => ({
      id: p.id,
      caption: p.caption || "",
      mediaType: p.media_type,
      mediaUrl: p.media_url || "",
      thumbnailUrl: p.thumbnail_url,
      permalink: p.permalink,
      likes: p.like_count || 0,
      comments: p.comments_count || 0,
      timestamp: p.timestamp,
    }));
  } catch (err) {
    console.error("[IG Feed] Failed:", err);
    return [];
  }
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ── Instagram live feed ──────────────────────────────────
  instagram: router({
    feed: publicProcedure.query(async () => {
      const now = Date.now();
      if (igCache && now - igCache.fetchedAt < CACHE_TTL_MS) return igCache.posts;
      const posts = await fetchInstagramPosts();
      igCache = { posts, fetchedAt: now };
      return posts;
    }),
  }),
});

export type AppRouter = typeof appRouter;
