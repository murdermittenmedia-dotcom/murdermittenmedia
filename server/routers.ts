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
  getLiveRadioState, getLiveRadioQueue, addToLiveRadioQueue, removeFromLiveRadioQueue,
  clearLiveRadioQueue, setLiveRadioCurrentTrack, setLiveRadioPaused, stopLiveRadio,
  getForumPosts, getForumPostById, createForumPost, deleteForumPost,
  getForumComments, createForumComment, deleteForumComment,
  reactToForumItem, getForumReactionCounts, getUserForumReactions,
  searchUsers, searchSongs,
  getCombinedLeaderboard,
  getWheelSpinState, setWheelSpinState, clearWheelSpinState,
  createModerationLog, getModerationLogs,
  banUser, unbanUser,
  getSkipLineOrders, getWheelPaidOrders,
  getAdminAnalytics,
  deleteUser, resetAllStats, resetAllSubmissions,
  addWheelOfNamesEntry, getWheelOfNamesEntries, getUserWheelOfNamesEntry,
  clearWheelOfNamesEntries, getLastWheelOfNamesWinner, createWheelOfNamesSpin,
  getTodaysWheelOfNamesSpin, createWheelOfNamesPaidEntryRequest,
  getPendingWheelOfNamesPaidEntries, confirmWheelOfNamesPaidEntry,
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
    // Update own profile (artist name + IG handle + city)
    update: protectedProcedure
      .input(z.object({
        artistName: z.string().min(1).max(128),
        instagramHandle: z.string().max(64).optional(),
        city: z.string().max(128).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, {
          artistName: input.artistName,
          instagramHandle: input.instagramHandle,
          city: input.city,
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
      if (!name) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0, totalWins: 0 };
      return getLifetimeStats(name);
    }),

    // Get lifetime stats for any user by userId (public — for visiting profiles)
    getStatsByUserId: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const profile = await getArtistProfile(input.userId);
        if (!profile) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0, totalWins: 0 };
        const name = profile.artistName ?? "";
        if (!name) return { totalSubmissions: 0, totalFire: 0, totalTrash: 0, reviewed: 0, totalWins: 0 };
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

    // Add a song via external URL (YouTube only)
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
    // Get a direct presigned S3 URL for a user song file
    getAudioUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await storageGetSignedUrl(input.fileKey);
        return { url };
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

    // Get a direct presigned S3 URL for a queue submission audio file
    getAudioUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await storageGetSignedUrl(input.fileKey);
        return { url };
      }),

    submit: protectedProcedure
      .input(z.object({
        songTitle: z.string().min(1).max(128),
        submissionType: z.enum(["youtube", "file"]),
        youtubeUrl: z.string().optional(),
        contactInfo: z.string().max(256).optional(),
        wantsSkip: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        // Auto-resolve artist name from the user's registered profile
        const profile = await getArtistProfile(ctx.user.id);
        const artistName = profile?.artistName ?? ctx.user.artistName ?? ctx.user.name ?? "Unknown Artist";
        await addSubmission({
          userId: ctx.user.id,
          artistName,
          songTitle: input.songTitle,
          submissionType: input.submissionType,
          youtubeUrl: input.youtubeUrl ?? null,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip,
          skipPaymentConfirmed: false,
          status: "pending",
          position: 0,
        });
        // Auto-save to artist's music catalogue so it appears on their profile
        try {
          await addUserSong({
            userId: ctx.user.id,
            title: input.songTitle,
            artistName,
            externalUrl: input.youtubeUrl ?? null,
            isPublic: true,
          });
        } catch (e) {
          console.warn("[queue.submit] Failed to auto-save to catalogue:", e);
        }
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
      .mutation(async ({ ctx, input }) => {
        await addSubmission({
          userId: ctx.user.id,
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
    uploadAudio: protectedProcedure
      .input(z.object({
        songTitle: z.string().min(1).max(128),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default("audio/mpeg"),
        contactInfo: z.string().max(256).optional(),
        wantsSkip: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        // Auto-resolve artist name from the user's registered profile
        const profile = await getArtistProfile(ctx.user.id);
        const artistName = profile?.artistName ?? ctx.user.artistName ?? ctx.user.name ?? "Unknown Artist";
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 20 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File must be under 20MB" });
        }
        const ext = input.fileName.split(".").pop() || "mp3";
        const key = `queue-submissions/${Date.now()}-${artistName.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await addSubmission({
          userId: ctx.user.id,
          artistName,
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
        // Auto-save to artist's music catalogue so it appears on their profile
        try {
          await addUserSong({
            userId: ctx.user.id,
            title: input.songTitle,
            artistName,
            fileKey: key,
            fileUrl: url,
            isPublic: true,
          });
        } catch (e) {
          // Non-fatal — submission still goes through even if catalogue insert fails
          console.warn("[queue.uploadAudio] Failed to auto-save to catalogue:", e);
        }
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
  warsWheel: router({
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

    submit: protectedProcedure
      .input(z.object({
        songTitle: z.string().min(1).max(128),
        songUrl: z.string().max(512).optional(),
        contactInfo: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Auto-resolve artist name from the user's registered profile
        const profile = await getArtistProfile(ctx.user.id);
        const artistName = profile?.artistName ?? ctx.user.artistName ?? ctx.user.name ?? "Unknown Artist";
        const isPaid = (await getSetting("wheel_paid_mode")) === "true";
        await addWheelEntry({
          userId: ctx.user.id,
          artistName,
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
        contestant3Id: z.number().optional(),
        isTripleThreat: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const entries = await getAllWheelEntries();
        const c1 = entries.find(e => e.id === input.contestant1Id);
        const c2 = entries.find(e => e.id === input.contestant2Id);
        const c3 = input.contestant3Id ? entries.find(e => e.id === input.contestant3Id) : undefined;
        if (!c1 || !c2) throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
        if (input.contestant3Id && !c3) throw new TRPCError({ code: "NOT_FOUND", message: "Contestant 3 not found" });
        // Mark contestants as eliminated (removed from wheel)
        await updateWheelEntryStatus(input.contestant1Id, "eliminated");
        await updateWheelEntryStatus(input.contestant2Id, "eliminated");
        if (c3) await updateWheelEntryStatus(c3.id, "eliminated");
        // Set active battle with song info
        await setActiveBattle({
          contestant1Name: c1.artistName,
          contestant1SongTitle: c1.songTitle ?? undefined,
          contestant1SongUrl: c1.songUrl ?? undefined,
          contestant2Name: c2.artistName,
          contestant2SongTitle: c2.songTitle ?? undefined,
          contestant2SongUrl: c2.songUrl ?? undefined,
          contestant3Name: c3?.artistName ?? null,
          contestant3SongTitle: c3?.songTitle ?? null,
          contestant3SongUrl: c3?.songUrl ?? null,
          isTripleThreat: input.isTripleThreat ?? !!c3,
          roundNumber: 1,
          status: "voting",
        });
        // Notify users if they have accounts
        const notifyUser = async (entry: typeof c1 | undefined, picked: boolean) => {
          if (!entry?.userId) return;
          await setSetting(`notify_user_${entry.userId}`, JSON.stringify({
            type: "picked",
            message: picked ? "You've been picked to compete next!" : "You're up after the current battle!",
            timestamp: Date.now(),
          }));
        };
        await notifyUser(c1, true);
        await notifyUser(c2, true);
        if (c3) await notifyUser(c3, true);
        return { success: true, contestant1: c1, contestant2: c2, contestant3: c3 ?? null };
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
    resetCurrentWar: adminProcedure.mutation(async ({ ctx }) => {
      await fullWarReset();
      await clearWheelSpinState();
      // Broadcast war reset to all connected clients so they clear votes in real-time
      ctx.io?.to("music_wars").emit("war:reset");
      return { success: true };
    }),

    // Get persistent wheel spin state (survives page refresh)
    getSpinState: publicProcedure.query(async () => {
      return getWheelSpinState();
    }),

    // Admin: save contestant 1 pick to DB (spin 1 complete)
    saveSpinState: adminProcedure
      .input(z.object({
        spinCount: z.union([z.literal(0), z.literal(1)]),
        contestant1Id: z.number().nullable(),
        contestant1Name: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        await setWheelSpinState({
          spinCount: input.spinCount,
          contestant1Id: input.contestant1Id,
          contestant1Name: input.contestant1Name,
        });
        // Broadcast to all clients so they sync immediately
        ctx.io?.to("music_wars").emit("wheel:spin_state", {
          spinCount: input.spinCount,
          contestant1Id: input.contestant1Id,
          contestant1Name: input.contestant1Name,
        });
        return { success: true };
      }),

    // Admin: reset only the spin state (not the full war)
    resetSpinState: adminProcedure.mutation(async ({ ctx }) => {
      await clearWheelSpinState();
      ctx.io?.to("music_wars").emit("wheel:spin_state", {
        spinCount: 0, contestant1Id: null, contestant1Name: null,
      });
      return { success: true };
    }),

    // Mark an entry as "called" with spin state update (admin picks contestant 1)
    markCalledAndSaveState: adminProcedure
      .input(z.object({
        id: z.number(),
        artistName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateWheelEntryStatus(input.id, "eliminated");
        await setWheelSpinState({
          spinCount: 1,
          contestant1Id: input.id,
          contestant1Name: input.artistName,
        });
        ctx.io?.to("music_wars").emit("wheel:spin_state", {
          spinCount: 1,
          contestant1Id: input.id,
          contestant1Name: input.artistName,
        });
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
        candidate: z.enum(["contestant1", "contestant2", "contestant3"]),
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
        contestant3Name: z.string().max(128).optional(),
        contestant3SongTitle: z.string().max(128).optional(),
        contestant3SongUrl: z.string().max(512).optional(),
        isTripleThreat: z.boolean().optional(),
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
          contestant3Name: input.contestant3Name ?? null,
          contestant3SongTitle: input.contestant3SongTitle ?? null,
          contestant3SongUrl: input.contestant3SongUrl ?? null,
          isTripleThreat: input.isTripleThreat ?? !!input.contestant3Name,
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

  // -- Live Radio (admin-controlled broadcast) -----------------
  radio: router({
    // Public: get current live radio state + queue
    getState: publicProcedure.query(async () => {
      const [state, queue] = await Promise.all([getLiveRadioState(), getLiveRadioQueue()]);
      return { state: state ?? null, queue };
    }),

    // Admin: add a submission to the live radio queue
    addTrack: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        artistName: z.string().min(1).max(128),
        fileKey: z.string().max(512).optional(),
        externalUrl: z.string().max(512).optional(),
        sourceType: z.enum(["upload", "youtube", "external"]).default("upload"),
        submissionId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await addToLiveRadioQueue({
          title: input.title,
          artistName: input.artistName,
          fileKey: input.fileKey ?? null,
          externalUrl: input.externalUrl ?? null,
          sourceType: input.sourceType,
          submissionId: input.submissionId ?? null,
        });
        return { success: true };
      }),

    // Admin: remove a track from the queue
    removeTrack: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await removeFromLiveRadioQueue(input.id);
        return { success: true };
      }),

    // Admin: clear entire queue
    clearQueue: adminProcedure.mutation(async () => {
      await clearLiveRadioQueue();
      return { success: true };
    }),

    // Admin: set current playing track (starts live radio)
    setCurrentTrack: adminProcedure
      .input(z.object({ trackId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await setLiveRadioCurrentTrack(input.trackId);
        // Broadcast to all clients via socket
        const io = (ctx.req as any).app?.io;
        if (io) io.emit("radio:state_change", { trackId: input.trackId });
        return { success: true };
      }),

    // Admin: pause/resume
    setPaused: adminProcedure
      .input(z.object({ isPaused: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setLiveRadioPaused(input.isPaused);
        const io = (ctx.req as any).app?.io;
        if (io) io.emit("radio:state_change", { isPaused: input.isPaused });
        return { success: true };
      }),

    // Admin: stop live radio
    stop: adminProcedure.mutation(async ({ ctx }) => {
      await stopLiveRadio();
      const io = (ctx.req as any).app?.io;
      if (io) io.emit("radio:state_change", { isActive: false });
      return { success: true };
    }),

    // Get presigned URL for a live radio track
    getTrackUrl: publicProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await storageGetSignedUrl(input.fileKey);
        return { url };
      }),
  }),

  // -- Forum --------------------------------------------------
  forum: router({
    // Get posts (optionally filtered by category)
    getPosts: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const rows = await getForumPosts(input.category, input.limit, input.offset);
        const postIds = rows.map(r => r.post.id);
        const reactions = await getForumReactionCounts("post", postIds);
        return rows.map(r => ({
          ...r.post,
          author: r.author,
          upvotes: reactions[r.post.id]?.upvote ?? 0,
          downvotes: reactions[r.post.id]?.downvote ?? 0,
        }));
      }),

    // Get a single post with comments
    getPost: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const row = await getForumPostById(input.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        const comments = await getForumComments(input.id);
        const commentIds = comments.map(c => c.comment.id);
        const [postReactions, commentReactions] = await Promise.all([
          getForumReactionCounts("post", [input.id]),
          getForumReactionCounts("comment", commentIds),
        ]);
        let myPostReaction: string | undefined;
        let myCommentReactions: Record<number, string> = {};
        if (ctx.user) {
          const [mpr, mcr] = await Promise.all([
            getUserForumReactions(ctx.user.id, "post", [input.id]),
            getUserForumReactions(ctx.user.id, "comment", commentIds),
          ]);
          myPostReaction = mpr[input.id];
          myCommentReactions = mcr;
        }
        return {
          ...row.post,
          author: row.author,
          upvotes: postReactions[input.id]?.upvote ?? 0,
          downvotes: postReactions[input.id]?.downvote ?? 0,
          myReaction: myPostReaction ?? null,
          comments: comments.map(c => ({
            ...c.comment,
            author: c.author,
            upvotes: commentReactions[c.comment.id]?.upvote ?? 0,
            downvotes: commentReactions[c.comment.id]?.downvote ?? 0,
            myReaction: myCommentReactions[c.comment.id] ?? null,
          })),
        };
      }),

    // Upload audio attachment for a forum post or comment
    uploadAudio: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default("audio/mpeg"),
        title: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 15 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File must be under 15MB" });
        }
        const ext = input.fileName.split(".").pop() || "mp3";
        const key = `forum-audio/${ctx.user.id}/${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, title: input.title ?? input.fileName };
      }),

    // Create a post (requires login)
    createPost: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        body: z.string().min(1).max(10000),
        category: z.enum(["general", "music", "battles", "news", "feedback"]).default("general"),
        audioUrl: z.string().max(1024).optional(),
        audioTitle: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createForumPost({
          userId: ctx.user.id,
          title: input.title,
          body: input.body,
          category: input.category,
          audioUrl: input.audioUrl ?? null,
          audioTitle: input.audioTitle ?? null,
        });
        return { success: true };
      }),

    // Delete a post (own post or admin)
    deletePost: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const row = await getForumPostById(input.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.post.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await deleteForumPost(input.id);
        return { success: true };
      }),

    // Create a comment
    createComment: protectedProcedure
      .input(z.object({
        postId: z.number(),
        body: z.string().min(1).max(2000),
        parentId: z.number().optional(),
        audioUrl: z.string().max(1024).optional(),
        audioTitle: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createForumComment({
          postId: input.postId,
          userId: ctx.user.id,
          body: input.body,
          parentId: input.parentId ?? null,
          audioUrl: input.audioUrl ?? null,
          audioTitle: input.audioTitle ?? null,
        });
        return { success: true };
      }),

    // Delete a comment (own or admin)
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comments = await getForumComments(0); // we need to look up by id
        // Just delete — server will check ownership via DB
        await deleteForumComment(input.id);
        return { success: true };
      }),

    // React to a post or comment
    react: protectedProcedure
      .input(z.object({
        targetType: z.enum(["post", "comment"]),
        targetId: z.number(),
        reaction: z.enum(["upvote", "downvote"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await reactToForumItem(ctx.user.id, input.targetType, input.targetId, input.reaction);
        return result;
      }),
  }),

  // -- Search --------------------------------------------------
  search: router({
    users: publicProcedure
      .input(z.object({ query: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        return searchUsers(input.query, 20);
      }),

    songs: publicProcedure
      .input(z.object({ query: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        return searchSongs(input.query, 20);
      }),
  }),

  // -- Combined Leaderboard ------------------------------------
  leaderboard: router({
    combined: publicProcedure.query(async () => {
      return getCombinedLeaderboard();
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

  // -- Admin Moderation ----------------------------------------
  moderation: router({
    // Get moderation logs
    getLogs: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }))
      .query(async ({ input }) => getModerationLogs(input.limit)),

    // Delete a forum post (admin override, with log)
    deleteForumPost: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        const row = await getForumPostById(input.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "delete_forum_post",
          targetType: "forum_post",
          targetId: input.id,
          targetPreview: row.post.title.slice(0, 256),
          reason: input.reason,
        });
        await deleteForumPost(input.id);
        return { success: true };
      }),

    // Delete a forum comment (admin override, with log)
    deleteForumComment: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "delete_forum_comment",
          targetType: "forum_comment",
          targetId: input.id,
          targetPreview: undefined,
          reason: input.reason,
        });
        await deleteForumComment(input.id);
        return { success: true };
      }),

    // Delete a chat message (admin override, with log)
    deleteChatMessage: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "delete_chat_message",
          targetType: "chat_message",
          targetId: input.id,
          reason: input.reason,
        });
        await deleteChatMessage(input.id);
        return { success: true };
      }),

    // Remove a review submission (admin override, with log)
    removeSubmission: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "remove_submission",
          targetType: "review_submission",
          targetId: input.id,
          reason: input.reason,
        });
        await updateSubmissionStatus(input.id, "removed");
        return { success: true };
      }),

    // Remove a wheel entry (admin override, with log)
    removeWheelEntry: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "remove_wheel_entry",
          targetType: "wheel_entry",
          targetId: input.id,
          reason: input.reason,
        });
        await updateWheelEntryStatus(input.id, "removed");
        return { success: true };
      }),
  }),
  // ── Admin Panel ─────────────────────────────────────────────────────────────
  admin: router({
    // Analytics overview
    analytics: adminProcedure.query(async () => {
      return getAdminAnalytics();
    }),

    // User management — list all users with search
    listUsers: adminProcedure
      .input(z.object({ search: z.string().optional(), limit: z.number().default(100) }))
      .query(async ({ input }) => {
        const all = await getAllUsers(input.limit);
        if (!input.search) return all;
        const q = input.search.toLowerCase();
        return all.filter(u =>
          (u.name ?? "").toLowerCase().includes(q) ||
          (u.artistName ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
        );
      }),

    // Change user role
    setRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "judge", "contestant", "admin"]) }))
      .mutation(async ({ input }) => {
        await setUserRole(input.userId, input.role);
        return { success: true };
      }),

    // Ban a user
    banUser: adminProcedure
      .input(z.object({ userId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await banUser(input.userId, input.reason ?? null);
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "ban_user",
          targetType: "user",
          targetId: input.userId,
          reason: input.reason,
        });
        return { success: true };
      }),

    // Unban a user
    unbanUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await unbanUser(input.userId);
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "unban_user",
          targetType: "user",
          targetId: input.userId,
        });
        return { success: true };
      }),

    // Promo orders — skip-the-line submissions
    skipOrders: adminProcedure.query(async () => {
      return getSkipLineOrders();
    }),

    // Promo orders — paid wheel entries
    wheelOrders: adminProcedure.query(async () => {
      return getWheelPaidOrders();
    }),

    // Confirm skip payment
    confirmSkip: adminProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ input }) => {
        await confirmSkipPayment(input.submissionId);
        return { success: true };
      }),

    // Confirm wheel payment
    confirmWheelPayment: adminProcedure
      .input(z.object({ entryId: z.number() }))
      .mutation(async ({ input }) => {
        await confirmWheelPayment(input.entryId);
        return { success: true };
      }),

    // Site settings — get all
    getSettings: adminProcedure.query(async () => {
      return getAllSettings();
    }),

    // Site settings — set a key
    setSetting: adminProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await setSetting(input.key, input.value);
        return { success: true };
      }),

    // Artist of the week — get all
    getArtistsOfWeek: adminProcedure.query(async () => {
      return getAllArtistsOfWeek();
    }),

    // Artist of the week — set new
    setArtistOfWeek: adminProcedure
      .input(z.object({
        artistName: z.string(),
        bio: z.string().optional(),
        imageUrl: z.string().optional(),
        instagramUrl: z.string().optional(),
        youtubeUrl: z.string().optional(),
        spotifyUrl: z.string().optional(),
        featuredVideoId: z.string().optional(),
        audioTrackUrl: z.string().optional(),
        audioTrackTitle: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertArtistOfWeek(input);
        return { success: true };
      }),

    // Moderation logs
    moderationLogs: adminProcedure.query(async () => {
      return getModerationLogs(200);
    }),

    // Judge applications — list pending
    judgeApplications: adminProcedure.query(async () => {
      return getPendingJudgeApplications();
    }),

    // Judge applications — approve or reject
    reviewJudgeApp: adminProcedure
      .input(z.object({ applicationId: z.number(), status: z.enum(["approved", "rejected"]) }))
      .mutation(async ({ input }) => {
        await reviewJudgeApplication(input.applicationId, input.status);
        return { success: true };
      }),

    // Danger Zone — hard-delete a user and all their data
    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
        await deleteUser(input.userId);
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "delete_user",
          targetType: "user",
          targetId: input.userId,
          reason: "Admin hard-delete",
        });
        return { success: true };
      }),

    // Danger Zone — reset all stats (battle records, votes, fire/trash counts, song reactions)
    resetAllStats: adminProcedure
      .mutation(async ({ ctx }) => {
        await resetAllStats();
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "reset_all_stats",
          targetType: "user",
          targetId: 0,
          reason: "Admin reset all stats",
        });
        return { success: true };
      }),

    // Danger Zone — reset all submissions (review queue + wheel entries + votes + active battle)
    resetAllSubmissions: adminProcedure
      .mutation(async ({ ctx }) => {
        await resetAllSubmissions();
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "reset_all_submissions",
          targetType: "user",
          targetId: 0,
          reason: "Admin reset all submissions",
        });
        return { success: true };
      }),
  }),

  // -- Daily Free Promo Wheel -----
  promoWheel: router({
    // Submit user's name to the wheel (1 free entry per account)
    submitName: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserWheelOfNamesEntry(ctx.user.id);
        if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a free entry in the wheel" });
        await addWheelOfNamesEntry(ctx.user.id, input.name, false);
        return { success: true };
      }),

    // Get all current wheel entries
    getEntries: publicProcedure.query(async () => {
      return getWheelOfNamesEntries();
    }),

    // Get the last winner
    getLastWinner: publicProcedure.query(async () => {
      return getLastWheelOfNamesWinner();
    }),

    // Get today's spin result (if already spun)
    getTodaysSpin: publicProcedure.query(async () => {
      return getTodaysWheelOfNamesSpin();
    }),

    // Buy additional entries ($5 per entry)
    buyEntries: protectedProcedure
      .input(z.object({ quantity: z.number().min(1).max(100) }))
      .mutation(async ({ input, ctx }) => {
        const amountPaid = input.quantity * 500; // $5 = 500 cents
        await createWheelOfNamesPaidEntryRequest(ctx.user.id, input.quantity, amountPaid);
        return { success: true, amountPaid };
      }),

    // Admin: get pending paid entry requests
    getPendingPaidEntries: adminProcedure.query(async () => {
      return getPendingWheelOfNamesPaidEntries();
    }),

    // Admin: confirm a paid entry (after payment is verified)
    confirmPayment: adminProcedure
      .input(z.object({ entryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await confirmWheelOfNamesPaidEntry(input.entryId, ctx.user.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
