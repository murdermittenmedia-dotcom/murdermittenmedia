import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getQueueSubmissions, addSubmission, updateSubmissionStatus,
  confirmSkipPayment, getQueueState, setCurrentPlaying, setLiveStatus,
  getActiveArtistOfWeek, getAllArtistsOfWeek, upsertArtistOfWeek,
} from "./db";

// --- Instagram feed cache (5 min TTL) ------------------------
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

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // -- Instagram live feed --------------------------------------
  instagram: router({
    feed: publicProcedure.query(async () => {
      const now = Date.now();
      if (igCache && now - igCache.fetchedAt < CACHE_TTL_MS) return igCache.posts;
      const posts = await fetchInstagramPosts();
      igCache = { posts, fetchedAt: now };
      return posts;
    }),
  }),

  // -- Review Queue ---------------------------------------------
  queue: router({
    getAll: publicProcedure.query(async () => {
      const [submissions, state] = await Promise.all([
        getQueueSubmissions(),
        getQueueState(),
      ]);
      const currentPlaying = state?.currentPlayingId
        ? submissions.find(s => s.id === state.currentPlayingId) ?? null
        : null;
      return { submissions, state, currentPlaying };
    }),

    submit: publicProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        songTitle: z.string().min(1).max(128),
        submissionType: z.enum(["youtube", "file"]),
        youtubeUrl: z.string().optional(),
        contactInfo: z.string().max(256).optional(),
        wantsSkip: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        await addSubmission({
          artistName: input.artistName,
          songTitle: input.songTitle,
          submissionType: input.submissionType,
          youtubeUrl: input.youtubeUrl ?? null,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip,
          skipPaymentConfirmed: false,
          status: "pending",
          position: 0,
        });
        return { success: true };
      }),

    setPlaying: adminProcedure
      .input(z.object({ submissionId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        if (input.submissionId !== null) {
          await updateSubmissionStatus(input.submissionId, "playing");
        }
        await setCurrentPlaying(input.submissionId);
        return { success: true };
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "playing", "reviewed", "removed"]),
      }))
      .mutation(async ({ input }) => {
        await updateSubmissionStatus(input.id, input.status);
        return { success: true };
      }),

    confirmSkip: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await confirmSkipPayment(input.id);
        return { success: true };
      }),

    setLive: adminProcedure
      .input(z.object({ isLive: z.boolean(), message: z.string().optional() }))
      .mutation(async ({ input }) => {
        await setLiveStatus(input.isLive, input.message);
        return { success: true };
      }),
  }),

  // -- Artist of the Week ---------------------------------------
  artistOfWeek: router({
    getCurrent: publicProcedure.query(async () => {
      return getActiveArtistOfWeek();
    }),

    getAll: publicProcedure.query(async () => {
      return getAllArtistsOfWeek();
    }),

    set: adminProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        bio: z.string().optional(),
        imageUrl: z.string().optional(),
        instagramUrl: z.string().optional(),
        youtubeUrl: z.string().optional(),
        spotifyUrl: z.string().optional(),
        featuredVideoId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertArtistOfWeek({
          artistName: input.artistName,
          bio: input.bio ?? null,
          imageUrl: input.imageUrl ?? null,
          instagramUrl: input.instagramUrl ?? null,
          youtubeUrl: input.youtubeUrl ?? null,
          spotifyUrl: input.spotifyUrl ?? null,
          featuredVideoId: input.featuredVideoId ?? null,
          isActive: true,
          weekOf: new Date(),
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
