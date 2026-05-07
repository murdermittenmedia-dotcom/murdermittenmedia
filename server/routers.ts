import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGetSignedUrl } from "./storage";
import {
  getQueueSubmissions, getReviewedSubmissions, addSubmission, updateSubmissionStatus,
  confirmSkipPayment, getQueueState, setCurrentPlaying, setLiveStatus,
  getActiveArtistOfWeek, getAllArtistsOfWeek, upsertArtistOfWeek,
  getActiveWheelEntries, getAllWheelEntries, addWheelEntry,
  updateWheelEntryStatus, confirmWheelPayment, getUserWheelEntries,
  getSetting, setSetting, getAllSettings,
  getChatMessages, deleteChatMessage,
  createBattleRecord, getAllBattleRecords, getArtistStats,
  getBattleLeaderboard, getBattleRecordsByArtistName,
  addUserSong, getUserSongs, deleteUserSong, updateUserSongVisibility,
  getArtistProfile, updateUserProfile, getUserById,
  getAllUsers, setUserRole,
  getSubmissionsByArtistName, getLifetimeStats,
  getActiveBattle, setActiveBattle, updateActiveBattleStatus, clearBattleVotes,
  castVote, getVoteResults, getUserVote,
  castSongReaction, getSongReactionCounts, getUserSongReaction,
  applyAsJudge, getPendingJudgeApplications, reviewJudgeApplication, getUserJudgeApplication,
  getRelevantUsers, getPlayersWithStats, fullWarReset, getCurrentWarSession,
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

  // -- User Profile ---------------------------------------------
  profile: router({
    // Update own profile (artist name + IG handle)
    update: protectedProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        instagramHandle: z.string().max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, {
          artistName: input.artistName,
          instagramHandle: input.instagramHandle,
        });
        return { success: true };
      }),

    // Get own full profile
    me: protectedProcedure.query(async ({ ctx }) => {
      return getArtistProfile(ctx.user.id);
    }),

    // Get any artist's public profile by userId
    getById: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getArtistProfile(input.userId);
      }),

    // Get artist stats + battles by artist name (for non-registered artists)
    getByName: publicProcedure
      .input(z.object({ artistName: z.string() }))
      .query(async ({ input }) => {
        return getArtistStats(input.artistName);
      }),

    // Get all review submissions for the current user (profile history)
    getSubmissions: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getArtistProfile(ctx.user.id);
      const name = profile?.artistName ?? ctx.user.name ?? "";
      if (!name) return [];
      return getSubmissionsByArtistName(name);
    }),

    // Get lifetime stats for the current user
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getArtistProfile(ctx.user.id);
      const name = profile?.artistName ?? ctx.user.name ?? "";
      if (!name) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0 };
      return getLifetimeStats(name);
    }),

    // Upload profile picture (base64 image, max ~4MB)
    uploadAvatar: protectedProcedure
      .input(z.object({
        base64: z.string().max(6_000_000), // ~4MB base64
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1];
        const key = `avatars/user-${ctx.user.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateUserProfile(ctx.user.id, { avatarUrl: url });
        return { avatarUrl: url };
      }),
  }),

  // -- Song Catalogue -------------------------------------------
  songs: router({
    // Get own songs (including private)
    mine: protectedProcedure.query(async ({ ctx }) => {
      return getUserSongs(ctx.user.id, true);
    }),

    // Get public songs for any user
    byUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getUserSongs(input.userId, false);
      }),

    // Add a song via external URL (YouTube/SoundCloud)
    addExternal: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(128),
        artistName: z.string().min(1).max(128),
        externalUrl: z.string().url().max(512),
        genre: z.string().max(64).optional(),
        isPublic: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        await addUserSong({
          userId: ctx.user.id,
          title: input.title,
          artistName: input.artistName,
          externalUrl: input.externalUrl,
          genre: input.genre ?? null,
          isPublic: input.isPublic,
        });
        return { success: true };
      }),

    // Upload audio file (base64 encoded, max ~10MB)
    uploadAudio: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(128),
        artistName: z.string().min(1).max(128),
        genre: z.string().max(64).optional(),
        isPublic: z.boolean().default(true),
        fileName: z.string(),
        fileBase64: z.string(), // base64 encoded audio
        mimeType: z.string().default("audio/mpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Decode base64 and upload to S3
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 15 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File must be under 15MB" });
        }
        const ext = input.fileName.split(".").pop() || "mp3";
        const key = `songs/${ctx.user.id}/${Date.now()}-${input.title.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await addUserSong({
          userId: ctx.user.id,
          title: input.title,
          artistName: input.artistName,
          fileKey: key,
          fileUrl: url,
          genre: input.genre ?? null,
          isPublic: input.isPublic,
        });
        return { success: true, url };
      }),

    // Delete own song
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteUserSong(input.id, ctx.user.id);
        return { success: true };
      }),

    // Toggle visibility
    setVisibility: protectedProcedure
      .input(z.object({ id: z.number(), isPublic: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await updateUserSongVisibility(input.id, ctx.user.id, input.isPublic);
        return { success: true };
      }),
  }),

  // -- Battle Records -------------------------------------------
  battles: router({
    // All battles (public leaderboard)
    getAll: publicProcedure.query(async () => {
      return getAllBattleRecords(100);
    }),

    // Leaderboard ranked by wins
    leaderboard: publicProcedure.query(async () => {
      return getBattleLeaderboard();
    }),

    // Battles for a specific artist name
    byArtist: publicProcedure
      .input(z.object({ artistName: z.string() }))
      .query(async ({ input }) => {
        return getBattleRecordsByArtistName(input.artistName);
      }),

    // Record a battle result (admin only)
    record: adminProcedure
      .input(z.object({
        roundNumber: z.number().default(1),
        winnerArtistName: z.string().min(1).max(128),
        winnerSongTitle: z.string().min(1).max(128),
        winnerSongUrl: z.string().optional(),
        winnerId: z.number().optional(),
        loserArtistName: z.string().min(1).max(128),
        loserSongTitle: z.string().min(1).max(128),
        loserSongUrl: z.string().optional(),
        loserId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await createBattleRecord({
          roundNumber: input.roundNumber,
          winnerArtistName: input.winnerArtistName,
          winnerSongTitle: input.winnerSongTitle,
          winnerSongUrl: input.winnerSongUrl ?? null,
          winnerId: input.winnerId ?? null,
          loserArtistName: input.loserArtistName,
          loserSongTitle: input.loserSongTitle,
          loserSongUrl: input.loserSongUrl ?? null,
          loserId: input.loserId ?? null,
          notes: input.notes ?? null,
          battleDate: new Date(),
        });
        return { success: true };
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
      .input(z.object({ isLive: z.boolean(), message: z.string().optional(), streamUrl: z.string().max(512).optional() }))
      .mutation(async ({ input }) => {
        await setLiveStatus(input.isLive, input.message, input.streamUrl);
        return { success: true };
      }),

    // Upload audio file directly for a queue submission
    uploadTrack: protectedProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        songTitle: z.string().min(1).max(128),
        fileKey: z.string(),
        fileUrl: z.string(),
        contactInfo: z.string().max(256).optional(),
        wantsSkip: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        await addSubmission({
          artistName: input.artistName,
          songTitle: input.songTitle,
          submissionType: "file",
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip,
          skipPaymentConfirmed: false,
          status: "pending",
          position: 0,
        });
        return { success: true };
      }),

    // Upload audio file bytes (base64) for a queue submission
    uploadAudio: publicProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        songTitle: z.string().min(1).max(128),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default("audio/mpeg"),
        contactInfo: z.string().max(256).optional(),
        wantsSkip: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 20 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File must be under 20MB" });
        }
        const ext = input.fileName.split(".").pop() || "mp3";
        const key = `queue-submissions/${Date.now()}-${input.artistName.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await addSubmission({
          artistName: input.artistName,
          songTitle: input.songTitle,
          submissionType: "file",
          fileKey: key,
          fileUrl: url,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip,
          skipPaymentConfirmed: false,
          status: "pending",
          position: 0,
        });
        return { success: true };
      }),

    // Get past reviewed submissions (history)
    getReviewed: publicProcedure.query(async () => {
      return getReviewedSubmissions(50);
    }),

    // 🔥 / 🗑️ reaction on a submission (one per user per submission)
    react: protectedProcedure
      .input(z.object({
        submissionId: z.number(),
        reaction: z.enum(["fire", "trash"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await castSongReaction(input.submissionId, ctx.user.id, input.reaction);
        return { success: true };
      }),

    // Get fire/trash counts for a submission
    getReactions: publicProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ input }) => {
        return getSongReactionCounts(input.submissionId);
      }),

    // Get the current user's reaction for a submission
    getMyReaction: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getUserSongReaction(input.submissionId, ctx.user.id);
      }),

    // Get a direct presigned S3 URL for a stored audio file (bypasses redirect)
    getAudioUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await storageGetSignedUrl(input.fileKey);
        return { url };
      }),
  }),
  // -- Artist of the Weekk ---------------------------------------
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
        audioTrackUrl: z.string().max(512).optional(),
        audioTrackTitle: z.string().max(128).optional(),
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
          audioTrackUrl: input.audioTrackUrl ?? null,
          audioTrackTitle: input.audioTrackTitle ?? null,
          isActive: true,
          weekOf: new Date(),
        });
        return { success: true };
      }),
  }),

  // -- Music Wars Wheel -----------------------------------------
  wheel: router({
    getEntries: publicProcedure.query(async () => {
      const [entries, settings] = await Promise.all([
        getActiveWheelEntries(),
        getAllSettings(),
      ]);
      return {
        entries,
        isPaid: settings["wheel_paid_mode"] === "true",
        isOpen: settings["wheel_open"] !== "false",
        entryFee: settings["wheel_entry_fee"] ?? "10",
        currentRound: parseInt(settings["wheel_current_round"] ?? "1"),
      };
    }),

    getAllEntries: adminProcedure.query(async () => {
      return getAllWheelEntries();
    }),

    submit: publicProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        songTitle: z.string().min(1).max(128),
        songUrl: z.string().max(512).optional(),
        contactInfo: z.string().max(256).optional(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const isPaid = (await getSetting("wheel_paid_mode")) === "true";
        await addWheelEntry({
          userId: input.userId ?? null,
          artistName: input.artistName,
          songTitle: input.songTitle,
          songUrl: input.songUrl ?? null,
          contactInfo: input.contactInfo ?? null,
          paid: isPaid,
          paymentConfirmed: !isPaid,
          status: isPaid ? "pending" : "active",
          wheelPosition: 0,
          roundNumber: 1,
        });
        return { success: true, requiresPayment: isPaid };
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "active", "eliminated", "winner", "removed"]),
      }))
      .mutation(async ({ input }) => {
        await updateWheelEntryStatus(input.id, input.status);
        return { success: true };
      }),

    confirmPayment: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await confirmWheelPayment(input.id);
        return { success: true };
      }),

    getUserEntries: protectedProcedure.query(async ({ ctx }) => {
      return getUserWheelEntries(ctx.user.id);
    }),

    setSettings: adminProcedure
      .input(z.object({
        isPaid: z.boolean().optional(),
        isOpen: z.boolean().optional(),
        entryFee: z.string().optional(),
        currentRound: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.isPaid !== undefined) await setSetting("wheel_paid_mode", String(input.isPaid));
        if (input.isOpen !== undefined) await setSetting("wheel_open", String(input.isOpen));
        if (input.entryFee !== undefined) await setSetting("wheel_entry_fee", input.entryFee);
        if (input.currentRound !== undefined) await setSetting("wheel_current_round", String(input.currentRound));
        return { success: true };
      }),

    // Remove a single wheel entry (admin)
    removeEntry: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateWheelEntryStatus(input.id, "removed");
        return { success: true };
      }),

    // Mark an entry as "called" (picked by wheel) — auto-removes from future spins
    markCalled: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateWheelEntryStatus(input.id, "eliminated");
        return { success: true };
      }),

    // Advance all winners to next war (copy winner entries as new active entries)
    advanceWinners: adminProcedure.mutation(async () => {
      const entries = await getAllWheelEntries();
      const winners = entries.filter(e => e.status === "winner");
      await Promise.all(winners.map(w => addWheelEntry({
        userId: w.userId ?? null,
        artistName: w.artistName,
        songTitle: w.songTitle,
        songUrl: w.songUrl ?? null,
        contactInfo: null,
        paid: false,
        paymentConfirmed: true,
        status: "active",
        wheelPosition: 0,
        roundNumber: (w.roundNumber ?? 1) + 1,
      })));
      return { success: true, advancedCount: winners.length };
    }),

    // Get queue position for the logged-in user
    getQueuePosition: protectedProcedure.query(async ({ ctx }) => {
      const entries = await getAllWheelEntries();
      const active = entries.filter(e => e.status === "active");
      const myIdx = active.findIndex(e => e.userId === ctx.user.id);
      if (myIdx === -1) return { inQueue: false, position: 0, ahead: 0 };
      return { inQueue: true, position: myIdx + 1, ahead: myIdx };
    }),

    // Set the two battle contestants from wheel entries (admin picks, marks them called)
    setBattleContestants: adminProcedure
      .input(z.object({
        contestant1Id: z.number(),
        contestant2Id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const entries = await getAllWheelEntries();
        const c1 = entries.find(e => e.id === input.contestant1Id);
        const c2 = entries.find(e => e.id === input.contestant2Id);
        if (!c1 || !c2) throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
        // Mark both as eliminated (removed from wheel)
        await updateWheelEntryStatus(input.contestant1Id, "eliminated");
        await updateWheelEntryStatus(input.contestant2Id, "eliminated");
        // Set active battle with song info
        await setActiveBattle({
          contestant1Name: c1.artistName,
          contestant1SongTitle: c1.songTitle ?? undefined,
          contestant1SongUrl: c1.songUrl ?? undefined,
          contestant2Name: c2.artistName,
          contestant2SongTitle: c2.songTitle ?? undefined,
          contestant2SongUrl: c2.songUrl ?? undefined,
          roundNumber: 1,
          status: "voting",
        });
        // Notify users if they have accounts
        const notifyUser = async (entry: typeof c1, picked: boolean) => {
          if (!entry?.userId) return;
          await setSetting(`notify_user_${entry.userId}`, JSON.stringify({
            type: "picked",
            message: picked ? "You've been picked to compete next!" : "You're up after the current battle!",
            timestamp: Date.now(),
          }));
        };
        await notifyUser(c1, true);
        await notifyUser(c2, true);
        return { success: true, contestant1: c1, contestant2: c2 };
      }),

    // Get notification for current user
    getMyNotification: protectedProcedure.query(async ({ ctx }) => {
      const raw = await getSetting(`notify_user_${ctx.user.id}`);
      if (!raw) return null;
      try { return JSON.parse(raw) as { type: string; message: string; timestamp: number }; }
      catch { return null; }
    }),

    // Dismiss notification
    dismissNotification: protectedProcedure.mutation(async ({ ctx }) => {
      await setSetting(`notify_user_${ctx.user.id}`, "");
      return { success: true };
    }),

    // Full war reset: delete ALL wheel entries, votes, and close active battle
    resetCurrentWar: adminProcedure.mutation(async () => {
      await fullWarReset();
      return { success: true };
    }),
  }),

  // -- Live Chat ------------------------------------------------
  chat: router({
    getHistory: publicProcedure
      .input(z.object({ room: z.enum(["music_wars", "music_review"]) }))
      .query(async ({ input }) => {
        return getChatMessages(input.room, 50);
      }),

    deleteMessage: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteChatMessage(input.id);
        return { success: true };
      }),
  }),

  // -- Site Settings (admin) ------------------------------------
  settings: router({
    getAll: publicProcedure.query(async () => {
      return getAllSettings();
    }),

    set: adminProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSetting(input.key, input.value);
        return { success: true };
      }),
  }),

  // -- Judge Applications -------------------------------------
  judgeApps: router({
    // User applies to become a judge
    submitApplication: protectedProcedure
      .input(z.object({ reason: z.string().max(512).optional() }))
      .mutation(async ({ ctx, input }) => {
        // Pass user's artistName from their profile
        const profile = await getArtistProfile(ctx.user.id);
        const artistName = profile?.artistName ?? ctx.user.name ?? null;
        await applyAsJudge(ctx.user.id, artistName, input.reason ?? null);
        return { success: true };
      }),

    // Get own application status
    getMine: protectedProcedure.query(async ({ ctx }) => {
      return getUserJudgeApplication(ctx.user.id);
    }),

    // Admin: list all pending applications
    listPending: adminProcedure.query(async () => {
      return getPendingJudgeApplications();
    }),

    // Admin: approve or reject an application by application ID
    review: adminProcedure
      .input(z.object({
        applicationId: z.number(),
        approved: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const status = input.approved ? "approved" : "rejected";
        await reviewJudgeApplication(input.applicationId, status);
        return { success: true };
      }),
  }),

  // -- User Role Management (admin-only) ------------------------
  users: router({
    // List relevant users (on wheel OR applied as judge) — admin only
    list: adminProcedure.query(async () => {
      return getRelevantUsers();
    }),

    // List ALL users (admin only, for full management)
    listAll: adminProcedure.query(async () => {
      return getAllUsers(500);
    }),

    // Promote/demote a user's role (admin only)
    setRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "judge", "contestant", "admin"]),
      }))
      .mutation(async ({ input }) => {
        await setUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // -- Players / War Stats ------------------------------------
  players: router({
    // Get all players with lifetime + current war stats
    withStats: publicProcedure.query(async () => {
      return getPlayersWithStats();
    }),

    // Get current war session number
    currentWarSession: publicProcedure.query(async () => {
      const session = await getCurrentWarSession();
      return { session };
    }),
  }),

  // -- Live Voting ----------------------------------------------
  voting: router({
    // Get current active battle
    getActiveBattle: publicProcedure.query(async () => {
      return getActiveBattle();
    }),

    // Get live vote results for a battle
    getResults: publicProcedure
      .input(z.object({ battleId: z.number() }))
      .query(async ({ input }) => {
        return getVoteResults(input.battleId);
      }),

    // Get current user's vote for a battle
    getMyVote: protectedProcedure
      .input(z.object({ battleId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getUserVote(input.battleId, ctx.user.id);
      }),

    // Cast a vote (all voters = weight 1, judges shown with JUDGE badge for transparency)
    cast: protectedProcedure
      .input(z.object({
        battleId: z.number(),
        candidate: z.enum(["contestant1", "contestant2"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const weight = 1; // all votes equal weight
        const voterRole = ctx.user.role === "judge" ? "judge" : ctx.user.role === "admin" ? "admin" : "user";
        await castVote({
          battleId: input.battleId,
          voterId: ctx.user.id,
          voterRole,
          candidate: input.candidate,
          weight,
          voterName: ctx.user.name ?? ctx.user.email ?? "Anonymous",
        });
        return { success: true, weight };
      }),

    // Admin: set the active battle matchup
    setActiveBattle: adminProcedure
      .input(z.object({
        contestant1Name: z.string().min(1).max(128),
        contestant1SongTitle: z.string().max(128).optional(),
        contestant1SongUrl: z.string().max(512).optional(),
        contestant2Name: z.string().min(1).max(128),
        contestant2SongTitle: z.string().max(128).optional(),
        contestant2SongUrl: z.string().max(512).optional(),
        roundNumber: z.number().default(1),
        status: z.enum(["pending", "voting", "closed"]).default("voting"),
      }))
      .mutation(async ({ input }) => {
        await setActiveBattle({
          contestant1Name: input.contestant1Name,
          contestant1SongTitle: input.contestant1SongTitle ?? null,
          contestant1SongUrl: input.contestant1SongUrl ?? null,
          contestant2Name: input.contestant2Name,
          contestant2SongTitle: input.contestant2SongTitle ?? null,
          contestant2SongUrl: input.contestant2SongUrl ?? null,
          roundNumber: input.roundNumber,
          status: input.status,
        });
        return { success: true };
      }),

    // Admin: clear all votes for a battle
    clearVotes: adminProcedure
      .input(z.object({ battleId: z.number() }))
      .mutation(async ({ input }) => {
        await clearBattleVotes(input.battleId);
        return { success: true };
      }),
  }),

  // -- Next Event Scheduler (admin) -----------------------------
  events: router({
    // Get next scheduled Music Wars event
    getNext: publicProcedure.query(async () => {
      const [title, dateStr, streamUrl, isLive] = await Promise.all([
        getSetting("next_event_title"),
        getSetting("next_event_date"),
        getSetting("music_wars_stream_url"),
        getSetting("music_wars_live"),
      ]);
      return {
        title: title ?? null,
        date: dateStr ? new Date(dateStr) : null,
        streamUrl: streamUrl ?? null,
        isLive: isLive === "true",
      };
    }),

    // Admin: set next event details
    setNext: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        date: z.string(), // ISO date string
        streamUrl: z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => {
        await setSetting("next_event_title", input.title);
        await setSetting("next_event_date", input.date);
        if (input.streamUrl) await setSetting("music_wars_stream_url", input.streamUrl);
        return { success: true };
      }),

    // Admin: toggle live status for Music Wars stream
    setLive: adminProcedure
      .input(z.object({ isLive: z.boolean(), streamUrl: z.string().max(512).optional() }))
      .mutation(async ({ input }) => {
        await setSetting("music_wars_live", String(input.isLive));
        if (input.streamUrl) await setSetting("music_wars_stream_url", input.streamUrl);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
