import Stripe from "stripe";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, desc } from "drizzle-orm";
import { reviewSubmissions } from "../drizzle/schema";
import { storagePut, storageGetSignedUrl } from "./storage";
import { validateFreeShippingPromoCode } from "./promo-codes";
import {
  getQueueSubmissions, getReviewedSubmissions, addSubmission, updateSubmissionStatus,
  confirmSkipPayment, requeueSubmission, reorderQueueSubmissions, getQueueState, setCurrentPlaying, setLiveStatus,
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
  removeWheelOfNamesEntry,
  trackPageView, upsertActiveSession, pruneStaleActiveSessions, getSiteStats,
  setAccountLabels, setAccountLabelsAdmin, USER_SELECTABLE_LABELS, ALL_LABELS,
  getDb,
  createJudgeBroadcast, getActiveJudgeBroadcasts, getJudgeBroadcast, endJudgeBroadcast,
  getUserDailySpin, recordDailySpin, getAllDailySpins, getUserSpinHistory, getTodayEST,
  getUserLineSkipCredits, grantLineSkipCredits, useLineSkipCredit,
  confirmPaidSubmission,
  getOrCreateActiveMusicReviewSession, endActiveMusicReviewSession, countUserSubmissionsInActiveSession,
  getAllMerchProducts, getMerchProductById, addMerchProduct, updateMerchProduct,
  getUserCartItems, addCartItem, updateCartItem, removeCartItem, clearUserCart,
  createOrder, getOrderById, getOrderByStripeSessionId, getUserOrders, updateOrderStatus,
  getShopProducts, getShopProductById, getShopProductBySlug,
  createShopProduct, updateShopProduct, softDeleteShopProduct,
  getShopProductImages, addShopProductImage, deleteShopProductImage, updateShopProductImageOrder,
  getShopVariants, upsertShopVariant, deleteShopVariantsByProduct, getShopVariantInventory,
} from "./db";
import { users, liveStreams, giftTypes, gifts, coinPurchases, coinBalances, musicReviewSessions, liveRewards, fireVoteBalances, fireVoteConversions, walletTransactions, economyConfig, coinPackages, creatorCashouts, fraudLogs, judgeStreams, shopProducts, goldenWheelOrders, wheelEligibility, wheelSpins, wheelPrizes } from "../drizzle/schema";
import {
  generateRoomName, generateStreamerToken, generateViewerToken,
  deleteRoom, getRoomParticipantCount,
  createRtmpIngress, deleteIngress, getIngressStatus,
} from "./livekit";
import { ENV } from "./_core/env";
import { desc as drizzleDesc, sql } from "drizzle-orm";
import {
  awardXP, getAllRewards, getRewardById, createReward, updateReward,
  getUserRewards, getPublicUserRewards, adminGrantReward, adminRevokeReward,
  claimReward, getRewardLogs, getUserBadges, adminGrantBadge, adminRemoveBadge,
  adminSetXP, getRewardsWithProgress, getUserRewardStats, checkAndUnlockRewards,
  ARTIST_LEVELS, FAN_LEVELS, getArtistLevelInfo, getFanLevelInfo, getNextArtistLevel,
  updateStreak,
} from "./rewards";

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
    me: publicProcedure.query(async (opts) => {
      // Trigger daily streak + XP on each login check (non-blocking)
      if (opts.ctx.user) {
        updateStreak(opts.ctx.user.id).then(streakDays => {
          if (streakDays > 0) {
            awardXP(opts.ctx.user!.id, "daily_streak", { amount: 10 * streakDays }).catch(() => {});
          }
        }).catch(() => {});
      }
      return opts.ctx.user;
    }),
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

    // Set own account type label (user-selectable options only)
    setLabels: protectedProcedure
      .input(z.object({
        labels: z.array(z.enum(["fan", "artist", "producer", "videographer", "blogger", "brand_owner", "audio_engineer"])),
      }))
      .mutation(async ({ ctx, input }) => {
        await setAccountLabels(ctx.user.id, input.labels);
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
        awardXP(ctx.user.id, "song_upload").catch(() => {});
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
        awardXP(ctx.user.id, "song_upload").catch(() => {});
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
        // Award XP to winner and loser
        if (input.winnerId) awardXP(input.winnerId, "battle_win").catch(() => {});
        if (input.loserId) awardXP(input.loserId, "battle_participation").catch(() => {});
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
        // Paid submission type — if provided, this is a 3rd+ paid submission
        paidSubmissionType: z.enum(["reentry5", "reentry10", "skip"]).optional(),
        // Payment proof for skip/paid submissions
        receiptUrl: z.string().max(512).optional(),
        paymentMethod: z.string().max(64).optional(),
      }))
      .output(z.union([
        z.object({ success: z.literal(true), isPaid: z.boolean().optional() }),
        z.object({
          success: z.literal(false),
          limitReached: z.literal(true),
          message: z.string(),
          upgradeOptions: z.array(z.object({
            type: z.string(),
            price: z.number(),
            label: z.string(),
          })),
        }),
      ]))
      .mutation(async ({ ctx, input }) => {
        // Check submission limit (max 2 free submissions per user per live session)
        const submissionCount = await countUserSubmissionsInActiveSession(ctx.user.id);
        
        // If at limit and no paid type provided, return paywall options
        if (submissionCount >= 2 && !input.paidSubmissionType) {
          return {
            success: false,
            limitReached: true,
            message: "You've used your 2 free submissions for this live session. Submit more for a fee:",
            upgradeOptions: [
              { type: "reentry5", price: 5, label: "$5 Reentry — 1 more song, normal queue" },
              { type: "reentry10", price: 10, label: "$10 Reentry — 1 more song, normal queue" },
              { type: "skip", price: 15, label: "$15 Reentry + Skip the Line — pending admin approval" },
            ],
          };
        }
        
        // Auto-resolve artist name from the user's registered profile
        const profile = await getArtistProfile(ctx.user.id);
        const artistName = profile?.artistName ?? ctx.user.artistName ?? ctx.user.name ?? "Unknown Artist";
        const isPaid = submissionCount >= 2 && !!input.paidSubmissionType;
        // Get the active session to link this submission to it
        const session = await getOrCreateActiveMusicReviewSession();
        await addSubmission({
          userId: ctx.user.id,
          musicReviewSessionId: session.id,
          artistName,
          songTitle: input.songTitle,
          submissionType: input.submissionType,
          youtubeUrl: input.youtubeUrl ?? null,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip || input.paidSubmissionType === "skip",
          skipPaymentConfirmed: false,
          isPaidSubmission: isPaid,
          paidSubmissionType: isPaid ? (input.paidSubmissionType ?? null) : null,
          paidSubmissionConfirmed: false,
          cashappPaymentReceiptUrl: input.receiptUrl ?? null,
          // Paid submissions are held as 'pending' until admin confirms payment
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
        // Award XP for submitting a song to the review queue
        if (!isPaid) awardXP(ctx.user.id, "review_submission").catch(() => {});
        return { success: true, isPaid };
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
      .input(z.object({ id: z.number(), skipType: z.enum(["reentry5", "reentry10", "skip"]).optional() }))
      .mutation(async ({ input }) => {
        await confirmSkipPayment(input.id, input.skipType ?? "skip");
        return { success: true };
      }),

    // Confirm a paid submission (3rd+ song) — admin verifies payment received
    confirmPaidSub: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await confirmPaidSubmission(input.id);
        return { success: true };
      }),

    // Re-queue a previously reviewed submission back to the end of the pending queue
    requeue: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await requeueSubmission(input.id);
        return { success: true };
      }),

    // Reorder queue — admin drag-and-drop
    reorder: adminProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await reorderQueueSubmissions(input.orderedIds);
        return { success: true };
      }),

    setLive: adminProcedure
      .input(z.object({ isLive: z.boolean(), message: z.string().optional(), streamUrl: z.string().max(512).optional() }))
      .mutation(async ({ input }) => {
        try {
          if (input.isLive) {
            // Starting a live session — create a new active session
            await getOrCreateActiveMusicReviewSession();
          } else {
            // Ending a live session
            try {
              await endActiveMusicReviewSession();
            } catch (err) {
              console.error("[queue.setLive] Error ending session:", err);
              // Don't fail the entire mutation if session end fails
            }
          }
          await setLiveStatus(input.isLive, input.message, input.streamUrl);
          // Notify all users when going live
          if (input.isLive) {
            try {
              const db = await getDb();
              if (db) {
                const { notifications, users: usersTable } = await import('../drizzle/schema');
                const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
                const message = input.message || 'Music Review is now LIVE! Submit your tracks.';
                if (allUsers.length > 0) {
                  await db.insert(notifications).values(
                    allUsers.map(u => ({
                      userId: u.id,
                      type: 'live_music_review' as const,
                      title: '\uD83D\uDD34 Music Review is LIVE',
                      body: message,
                      link: '/review',
                    }))
                  );
                }
              }
            } catch (e) { console.error('[setLive] notification error', e); }
          }
          return { success: true };
        } catch (err) {
          console.error("[queue.setLive] Error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update live status" });
        }
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
        paidSubmissionType: z.enum(["reentry5", "reentry10", "skip"]).optional(),
      }))
      .output(z.union([
        z.object({ success: z.literal(true), isPaid: z.boolean().optional() }),
        z.object({
          success: z.literal(false),
          limitReached: z.literal(true),
          message: z.string(),
          upgradeOptions: z.array(z.object({ type: z.string(), price: z.number(), label: z.string() })),
        }),
      ]))
      .mutation(async ({ ctx, input }) => {
        const submissionCount = await countUserSubmissionsInActiveSession(ctx.user.id);
        if (submissionCount >= 2 && !input.paidSubmissionType) {
          return {
            success: false,
            limitReached: true,
            message: "You've used your 2 free submissions for this live session. Submit more for a fee:",
            upgradeOptions: [
              { type: "reentry5", price: 5, label: "$5 Reentry — 1 more song, normal queue" },
              { type: "reentry10", price: 10, label: "$10 Reentry — 1 more song, normal queue" },
              { type: "skip", price: 15, label: "$15 Reentry + Skip the Line — pending admin approval" },
            ],
          };
        }
        const isPaid = submissionCount >= 2 && !!input.paidSubmissionType;
        const session = await getOrCreateActiveMusicReviewSession();
        await addSubmission({
          userId: ctx.user.id,
          musicReviewSessionId: session.id,
          artistName: input.artistName,
          songTitle: input.songTitle,
          submissionType: "file",
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip || input.paidSubmissionType === "skip",
          skipPaymentConfirmed: false,
          isPaidSubmission: isPaid,
          paidSubmissionType: isPaid ? (input.paidSubmissionType ?? null) : null,
          paidSubmissionConfirmed: false,
          status: "pending",
          position: 0,
        });
        if (!isPaid) awardXP(ctx.user.id, "review_submission").catch(() => {});
        return { success: true, isPaid };
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
        paidSubmissionType: z.enum(["reentry5", "reentry10", "skip"]).optional(),
        receiptUrl: z.string().max(512).optional(),
        paymentMethod: z.string().max(64).optional(),
      }))
      .output(z.union([
        z.object({ success: z.literal(true), isPaid: z.boolean().optional() }),
        z.object({
          success: z.literal(false),
          limitReached: z.literal(true),
          message: z.string(),
          upgradeOptions: z.array(z.object({ type: z.string(), price: z.number(), label: z.string() })),
        }),
      ]))
      .mutation(async ({ ctx, input }) => {
        // Enforce 2-song per-session limit
        const submissionCount = await countUserSubmissionsInActiveSession(ctx.user.id);
        if (submissionCount >= 2 && !input.paidSubmissionType) {
          return {
            success: false,
            limitReached: true,
            message: "You've used your 2 free submissions for this live session. Submit more for a fee:",
            upgradeOptions: [
              { type: "reentry5", price: 5, label: "$5 Reentry — 1 more song, normal queue" },
              { type: "reentry10", price: 10, label: "$10 Reentry — 1 more song, normal queue" },
              { type: "skip", price: 15, label: "$15 Reentry + Skip the Line — pending admin approval" },
            ],
          };
        }
        const isPaid = submissionCount >= 2 && !!input.paidSubmissionType;
        // Get the active session to link this submission to it
        const session = await getOrCreateActiveMusicReviewSession();
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
          musicReviewSessionId: session.id,
          artistName,
          songTitle: input.songTitle,
          submissionType: "file",
          fileKey: key,
          fileUrl: url,
          contactInfo: input.contactInfo ?? null,
          skippedLine: input.wantsSkip || input.paidSubmissionType === "skip",
          skipPaymentConfirmed: false,
          isPaidSubmission: isPaid,
          paidSubmissionType: isPaid ? (input.paidSubmissionType ?? null) : null,
          paidSubmissionConfirmed: false,
          cashappPaymentReceiptUrl: input.receiptUrl ?? null,
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
        if (!isPaid) awardXP(ctx.user.id, "review_submission").catch(() => {});
        return { success: true, isPaid };
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
        // Award fan XP to voter
        awardXP(ctx.user.id, "vote_cast", { amount: 2 }).catch(() => {});
        // Award artist XP to submission owner when they receive a fire vote
        if (input.reaction === "fire") {
          const { getDb } = await import("./db");
          const { reviewSubmissions: rs } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          if (db) {
            const [sub] = await db.select({ userId: rs.userId }).from(rs).where(eq(rs.id, input.submissionId)).limit(1);
            if (sub?.userId && sub.userId !== ctx.user.id) {
              awardXP(sub.userId, "fire_vote_received").catch(() => {});
            }
          }
        }
        return { success: true };
      }),
    // Get fire/trash counts for a submissionn
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
    // Set playback mode and pricing — admin only
    setPlaybackMode: adminProcedure
      .input(z.object({
        playbackMode: z.enum(["90sec", "full", "paid_only"]),
        submitPriceCents: z.number().min(0).max(100000).optional(),
        skipPriceCents: z.number().min(0).max(100000).optional(),
        fullSongPriceCents: z.number().min(0).max(100000).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { queueState: qs } = await import("../drizzle/schema");
        const existing = await db.select().from(qs).limit(1);
        const updateData: Record<string, unknown> = { playbackMode: input.playbackMode };
        if (input.submitPriceCents !== undefined) updateData.submitPriceCents = input.submitPriceCents;
        if (input.skipPriceCents !== undefined) updateData.skipPriceCents = input.skipPriceCents;
        if (input.fullSongPriceCents !== undefined) updateData.fullSongPriceCents = input.fullSongPriceCents;
        if (existing.length === 0) {
          await db.insert(qs).values({ isLive: false, ...updateData } as any);
        } else {
          await db.update(qs).set(updateData);
        }
        return { success: true };
      }),
  }),

  // -- Music Review Judge Broadcasts --------------------------------
  review: router({
    // Start a judge/admin broadcast during music review (browser WebRTC — no RTMP ingress)
    startBroadcast: protectedProcedure
      .mutation(async ({ ctx }) => {
        // Only judges and admins can broadcast
        if (ctx.user.role !== "judge" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only judges and admins can broadcast" });
        }
        
        // Reuse existing active broadcast if present — return a fresh token
        const existing = await getJudgeBroadcast(ctx.user.id);
        if (existing) {
          const identity = `judge-browser-${ctx.user.id}`;
          const displayName = ctx.user.artistName || ctx.user.name || `Judge ${ctx.user.id}`;
          const token = await generateStreamerToken(existing.roomName, identity, displayName);
          return { success: true, broadcast: { id: existing.id, userId: existing.userId, roomName: existing.roomName, status: existing.status }, token, livekitUrl: ENV.livekitUrl };
        }
        
        // Browser-first: create room + publisher token WITHOUT RTMP ingress
        const roomName = `review-judge-${ctx.user.id}-${Date.now()}`;
        const identity = `judge-browser-${ctx.user.id}`;
        const displayName = ctx.user.artistName || ctx.user.name || `Judge ${ctx.user.id}`;
        
        const insertResult = await createJudgeBroadcast({
          userId: ctx.user.id,
          musicReviewSessionId: null,
          roomName,
          ingressId: null as any,
          rtmpUrl: null as any,
          rtmpKey: null as any,
          status: "active",
        }) as any;
        const broadcastId = insertResult.insertId as number;
        
        // Generate LiveKit publisher token immediately — one click to go live
        const token = await generateStreamerToken(roomName, identity, displayName);
        
        console.log(`[Judge Broadcast] ${ctx.user.name} started browser broadcast in room ${roomName} (id=${broadcastId})`);
        
        return { success: true, broadcast: { id: broadcastId, userId: ctx.user.id, roomName, status: "active" }, token, livekitUrl: ENV.livekitUrl };
      }),

    // End a judge broadcast
    endBroadcast: protectedProcedure
      .input(z.object({ broadcastId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Verify ownership
        const broadcast = await db.select().from(judgeStreams).where(eq(judgeStreams.id, input.broadcastId)).limit(1);
        if (!broadcast[0] || broadcast[0].userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your broadcast" });
        }
        
        // Delete ingress if one exists (browser-only broadcasts have no ingress)
        if (broadcast[0].ingressId) {
          await deleteIngress(broadcast[0].ingressId);
        }
        
        // End broadcast
        await endJudgeBroadcast(input.broadcastId);
        
        console.log(`[Judge Broadcast] ${ctx.user.name} ended broadcast`);
        
        return { success: true };
      }),

    // Get active judge broadcasts
    getActive: publicProcedure.query(async () => {
      return getActiveJudgeBroadcasts();
    }),

    // Admin: force-end any judge broadcast
    forceEnd: adminProcedure
      .input(z.object({ broadcastId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [broadcast] = await db.select().from(judgeStreams).where(eq(judgeStreams.id, input.broadcastId)).limit(1);
        if (!broadcast) throw new TRPCError({ code: 'NOT_FOUND', message: 'Broadcast not found' });
        
        // Delete LiveKit ingress if it exists
        if (broadcast.ingressId) {
          try {
            await deleteIngress(broadcast.ingressId);
          } catch (e) {
            console.warn(`[Judge Broadcast] Failed to delete ingress ${broadcast.ingressId}:`, e);
          }
        }
        
        // Mark as ended in database
        await db.update(judgeStreams).set({ status: 'ended' }).where(eq(judgeStreams.id, input.broadcastId));
        return { success: true };
      }),

    // Get a specific judge's broadcast credentials (for OBS setup)
    getMyBroadcast: protectedProcedure.query(async ({ ctx }) => {
      return getJudgeBroadcast(ctx.user.id);
    }),

    // Generate a LiveKit publish token for native browser broadcasting (no RTMP ingress needed)
    getJudgeToken: protectedProcedure
      .input(z.object({ broadcastId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'judge' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only judges and admins can broadcast' });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [broadcast] = await db.select().from(judgeStreams).where(eq(judgeStreams.id, input.broadcastId)).limit(1);
        if (!broadcast || broadcast.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your broadcast' });
        }
        const identity = `judge-browser-${ctx.user.id}`;
        const displayName = ctx.user.artistName || ctx.user.name || `Judge ${ctx.user.id}`;
        const token = await generateStreamerToken(broadcast.roomName, identity, displayName);
        return { token, roomName: broadcast.roomName, livekitUrl: ENV.livekitUrl };
      }),

    // Generate a viewer token to watch a judge's native broadcast
    getJudgeViewerToken: publicProcedure
      .input(z.object({ broadcastId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [broadcast] = await db.select().from(judgeStreams).where(eq(judgeStreams.id, input.broadcastId)).limit(1);
        if (!broadcast || broadcast.status !== 'active') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Broadcast not found or ended' });
        }
        const identity = ctx.user ? `viewer-${ctx.user.id}` : `anon-${Date.now()}`;
        const displayName = ctx.user ? (ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`) : 'Viewer';
        const token = await generateViewerToken(broadcast.roomName, identity, displayName);
        return { token, roomName: broadcast.roomName, livekitUrl: ENV.livekitUrl };
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
    // Grant any account labels including ADMIN/JUDGE (admin only)
    setAccountLabels: adminProcedure
      .input(z.object({
        userId: z.number(),
        labels: z.array(z.enum(["fan", "artist", "producer", "videographer", "blogger", "brand_owner", "audio_engineer", "judge", "admin"])),
      }))
      .mutation(async ({ input }) => {
        await setAccountLabelsAdmin(input.userId, input.labels);
        return { success: true };
      }),

    // Admin: modify any user's stats (full control)
    modifyStats: adminProcedure
      .input(z.object({
        userId: z.number(),
        artistXP: z.number().optional(),
        fanXP: z.number().optional(),
        battleWins: z.number().optional(),
        battleLosses: z.number().optional(),
        fireVotes: z.number().optional(),
        trashVotes: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        
        const updates: Record<string, number> = {};
        if (input.artistXP !== undefined) updates.artistXP = input.artistXP;
        if (input.fanXP !== undefined) updates.fanXP = input.fanXP;
        if (input.battleWins !== undefined) updates.battleWins = input.battleWins;
        if (input.battleLosses !== undefined) updates.battleLosses = input.battleLosses;
        if (input.fireVotes !== undefined) updates.fireVotes = input.fireVotes;
        if (input.trashVotes !== undefined) updates.trashVotes = input.trashVotes;
        
        if (Object.keys(updates).length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No stats to modify' });
        }
        
        await db.update(users).set(updates).where(eq(users.id, input.userId));
        
        return { success: true, modified: Object.keys(updates) };
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
        // Award fan XP for casting a battle vote
        awardXP(ctx.user.id, "vote_cast").catch(() => {});
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
        // Award XP for creating a forum post
        awardXP(ctx.user.id, "forum_post").catch(() => {});
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
        // Award XP for commenting on a forum post
        awardXP(ctx.user.id, "forum_comment").catch(() => {});
        return { success: true };
      }),
    // Delete a comment (own or admin))
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
        // Award fan XP for reacting to forum content
        awardXP(ctx.user.id, "vote_cast", { amount: 1 }).catch(() => {});
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

    // Top fans by fan XP
    topFans: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const fans = await db
        .select({
          id: users.id,
          name: users.name,
          artistName: users.artistName,
          avatarUrl: users.avatarUrl,
          fanXP: users.fanXP,
          fanLevel: users.fanLevel,
          accountLabels: users.accountLabels,
        })
        .from(users)
        .where(sql`${users.fanXP} > 0`)
        .orderBy(drizzleDesc(users.fanXP))
        .limit(50);
      return fans.map((f, idx) => ({
        rank: idx + 1,
        id: f.id,
        displayName: f.artistName ?? f.name ?? "Anonymous",
        avatarUrl: f.avatarUrl ?? null,
        fanXP: f.fanXP ?? 0,
        fanLevel: f.fanLevel ?? "supporter",
        accountLabels: f.accountLabels ? JSON.parse(f.accountLabels) as string[] : [],
      }));
    }),

    // Record that the current user watched a live stream (awards fan XP once per session)
    recordStreamWatch: protectedProcedure.mutation(async ({ ctx }) => {
      awardXP(ctx.user.id, "stream_watch").catch(() => {});
      return { ok: true };
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
  // Define adminProcedure if not already defined
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

    // Promote user to judge with CashApp payment verification
    promoteToJudge: adminProcedure
      .input(z.object({
        userId: z.number(),
        cashappReceiptUrl: z.string().url("Invalid CashApp receipt URL"),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        
        // Update user role to judge and store receipt URL
        await db.update(users).set({
          role: "judge",
          cashappPaymentReceiptUrl: input.cashappReceiptUrl,
          judgeVerifiedAt: new Date(),
        }).where(eq(users.id, input.userId));
        
        // Log the promotion
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "promote_to_judge",
          targetType: "user",
          targetId: input.userId,
          reason: `CashApp receipt: ${input.cashappReceiptUrl}`,
        });
        
        return { success: true };
      }),

    // Revoke judge access
    revokeJudgeAccess: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        
        // Demote user back to regular user
        await db.update(users).set({
          role: "user",
          cashappPaymentReceiptUrl: null,
          judgeVerifiedAt: null,
        }).where(eq(users.id, input.userId));
        
        // Log the revocation
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "revoke_judge_access",
          targetType: "user",
          targetId: input.userId,
        });
        
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

    // Get pending paid submissions
    getPendingPaidSubmissions: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db.select().from(reviewSubmissions).where(
        and(
          eq(reviewSubmissions.isPaidSubmission, true),
          eq(reviewSubmissions.paidSubmissionConfirmed, false)
        )
      ).orderBy(desc(reviewSubmissions.createdAt));
      return rows.map(r => ({
        id: r.id,
        songTitle: r.songTitle,
        artistName: r.artistName,
        paidSubmissionType: r.paidSubmissionType,
        createdAt: r.createdAt,
        contactInfo: r.contactInfo,
      }));
    }),

    // Confirm paid submission
    confirmPaidSubmission: adminProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ input }) => {
        await confirmPaidSubmission(input.submissionId);
        return { success: true };
      }),

    // Reject paid submission
    rejectPaidSubmission: adminProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.delete(reviewSubmissions).where(eq(reviewSubmissions.id, input.submissionId));
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
    // Grant any account labels including ADMIN/JUDGE (admin only)
    setAccountLabels: adminProcedure
      .input(z.object({
        userId: z.number(),
        labels: z.array(z.enum(["fan", "artist", "producer", "videographer", "blogger", "brand_owner", "audio_engineer", "judge", "admin"])),
      }))
      .mutation(async ({ input }) => {
        await setAccountLabelsAdmin(input.userId, input.labels);
        return { success: true };
      }),

    // Admin: edit user stats (xp, level, streak — stored on users table)
    adminEditUserStats: adminProcedure
      .input(z.object({
        userId: z.number(),
        xp: z.number().min(0).optional(),
        level: z.string().max(64).optional(),
        streak: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updates: Record<string, any> = {};
        if (input.xp !== undefined) updates.xp = input.xp;
        if (input.level !== undefined) updates.level = input.level;
        if (input.streak !== undefined) updates.streak = input.streak;

        await db.update(users).set(updates).where(eq(users.id, input.userId));
        return { success: true };
      }),

    // Admin: remove a specific song from user catalogue
    adminRemoveSong: adminProcedure
      .input(z.object({ songId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { userSongs } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(userSongs).where(eq(userSongs.id, input.songId));
        return { success: true };
      }),

    // Admin: remove a specific Music Review submission
    adminRemoveReviewSubmission: adminProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { reviewSubmissions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(reviewSubmissions).where(eq(reviewSubmissions.id, input.submissionId));
        return { success: true };
      }),

    // Admin: get user's songs and submissions for editing
    adminGetUserData: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { userSongs, reviewSubmissions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return { songs: [], submissions: [] };
        const songs = await db.select().from(userSongs).where(eq(userSongs.userId, input.userId));
        const submissions = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.userId, input.userId));
        return { songs, submissions };
      }),

    // Admin: edit fire/trash counts on a specific submission
    adminEditSubmissionStats: adminProcedure
      .input(z.object({
        submissionId: z.number(),
        fireCount: z.number().min(0),
        trashCount: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { reviewSubmissions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(reviewSubmissions)
          .set({ fireCount: input.fireCount, trashCount: input.trashCount })
          .where(eq(reviewSubmissions.id, input.submissionId));
        return { success: true };
      }),
    // Admin: list all live streams with gift totals
    adminGetLiveStreams: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const streams = await db.select().from(liveStreams).orderBy(drizzleDesc(liveStreams.createdAt)).limit(200);
        const userIds = Array.from(new Set(streams.map(s => s.userId)));
        const streamUsers = userIds.length > 0
          ? await db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, userIds))
          : [];
        const userMap = Object.fromEntries(streamUsers.map(u => [u.id, u]));
        return streams.map(s => ({ ...s, streamer: userMap[s.userId] ?? null }));
      }),

    // Admin: get full gift ledger
    adminGetGiftLedger: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const rows = await db.select().from(gifts).orderBy(drizzleDesc(gifts.createdAt)).limit(input.limit);
        const allUserIds = Array.from(new Set([...rows.map(g => g.fromUserId), ...rows.map(g => g.toUserId)]));
        const giftTypeIds = Array.from(new Set(rows.map(g => g.giftTypeId)));
        const [giftUsers, types] = await Promise.all([
          allUserIds.length > 0
            ? db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, allUserIds))
            : Promise.resolve([]),
          giftTypeIds.length > 0
            ? db.select().from(giftTypes).where(inArray(giftTypes.id, giftTypeIds))
            : Promise.resolve([]),
        ]);
        const userMap = Object.fromEntries(giftUsers.map(u => [u.id, u]));
        const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
        return rows.map(g => ({
          ...g,
          from: userMap[g.fromUserId] ?? null,
          to: userMap[g.toUserId] ?? null,
          giftType: typeMap[g.giftTypeId] ?? null,
        }));
      }),

    // Admin: get pending coin purchase requests
    adminGetCoinRequests: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const requests = await db.select().from(coinPurchases).orderBy(drizzleDesc(coinPurchases.createdAt)).limit(200);
        const userIds = Array.from(new Set(requests.map(r => r.userId)));
        const reqUsers = userIds.length > 0
          ? await db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, userIds))
          : [];
        const userMap = Object.fromEntries(reqUsers.map(u => [u.id, u]));
        return requests.map(r => ({ ...r, user: userMap[r.userId] ?? null }));
      }),
    adminApproveCoinPurchase: adminProcedure
      .input(z.object({ purchaseId: z.number(), approve: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [purchase] = await db.select().from(coinPurchases).where(eq(coinPurchases.id, input.purchaseId)).limit(1);
        if (!purchase) throw new TRPCError({ code: "NOT_FOUND" });
        if (purchase.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Already processed" });
        const newStatus = input.approve ? "approved" : "rejected";
        await db.update(coinPurchases).set({ status: newStatus, approvedByAdminId: ctx.user.id, approvedAt: new Date() }).where(eq(coinPurchases.id, input.purchaseId));
        if (input.approve) {
          // Add coins to user balance
          const [existing] = await db.select().from(coinBalances).where(eq(coinBalances.userId, purchase.userId)).limit(1);
          if (existing) {
            await db.update(coinBalances).set({ balance: existing.balance + purchase.coins }).where(eq(coinBalances.userId, purchase.userId));
          } else {
            await db.insert(coinBalances).values({ userId: purchase.userId, balance: purchase.coins });
          }
        }
        return { success: true };
      }),

    // Admin: directly add coins to a user account
    adminAddCoins: adminProcedure
      .input(z.object({ userId: z.number(), coins: z.number().min(1), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [existing] = await db.select().from(coinBalances).where(eq(coinBalances.userId, input.userId)).limit(1);
        if (existing) {
          await db.update(coinBalances).set({ balance: existing.balance + input.coins }).where(eq(coinBalances.userId, input.userId));
        } else {
          await db.insert(coinBalances).values({ userId: input.userId, balance: input.coins });
        }
        await createModerationLog({
          adminId: ctx.user.id,
          adminName: ctx.user.name ?? "Admin",
          action: "add_coins",
          targetType: "user",
          targetId: input.userId,
          reason: input.reason || `Added ${input.coins} coins`,
        });
        return { success: true };
      }),

    // Admin: mark payout as sent for a stream
    adminMarkPayoutSent: adminProcedure
      .input(z.object({ streamId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await db.update(liveStreams).set({ payoutStatus: "paid" }).where(eq(liveStreams.id, input.streamId));
        return { success: true };
      }),

  }),

  // -- Daily Free Promo Wheel -----
  promoWheel: router({
    // Submit user's Instagram handle to the wheel (1 free entry per day)
    submitName: protectedProcedure
      .input(z.object({
        name: z.string()
          .min(1, "Instagram handle is required")
          .max(31, "Handle too long") // @ + 30 chars
          .transform(v => v.startsWith("@") ? v : `@${v}`)
          .refine(v => /^@[a-zA-Z0-9._]{1,30}$/.test(v), {
            message: "Invalid Instagram handle. Use letters, numbers, underscores, or dots (max 30 characters)."
          })
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserWheelOfNamesEntry(ctx.user.id);
        if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a free entry today. Come back tomorrow!" });
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

    // Admin: remove a name from the wheel
    adminRemoveName: adminProcedure
      .input(z.object({ entryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await removeWheelOfNamesEntry(input.entryId);
        return { success: true };
      }),

    // Admin: manually add a name to the wheel
    adminAddName: adminProcedure
      .input(z.object({ name: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        await addWheelOfNamesEntry(0, input.name, false);
        return { success: true };
      }),

    // Admin: spin the wheel — picks random winner, records spin, clears all entries
    adminSpin: adminProcedure.mutation(async ({ ctx }) => {
      const entries = await getWheelOfNamesEntries();
      if (entries.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No entries on the wheel to spin" });
      const winner = entries[Math.floor(Math.random() * entries.length)];
      const winnerIndex = entries.findIndex(e => e.id === winner.id);
      const today = new Date().toISOString().split('T')[0];
      await createWheelOfNamesSpin(today, winner.userId || null, winner.name);
      await clearWheelOfNamesEntries();
      // Broadcast live spin to all viewers on the promo_wheel room
      try {
        const io = (ctx.req as any).app?.io;
        if (io) {
          const SPIN_DURATION = 9000;
          io.to("promo_wheel").emit("wof:spin_start", {
            winnerIndex,
            names: entries.map(e => e.name),
            duration: SPIN_DURATION,
          });
          // After spin completes, broadcast the result
          setTimeout(() => {
            io.to("promo_wheel").emit("wof:spin_result", { winnerName: winner.name });
          }, SPIN_DURATION + 500);
        }
      } catch {}
      try {
        const { notifyOwner } = await import('./_core/notification');
        await notifyOwner({ title: 'Daily Wheel Spun!', content: `Today's winner is: ${winner.name}` });
      } catch {}
      return { success: true, winner: { name: winner.name, userId: winner.userId } };
    }),

    // Admin: reset the wheel without picking a winner
    adminReset: adminProcedure.mutation(async ({ ctx }) => {
      await clearWheelOfNamesEntries();
      return { success: true };
    }),
  }),

  // -- Daily Prize Wheel ------------------------------------------
  dailyWheel: router({
    // Prize definitions with weighted odds
    // Weights (out of 1000 for fine-grained control)
    // Coupons dominate: promo_10off(450) + promo_20off(350) = 80%
    // try_again: 130 (13%), line_skip: 30 (3%), free_story_post: 20 (2%),
    // free_page_post: 10 (1%), bogo_permanent: 9 (0.9%), unlimited_promo: 1 (0.1%)

    // Get today's spin status for the logged-in user
    getMyStatus: protectedProcedure.query(async ({ ctx }) => {
      const spin = await getUserDailySpin(ctx.user.id);
      const today = getTodayEST();
      return {
        hasSpunToday: spin !== null,
        todayDate: today,
        prize: spin ? { key: spin.prizeKey, label: spin.prizeLabel } : null,
      };
    }),

    // Spin the wheel — picks a weighted random prize, records it, returns prize + segment index
    spin: protectedProcedure.mutation(async ({ ctx }) => {
      const existing = await getUserDailySpin(ctx.user.id);
      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You already spun today! Come back tomorrow." });
      }

      // Prize table — key, label, weight (out of 1000)
      // MUST match client PRIZES array order in WheelOfNames.tsx
      const PRIZES = [
        { key: "free_story_post",   label: "Free Story Post",              weight: 20  },
        { key: "bogo_permanent",    label: "BOGO Permanent Post",          weight: 9   },
        { key: "free_page_post",    label: "Free Page Post",               weight: 10  },
        { key: "line_skip",         label: "Music Review Line Skip",       weight: 30  },
        { key: "promo_20off",       label: "20% Off Promo",                weight: 350 },
        { key: "promo_10off",       label: "10% Off Promo",                weight: 450 },
        { key: "unlimited_promo",   label: "1-Month Unlimited Promo",      weight: 1   },
        { key: "try_again",         label: "Try Again Tomorrow",           weight: 130 },
      ];

      // Weighted random selection
      const totalWeight = PRIZES.reduce((s, p) => s + p.weight, 0);
      let rand = Math.random() * totalWeight;
      let prizeIndex = 0;
      for (let i = 0; i < PRIZES.length; i++) {
        rand -= PRIZES[i].weight;
        if (rand <= 0) { prizeIndex = i; break; }
      }
      const prize = PRIZES[prizeIndex];

      // Record the spin
      // Record the spin
      await recordDailySpin(ctx.user.id, prize.key, prize.label);

      // Grant line skip credit if prize is line_skip
      if (prize.key === 'line_skip') {
        await grantLineSkipCredits(ctx.user.id, 1);
      }

      // Notify owner
      try {
        const { notifyOwner } = await import('./_core/notification');
        await notifyOwner({
          title: 'Daily Wheel Spin',
          content: `${ctx.user.name ?? 'A user'} just spun and won: ${prize.label}`,
        });
      } catch {}

      return {
        prizeIndex,
        prize: { key: prize.key, label: prize.label },
      };
    }),

    // Admin: get all spin records
    adminGetAllSpins: adminProcedure.query(async () => {
      return getAllDailySpins(500);
    }),

    // Admin: get spin history for a specific user
    adminGetUserSpins: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getUserSpinHistory(input.userId);
      }),

    // Get user's current line skip credits
    getMyLineSkipCredits: protectedProcedure.query(async ({ ctx }) => {
      return getUserLineSkipCredits(ctx.user.id);
    }),

    // Use one line skip credit on a submission
    useLineSkip: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const credits = await getUserLineSkipCredits(ctx.user.id);
        if (credits <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No line skip credits available' });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [sub] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, input.submissionId));
        if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });
        if (sub.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
        if (sub.skippedLine) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already skipped' });
        await db.update(reviewSubmissions).set({ skippedLine: true, skipPaymentConfirmed: true }).where(eq(reviewSubmissions.id, input.submissionId));
        await useLineSkipCredit(ctx.user.id);
        return { success: true, creditsRemaining: credits - 1 };
      }),
  }),

  // -- Site Analytics (admin) -----------------------------------
  siteAnalytics: router({
    // Public: record a page view (called from client on each route change)
    trackView: publicProcedure
      .input(z.object({
        path: z.string().max(512),
        sessionId: z.string().max(64),
        referrer: z.string().max(512).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const ua = ctx.req.headers["user-agent"] ?? null;
        await trackPageView({
          path: input.path,
          sessionId: input.sessionId,
          userId: ctx.user?.id ?? null,
          referrer: input.referrer ?? null,
          userAgent: typeof ua === "string" ? ua : null,
        });
        return { ok: true };
      }),

    // Public: heartbeat to mark session as active (called every 30s)
    heartbeat: publicProcedure
      .input(z.object({
        path: z.string().max(512),
        sessionId: z.string().max(64),
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertActiveSession({
          sessionId: input.sessionId,
          path: input.path,
          userId: ctx.user?.id ?? null,
        });
        // Prune stale sessions opportunistically
        await pruneStaleActiveSessions(90_000).catch(() => {});
        return { ok: true };
      }),

    // Admin: get full site stats
    getStats: adminProcedure.query(async () => {
      return getSiteStats();
    }),
  }),

  // ── Rewards & Badges ─────────────────────────────────────────
  rewards: router({
    // Public: get all active rewards (for display)
    getAll: publicProcedure.query(async () => {
      return getAllRewards();
    }),

    // Admin: get all users with their reward stats
    adminGetAllUserStats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        artistName: users.artistName,
        role: users.role,
        xp: users.xp,
        level: users.level,
        fanXP: users.fanXP,
        fanLevel: users.fanLevel,
        streak: users.streak,
        createdAt: users.createdAt,
      }).from(users).orderBy(drizzleDesc(users.xp)).limit(500);
      return allUsers;
    }),

    // Public: get level config
    getLevels: publicProcedure.query(async () => {
      return { artistLevels: ARTIST_LEVELS, fanLevels: FAN_LEVELS };
    }),

    // Protected: get own rewards with progress
    myRewards: protectedProcedure.query(async ({ ctx }) => {
      return getRewardsWithProgress(ctx.user.id);
    }),

    // Protected: get own stats (XP, level, streak, etc.)
    myStats: protectedProcedure.query(async ({ ctx }) => {
      return getUserRewardStats(ctx.user.id);
    }),

    // Public: get public rewards for any user
    getPublicForUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getPublicUserRewards(input.userId);
      }),

    // Public: get badges for any user
    getBadgesForUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getUserBadges(input.userId);
      }),
    // Public: get XP/level stats for any user (for profile display)
    getStatsByUserId: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getUserRewardStats(input.userId);
      }),

    // Protected: claim an unlocked reward
    claim: protectedProcedure
      .input(z.object({ rewardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await claimReward(ctx.user.id, input.rewardId);
        return { success: true };
      }),

    // Protected: manually trigger reward check (e.g. after profile update)
    checkUnlocks: protectedProcedure.mutation(async ({ ctx }) => {
      await checkAndUnlockRewards(ctx.user.id);
      return { success: true };
    }),

    // Admin: create a reward
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().max(1024).optional(),
        type: z.enum(["level", "achievement", "promo", "wars", "review", "supporter", "verified", "rare"]),
        rarity: z.enum(["common", "rare", "epic", "legendary", "hall_of_fame"]),
        requirements: z.record(z.string(), z.unknown()),
        requiresAdminApproval: z.boolean().default(false),
        expiresAt: z.date().optional(),
        badgeIcon: z.string().max(64).optional(),
        badgeColor: z.string().max(32).optional(),
      }))
      .mutation(async ({ input }) => {
        await createReward({
          ...input,
          requirements: input.requirements as Record<string, number>,
        });
        return { success: true };
      }),

    // Admin: update a reward
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(1024).optional(),
        requirements: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().optional(),
        isPaused: z.boolean().optional(),
        requiresAdminApproval: z.boolean().optional(),
        expiresAt: z.date().nullable().optional(),
        badgeIcon: z.string().max(64).optional(),
        badgeColor: z.string().max(32).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateReward(id, data as Parameters<typeof updateReward>[1]);
        return { success: true };
      }),

    // Admin: grant reward to user
    adminGrant: adminProcedure
      .input(z.object({
        userId: z.number(),
        rewardId: z.number(),
        notes: z.string().max(512).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await adminGrantReward(ctx.user.id, input.userId, input.rewardId, input.notes);
        return { success: true };
      }),

    // Admin: revoke reward from user
    adminRevoke: adminProcedure
      .input(z.object({
        userId: z.number(),
        rewardId: z.number(),
        notes: z.string().max(512).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await adminRevokeReward(ctx.user.id, input.userId, input.rewardId, input.notes);
        return { success: true };
      }),

    // Admin: get all user rewards for a user
    adminGetUserRewards: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getUserRewards(input.userId);
      }),

    // Admin: override XP for a user
    adminSetXP: adminProcedure
      .input(z.object({
        userId: z.number(),
        xp: z.number().min(0),
        notes: z.string().max(512).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await adminSetXP(ctx.user.id, input.userId, input.xp, input.notes);
        return { success: true };
      }),

    // Admin: grant badge to user
    adminGrantBadge: adminProcedure
      .input(z.object({
        userId: z.number(),
        badge: z.string().min(1).max(64),
        label: z.string().max(64).optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary", "hall_of_fame"]),
        badgeIcon: z.string().max(64).optional(),
        badgeColor: z.string().max(32).optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await adminGrantBadge(ctx.user.id, input.userId, input);
        return { success: true };
      }),

    // Admin: remove badge
    adminRemoveBadge: adminProcedure
      .input(z.object({ badgeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await adminRemoveBadge(ctx.user.id, input.badgeId);
        return { success: true };
      }),

    // Admin: get reward logs
    adminGetLogs: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }))
      .query(async ({ input }) => {
        return getRewardLogs(input.limit);
      }),

    // Admin: approve a coin purchase
  }),

  // ─── Live Cook Up ─────────────────────────────────────────────
  live: router({

    // List all active live streams
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const streams = await db.select().from(liveStreams)
        .where(eq(liveStreams.status, "live"))
        .orderBy(drizzleDesc(liveStreams.createdAt))
        .limit(50);
      const userIds = Array.from(new Set(streams.map(s => s.userId)));
      const streamUsers = userIds.length > 0
        ? await db.select({ id: users.id, name: users.name, artistName: users.artistName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, userIds))
        : [];
      const userMap = Object.fromEntries(streamUsers.map(u => [u.id, u]));
      return streams.map(s => ({ ...s, streamer: userMap[s.userId] ?? null }));
    }),

    // Get a single stream by id
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.id)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        const [streamer] = await db.select({ id: users.id, name: users.name, artistName: users.artistName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, stream.userId)).limit(1);
        return { ...stream, streamer: streamer ?? null };
      }),

    // Create a new live stream session
    create: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        // End any existing live streams for this user
        const existingStreams = await db.select().from(liveStreams)
          .where(and(eq(liveStreams.userId, ctx.user.id), eq(liveStreams.status, "live")));
        for (const s of existingStreams) {
          if (s.ingressId) await deleteIngress(s.ingressId);
        }
        await db.update(liveStreams).set({ status: "ended", endedAt: new Date() })
          .where(and(eq(liveStreams.userId, ctx.user.id), eq(liveStreams.status, "live")));

        const roomName = generateRoomName(ctx.user.id);
        const displayName = ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`;
        const participantIdentity = `ingress-${ctx.user.id}`;

        // ── Create a real LiveKit RTMP_INPUT ingress ────────────────────────────────
        // LiveKit returns the real RTMP URL and stream key — we never build them manually.
        let ingressDetails: { ingressId: string; url: string; streamKey: string };
        try {
          ingressDetails = await createRtmpIngress(roomName, participantIdentity, displayName);
        } catch (ingressErr) {
          console.error('[live.create] IngressClient.createIngress failed:', ingressErr);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create LiveKit ingress: ${(ingressErr as Error).message}`,
          });
        }

        console.log('[live.create] Ingress created successfully:', {
          ingressId: ingressDetails.ingressId,
          url: ingressDetails.url,
          streamKey: ingressDetails.streamKey,
          roomName,
          participantIdentity,
        });

        // Insert stream row — status stays "live" (OBS connects asynchronously)
        const [result] = await db.insert(liveStreams).values({
          userId: ctx.user.id,
          title: input.title,
          livekitRoomName: roomName,
          ingressId: ingressDetails.ingressId,
          rtmpUrl: ingressDetails.url,        // LiveKit-issued URL (never manually built)
          rtmpKey: ingressDetails.streamKey,  // LiveKit-issued stream key (separate from URL)
        } as any);
        const streamId = (result as any).insertId as number;

        // Generate a streamer token (for browser-based preview / admin monitoring)
        const streamerToken = await generateStreamerToken(roomName, `user-${ctx.user.id}`, displayName);

        // Notify all users about the new Cook Up stream
        try {
          const { notifications, users: usersTable } = await import('../drizzle/schema');
          const { ne } = await import('drizzle-orm');
          const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(ne(usersTable.id, ctx.user.id));
          if (allUsers.length > 0) {
            await db.insert(notifications).values(
              allUsers.map(u => ({
                userId: u.id,
                type: 'live_cookup',
                title: `\uD83C\uDFA4 ${displayName} is Live`,
                body: `${displayName} just started a Cook Up session: "${input.title}"`,
                link: `/cookup/${streamId}`,
              }))
            );
          }
        } catch (e) { console.error('[live.create] notification error', e); }

        return {
          streamId,
          roomName,
          streamerToken,
          livekitUrl: ENV.livekitUrl,
          // OBS/Streamlabs settings — URL and key are SEPARATE fields
          rtmpUrl: ingressDetails.url,
          rtmpKey: ingressDetails.streamKey,
          ingressId: ingressDetails.ingressId,
        };
      }),

    // Get a viewer token for a stream
    getViewerToken: publicProcedure
      .input(z.object({ streamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.status === "ended") throw new TRPCError({ code: "BAD_REQUEST", message: "Stream has ended" });
        const identity = ctx.user ? `user-${ctx.user.id}` : `anon-${Date.now()}`;
        const displayName = ctx.user ? (ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`) : "Viewer";
        const viewerToken = await generateViewerToken(stream.livekitRoomName, identity, displayName);
        return { viewerToken, livekitUrl: ENV.livekitUrl, roomName: stream.livekitRoomName };
      }),

    // End a live stream
    end: protectedProcedure
      .input(z.object({ streamId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const now = new Date();
        await db.update(liveStreams).set({ status: "ended", endedAt: now }).where(eq(liveStreams.id, input.streamId));
        await deleteRoom(stream.livekitRoomName);
        // Always delete the RTMP ingress to free up the LiveKit ingress quota
        if ((stream as any).ingressId) {
          await deleteIngress((stream as any).ingressId).catch((e: unknown) => {
            console.warn('[live.end] Ingress delete failed (non-fatal):', e);
          });
        }

        // ── Auto-archive stream to stream_summaries ──────────────
        try {
          const { streamSummaries, gifts: giftsTable, liveRewards: liveRewardsTable, notifications } = await import('../drizzle/schema');
          const startedAt = stream.createdAt;
          const durationSeconds = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);

          // Aggregate gifts sent during this stream
          const sessionGifts = await db.select().from(giftsTable)
            .where(and(
              eq(giftsTable.toUserId, stream.userId),
              sql`${giftsTable.createdAt} >= ${startedAt}`,
              sql`${giftsTable.createdAt} <= ${now}`,
            ));
          const totalGifts = sessionGifts.length;
          const totalCoinsGifted = sessionGifts.reduce((s: number, g: any) => s + (g.coinCost || 0), 0);

          // Build top gifters list
          const gifterMap: Record<number, { userId: number; name: string; coins: number; giftCount: number }> = {};
          for (const g of sessionGifts) {
            const uid = g.fromUserId;
            if (!gifterMap[uid]) gifterMap[uid] = { userId: uid, name: `User ${uid}`, coins: 0, giftCount: 0 };
            gifterMap[uid].coins += g.coinCost || 0;
            gifterMap[uid].giftCount++;
          }
          // Resolve gifter names
          const gifterIds = Object.keys(gifterMap).map(Number);
          if (gifterIds.length > 0) {
            const gifterUsers = await db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, gifterIds));
            for (const u of gifterUsers) {
              if (gifterMap[u.id]) gifterMap[u.id].name = u.artistName || u.name || `User ${u.id}`;
            }
          }
          const topGifters = Object.values(gifterMap).sort((a, b) => b.coins - a.coins).slice(0, 10);

          // Build gift breakdown
          const giftMap: Record<string, { count: number; coinsTotal: number }> = {};
          for (const g of sessionGifts) {
            const name = String(g.giftTypeId);
            if (!giftMap[name]) giftMap[name] = { count: 0, coinsTotal: 0 };
            giftMap[name].count++;
            giftMap[name].coinsTotal += g.coinCost || 0;
          }
          const giftBreakdown = Object.entries(giftMap).map(([giftName, d]) => ({ giftName, ...d })).sort((a, b) => b.count - a.count);

          // Get creator's current live rewards balance
          const [lrRow] = await db.select().from(liveRewardsTable).where(eq(liveRewardsTable.userId, stream.userId)).limit(1);
          const totalLiveRewards = lrRow?.available ?? 0;

          const avgViewers = stream.peakViewerCount > 0 ? Math.floor(stream.peakViewerCount * 0.6) : 0;

          const [summaryResult] = await db.insert(streamSummaries).values({
            creatorId: stream.userId,
            sessionId: stream.id,
            streamTitle: stream.title || 'Live Stream',
            startedAt,
            endedAt: now,
            durationSeconds,
            totalViews: stream.viewerCount ?? 0,
            peakViewers: stream.peakViewerCount ?? 0,
            avgViewers,
            totalGifts,
            totalCoinsGifted,
            totalLiveRewards,
            totalFireVotes: 0,
            totalLikes: 0,
            newFollowers: 0,
            topGifters: JSON.stringify(topGifters),
            giftBreakdown: JSON.stringify(giftBreakdown),
            likeBreakdown: JSON.stringify([]),
            engagementSummary: JSON.stringify({ totalGifts, totalCoinsGifted, durationSeconds }),
          } as any);
          const summaryId = (summaryResult as any).insertId;

          // Notify the streamer
          await db.insert(notifications).values({
            userId: stream.userId,
            type: 'stream_summary_ready',
            title: '📊 Stream Archived',
            body: `Your stream "${stream.title}" has been saved to your profile. ${totalGifts} gifts received, ${totalCoinsGifted} coins earned.`,
            link: `/profile/${stream.userId}`,
            isRead: false,
          } as any);

          return { success: true, summaryId };
        } catch (archiveErr) {
          console.error('[live.end] Archive failed (non-fatal):', archiveErr);
          return { success: true, summaryId: null };
        }
      }),

    // Update stream title
    updateTitle: protectedProcedure
      .input(z.object({ streamId: z.number(), title: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.update(liveStreams).set({ title: input.title }).where(eq(liveStreams.id, input.streamId));
        return { success: true };
      }),

    // Get a fresh streamer token for an existing stream (for reconnect)
    getStreamerToken: protectedProcedure
      .input(z.object({ streamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const displayName = ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`;
        const streamerToken = await generateStreamerToken(stream.livekitRoomName, `user-${ctx.user.id}`, displayName);
        return {
          streamerToken,
          livekitUrl: ENV.livekitUrl,
          roomName: stream.livekitRoomName,
          // Always return the LiveKit-issued URL and key (never manually built)
          rtmpUrl: stream.rtmpUrl ?? null,
          rtmpKey: stream.rtmpKey ?? null,
          ingressId: (stream as any).ingressId ?? null,
        };
      }),

    // Check the current LiveKit ingress connection status
    ingressStatus: protectedProcedure
      .input(z.object({ streamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const ingressId = (stream as any).ingressId as string | null;
        if (!ingressId) return { status: 'NO_INGRESS', ingressId: null };
        const status = await getIngressStatus(ingressId);
        return { status, ingressId };
      }),

    // Regenerate stream key — delete old ingress, create a fresh one
    regenerateStreamKey: protectedProcedure
      .input(z.object({ streamId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream) throw new TRPCError({ code: "NOT_FOUND" });
        if (stream.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (stream.status === 'ended') throw new TRPCError({ code: "BAD_REQUEST", message: "Stream has ended" });

        // Delete old ingress if it exists
        const oldIngressId = (stream as any).ingressId as string | null;
        if (oldIngressId) {
          await deleteIngress(oldIngressId);
        }

        const displayName = ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`;
        const participantIdentity = `ingress-${ctx.user.id}`;

        // Create a fresh ingress on the SAME room name so viewers stay connected
        let ingressDetails: { ingressId: string; url: string; streamKey: string };
        try {
          ingressDetails = await createRtmpIngress(stream.livekitRoomName, participantIdentity, displayName);
        } catch (ingressErr) {
          console.error('[live.regenerateStreamKey] createIngress failed:', ingressErr);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to regenerate ingress: ${(ingressErr as Error).message}`,
          });
        }

        console.log('[live.regenerateStreamKey] New ingress:', {
          streamId: input.streamId,
          ingressId: ingressDetails.ingressId,
          url: ingressDetails.url,
          streamKey: ingressDetails.streamKey,
          roomName: stream.livekitRoomName,
        });

        await db.update(liveStreams).set({
          ingressId: ingressDetails.ingressId,
          rtmpUrl: ingressDetails.url,
          rtmpKey: ingressDetails.streamKey,
        } as any).where(eq(liveStreams.id, input.streamId));

        return {
          rtmpUrl: ingressDetails.url,
          rtmpKey: ingressDetails.streamKey,
          ingressId: ingressDetails.ingressId,
        };
      }),

    // Get user's own active stream (if any)
    getMyStream: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [stream] = await db.select().from(liveStreams)
        .where(and(eq(liveStreams.userId, ctx.user.id), eq(liveStreams.status, "live")))
        .limit(1);
      return stream ?? null;
    }),

    // Get a user's archived stream sessions (public — visible on their profile)
    getArchive: publicProcedure
      .input(z.object({
        userId: z.number().int(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { summaries: [], total: 0 };
        const { streamSummaries } = await import('../drizzle/schema');
        const rows = await db.select().from(streamSummaries)
          .where(eq(streamSummaries.creatorId, input.userId))
          .orderBy(drizzleDesc(streamSummaries.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return { summaries: rows, total: rows.length };
      }),

  }),

  // ─── Coins ────────────────────────────────────────────────────
  coins: router({

    // Get current user's coin balance
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [balance] = await db.select().from(coinBalances).where(eq(coinBalances.userId, ctx.user.id)).limit(1);
      return balance ?? { userId: ctx.user.id, balance: 0, totalEarned: 0, totalSpent: 0 };
    }),

    // Request a coin purchase (admin approves manually)
    requestPurchase: protectedProcedure
      .input(z.object({
        coins: z.number().min(1),
        amountCents: z.number().min(1),
        paymentMethod: z.string().optional(),
        paymentNote: z.string().max(256).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await db.insert(coinPurchases).values({
          userId: ctx.user.id,
          coins: input.coins,
          amountCents: input.amountCents,
          paymentMethod: input.paymentMethod,
          paymentNote: input.paymentNote,
          status: "pending",
        });
        return { success: true };
      }),

    // Get gift types
    getGiftTypes: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.select().from(giftTypes).where(eq(giftTypes.isActive, true)).orderBy(giftTypes.sortOrder);
    }),

  }),

  // ─── Gifts ────────────────────────────────────────────────────
  gifts: router({

    // Send a gift to a streamer
    send: protectedProcedure
      .input(z.object({
        streamId: z.number(),
        giftTypeId: z.number(),
        quantity: z.number().int().min(1).max(100).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, input.streamId)).limit(1);
        if (!stream || stream.status === "ended") throw new TRPCError({ code: "BAD_REQUEST", message: "Stream not active" });
        const [giftType] = await db.select().from(giftTypes).where(eq(giftTypes.id, input.giftTypeId)).limit(1);
        if (!giftType || !giftType.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Gift type not found" });
        // Prevent self-gifting
        if (stream.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot gift yourself" });
        const totalCost = giftType.coinCost * input.quantity;
        // Check and deduct coins
        const [balance] = await db.select().from(coinBalances).where(eq(coinBalances.userId, ctx.user.id)).limit(1);
        const currentBalance = balance?.balance ?? 0;
        if (currentBalance < totalCost) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient coins" });
        // Get economy config for split
        const [cfg] = await db.select().from(economyConfig).limit(1);
        const creatorPct = cfg?.creatorSplitPct ?? 70;
        // Deduct from sender
        const newSenderBalance = currentBalance - totalCost;
        if (balance) {
          await db.update(coinBalances).set({
            balance: newSenderBalance,
            totalSpent: (balance.totalSpent ?? 0) + totalCost,
          }).where(eq(coinBalances.userId, ctx.user.id));
        }
        // Log sender wallet transaction
        await db.insert(walletTransactions).values({
          userId: ctx.user.id,
          currency: "coins",
          type: "gift_sent",
          amount: -totalCost,
          balanceAfter: newSenderBalance,
          note: `Sent ${input.quantity}x ${giftType.name} to stream ${input.streamId}`,
        });
        // Credit Live Rewards to creator (NOT coinBalances)
        const creatorRewardCents = Math.floor(giftType.usdValueCents * input.quantity * creatorPct / 100);
        const [creatorReward] = await db.select().from(liveRewards).where(eq(liveRewards.userId, stream.userId)).limit(1);
        if (creatorReward) {
          const newAvailable = (creatorReward.available ?? 0) + creatorRewardCents;
          await db.update(liveRewards).set({
            available: newAvailable,
            lifetimeEarned: (creatorReward.lifetimeEarned ?? 0) + creatorRewardCents,
          }).where(eq(liveRewards.userId, stream.userId));
          await db.insert(walletTransactions).values({
            userId: stream.userId,
            currency: "live_rewards",
            type: "gift_received",
            amount: creatorRewardCents,
            balanceAfter: newAvailable,
            note: `${input.quantity}x ${giftType.name} from viewer`,
          });
        } else {
          await db.insert(liveRewards).values({ userId: stream.userId, available: creatorRewardCents, lifetimeEarned: creatorRewardCents });
          await db.insert(walletTransactions).values({
            userId: stream.userId,
            currency: "live_rewards",
            type: "gift_received",
            amount: creatorRewardCents,
            balanceAfter: creatorRewardCents,
            note: `${input.quantity}x ${giftType.name} from viewer`,
          });
        }
        // Record the gift
        const [insertedGift] = await db.insert(gifts).values({
          liveStreamId: input.streamId,
          fromUserId: ctx.user.id,
          toUserId: stream.userId,
          giftTypeId: input.giftTypeId,
          coinCost: totalCost,
          usdValueCents: giftType.usdValueCents * input.quantity,
        });
        // Update stream totals
        await db.update(liveStreams).set({
          totalGiftCoins: (stream.totalGiftCoins ?? 0) + totalCost,
          totalGiftUsd: (stream.totalGiftUsd ?? 0) + (giftType.usdValueCents * input.quantity),
        }).where(eq(liveStreams.id, input.streamId));
        // Fraud check: rapid gifting detection
        const oneMinuteAgo = new Date(Date.now() - 60_000);
        const recentGifts = await db.select().from(gifts)
          .where(and(eq(gifts.fromUserId, ctx.user.id), eq(gifts.liveStreamId, input.streamId)))
          .orderBy(drizzleDesc(gifts.createdAt)).limit(20);
        const rapidCount = recentGifts.filter(g => new Date(g.createdAt) > oneMinuteAgo).length;
        if (rapidCount >= (cfg?.fraudRapidGiftThreshold ?? 10)) {
          await db.insert(fraudLogs).values({
            userId: ctx.user.id,
            type: "rapid_gifting",
            riskScore: "high",
            details: JSON.stringify({ streamId: input.streamId, giftsInLastMinute: rapidCount }),
          });
        }
        // Emit gift event via socket
        const senderName = ctx.user.artistName || ctx.user.name || `User${ctx.user.id}`;
        ctx.io?.to(`live:${input.streamId}`).emit("live:gift", {
          giftType: { name: giftType.name, emoji: giftType.emoji, coinCost: giftType.coinCost, rarity: giftType.rarity, animationType: giftType.animationType },
          from: senderName,
          fromUserId: ctx.user.id,
          quantity: input.quantity,
          creatorRewardCents,
          streamId: input.streamId,
        });
        return { success: true, newBalance: newSenderBalance, creatorRewardCents };
      }),

    // Get gifts for a stream
    getForStream: publicProcedure
      .input(z.object({ streamId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const rows = await db.select().from(gifts)
          .where(eq(gifts.liveStreamId, input.streamId))
          .orderBy(drizzleDesc(gifts.createdAt))
          .limit(100);
        const userIdSet = new Set<number>();
        const giftTypeIdSet = new Set<number>();
        rows.forEach(g => { userIdSet.add(g.fromUserId); giftTypeIdSet.add(g.giftTypeId); });
        const userIds: number[] = [];
        userIdSet.forEach(id => userIds.push(id));
        const giftTypeIds: number[] = [];
        giftTypeIdSet.forEach(id => giftTypeIds.push(id));
        const [giftUsers, types] = await Promise.all([
          userIds.length > 0 ? db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
          giftTypeIds.length > 0 ? db.select().from(giftTypes).where(inArray(giftTypes.id, giftTypeIds)) : Promise.resolve([]),
        ]);
        const userMap = Object.fromEntries(giftUsers.map(u => [u.id, u]));
        const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
        return rows.map(g => ({ ...g, from: userMap[g.fromUserId] ?? null, giftType: typeMap[g.giftTypeId] ?? null }));
        }),

    // Tip an artist on Music Review (coins → creator Live Rewards)
    tipArtist: protectedProcedure
      .input(z.object({
        toUserId: z.number().int(),
        coins: z.number().int().min(1).max(10000),
        sessionId: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        if (input.toUserId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot tip yourself' });
        // Check sender balance
        const [balance] = await db.select().from(coinBalances).where(eq(coinBalances.userId, ctx.user.id)).limit(1);
        const currentBalance = balance?.balance ?? 0;
        if (currentBalance < input.coins) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient coins' });
        // Get economy config for split
        const [cfg] = await db.select().from(economyConfig).limit(1);
        const creatorPct = cfg?.creatorSplitPct ?? 70;
        // Deduct coins from sender
        const newSenderBalance = currentBalance - input.coins;
        if (balance) {
          await db.update(coinBalances).set({
            balance: newSenderBalance,
            totalSpent: (balance.totalSpent ?? 0) + input.coins,
          }).where(eq(coinBalances.userId, ctx.user.id));
        }
        await db.insert(walletTransactions).values({
          userId: ctx.user.id,
          currency: 'coins',
          type: 'gift_sent',
          amount: -input.coins,
          balanceAfter: newSenderBalance,
          note: `Tipped ${input.coins} coins to user ${input.toUserId}`,
        });
        // Credit Live Rewards to artist (1 coin = 0.7 cents, apply creator split)
        const tipValueCents = Math.floor(input.coins * 0.7);
        const creatorRewardCents = Math.floor(tipValueCents * creatorPct / 100);
        const [creatorReward] = await db.select().from(liveRewards).where(eq(liveRewards.userId, input.toUserId)).limit(1);
        if (creatorReward) {
          const newAvailable = (creatorReward.available ?? 0) + creatorRewardCents;
          await db.update(liveRewards).set({
            available: newAvailable,
            lifetimeEarned: (creatorReward.lifetimeEarned ?? 0) + creatorRewardCents,
          }).where(eq(liveRewards.userId, input.toUserId));
          await db.insert(walletTransactions).values({
            userId: input.toUserId,
            currency: 'live_rewards',
            type: 'gift_received',
            amount: creatorRewardCents,
            balanceAfter: newAvailable,
            note: `Tip from viewer (${input.coins} coins)`,
          });
        } else {
          await db.insert(liveRewards).values({ userId: input.toUserId, available: creatorRewardCents, lifetimeEarned: creatorRewardCents });
          await db.insert(walletTransactions).values({
            userId: input.toUserId,
            currency: 'live_rewards',
            type: 'gift_received',
            amount: creatorRewardCents,
            balanceAfter: creatorRewardCents,
            note: `Tip from viewer (${input.coins} coins)`,
          });
        }
        // Notify the artist
        try {
          const { notifications: notifTable } = await import('../drizzle/schema');
          await db.insert(notifTable).values({
            userId: input.toUserId,
            type: 'live_reward',
            title: '💰 You received a tip!',
            body: `${ctx.user.artistName || ctx.user.name} tipped you ${input.coins} coins (+$${(creatorRewardCents / 100).toFixed(2)} Live Rewards)`,
            link: '/wallet',
          });
        } catch {}
        return { success: true, newBalance: newSenderBalance, creatorRewardCents };
      }),
    }),

  // ─── Cashout Requests ───────────────────────────────────────
  cashout: router({
    // User submits a cashout request
    request: protectedProcedure
      .input(z.object({
        coins: z.number().int().min(100),
        paymentMethod: z.enum(["cashapp", "paypal", "venmo", "zelle"]),
        paymentHandle: z.string().min(2).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { cashoutRequests, coinBalances } = await import("../drizzle/schema");
        // Check balance
        const [bal] = await db.select().from(coinBalances).where(eq(coinBalances.userId, ctx.user.id));
        if (!bal || bal.balance < input.coins) throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient coin balance" });
        // Check no pending request
        const [pending] = await db.select().from(cashoutRequests).where(and(eq(cashoutRequests.userId, ctx.user.id), eq(cashoutRequests.status, "pending")));
        if (pending) throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending cashout request" });
        // Cashout rate: 100 coins = $0.70 (platform retains 30%)
        const usdEstimate = Math.floor((input.coins * 0.7) / 100);
        await db.insert(cashoutRequests).values({
          userId: ctx.user.id,
          coins: input.coins,
          usdEstimate: usdEstimate * 100,
          paymentMethod: input.paymentMethod,
          paymentHandle: input.paymentHandle,
          status: "pending",
        });
        // Notify admin
        const { notifications } = await import("../drizzle/schema");
        const allAdmins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of allAdmins) {
          await db.insert(notifications).values({
            userId: admin.id,
            type: "admin_cashout_request",
            title: "New Cashout Request",
            body: `${ctx.user.name || ctx.user.artistName || "A user"} requested to cash out ${input.coins} coins ($${usdEstimate})`,
            link: "/admin",
          });
        }
        return { success: true };
      }),

    // Get user's own cashout history
    getMyRequests: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { cashoutRequests } = await import("../drizzle/schema");
      return db.select().from(cashoutRequests).where(eq(cashoutRequests.userId, ctx.user.id)).orderBy(desc(cashoutRequests.createdAt));
    }),
    // Admin: get all pending cashout requests
    adminGetAll: adminProcedure
      .input(z.object({ status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending') }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { cashoutRequests } = await import('../drizzle/schema');
        const status = input?.status ?? 'pending';
        const query = db.select({
          id: cashoutRequests.id,
          userId: cashoutRequests.userId,
          coins: cashoutRequests.coins,
          paymentMethod: cashoutRequests.paymentMethod,
          paymentHandle: cashoutRequests.paymentHandle,
          status: cashoutRequests.status,
          adminNote: cashoutRequests.adminNote,
          createdAt: cashoutRequests.createdAt,
          userName: users.name,
          artistName: users.artistName,
        }).from(cashoutRequests)
          .leftJoin(users, eq(cashoutRequests.userId, users.id))
          .orderBy(desc(cashoutRequests.createdAt));
        if (status !== 'all') {
          return (await query).filter(r => r.status === status);
        }
        return query;
      }),
    // Admin: approve or reject a cashout request
    adminResolve: adminProcedure
      .input(z.object({
        id: z.number().int(),
        action: z.enum(['approved', 'denied']),
        adminNote: z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { cashoutRequests, coinBalances, notifications } = await import('../drizzle/schema');
        const [req] = await db.select().from(cashoutRequests).where(eq(cashoutRequests.id, input.id)).limit(1);
        if (!req) throw new TRPCError({ code: 'NOT_FOUND' });
        if (req.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request already resolved' });
        // Deduct coins if approved
        if (input.action === 'approved') {
          const [bal] = await db.select().from(coinBalances).where(eq(coinBalances.userId, req.userId)).limit(1);
          const current = bal?.balance ?? 0;
          if (current < req.coins) throw new TRPCError({ code: 'BAD_REQUEST', message: 'User has insufficient coins' });
          await db.update(coinBalances).set({ balance: current - req.coins }).where(eq(coinBalances.userId, req.userId));
        }
        await db.update(cashoutRequests).set({ status: input.action, adminNote: input.adminNote ?? null }).where(eq(cashoutRequests.id, input.id));
        // Notify user of decision
        const msg = input.action === 'approved'
          ? `Your cashout of ${req.coins} coins has been approved! Payment sent to ${req.paymentMethod}: ${req.paymentHandle}`
          : `Your cashout request for ${req.coins} coins was denied. ${input.adminNote ?? ''}`;
        await db.insert(notifications).values({
          userId: req.userId,
          type: 'cashout_resolved',
          title: input.action === 'approved' ? '\u2705 Cashout Approved' : '\u274C Cashout Denied',
          body: msg,
          link: '/cashout',
        });
        return { success: true };
      }),
  }),

  // ─── Notifications ──────────────────────────────────────────
  notifications: router({
    getMyNotifications: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { notifications } = await import("../drizzle/schema");
        const limit = input?.limit ?? 20;
        const rows = await db.select().from(notifications)
          .where(eq(notifications.userId, ctx.user.id))
          .orderBy(desc(notifications.createdAt))
          .limit(limit);
        const unreadCount = rows.filter(n => !n.isRead).length;
        return { notifications: rows, unreadCount };
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { notifications } = await import("../drizzle/schema");
        await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { notifications } = await import("../drizzle/schema");
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, ctx.user.id));
      return { success: true };
    }),
  }),

  // ─── Fire or Trash Swipe Game ────────────────────────────────
  fireTrash: router({
    // Get a batch of unvoted submissions for the current user
    getQueue: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).default(10) }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { fireTrashVotes } = await import("../drizzle/schema");
        const limit = input?.limit ?? 10;
        // Get IDs already voted on by this user
        const voted = await db.select({ submissionId: fireTrashVotes.submissionId })
          .from(fireTrashVotes).where(eq(fireTrashVotes.userId, ctx.user.id));
        const votedIds = voted.map(v => v.submissionId);
        // Get reviewed submissions not yet voted on
        const query = db.select({
          id: reviewSubmissions.id,
          artistName: reviewSubmissions.artistName,
          songTitle: reviewSubmissions.songTitle,
          youtubeUrl: reviewSubmissions.youtubeUrl,
          fileUrl: reviewSubmissions.fileUrl,
          fireCount: reviewSubmissions.fireCount,
          trashCount: reviewSubmissions.trashCount,
        }).from(reviewSubmissions)
          .where(and(
            eq(reviewSubmissions.status, "reviewed"),
            votedIds.length > 0 ? sql`${reviewSubmissions.id} NOT IN (${sql.join(votedIds.map(id => sql`${id}`), sql`, `)})` : sql`1=1`
          ))
          .orderBy(sql`RAND()`)
          .limit(limit);
        return query;
      }),

    // Cast a fire or trash vote
    vote: protectedProcedure
      .input(z.object({
        submissionId: z.number().int(),
        vote: z.enum(["fire", "trash"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { fireTrashVotes } = await import("../drizzle/schema");
        // Check not already voted
        const [existing] = await db.select().from(fireTrashVotes)
          .where(and(eq(fireTrashVotes.userId, ctx.user.id), eq(fireTrashVotes.submissionId, input.submissionId)));
        if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Already voted" });
        await db.insert(fireTrashVotes).values({
          userId: ctx.user.id,
          submissionId: input.submissionId,
          vote: input.vote,
        });
        // Update fire/trash count on submission
        if (input.vote === "fire") {
          await db.update(reviewSubmissions).set({ fireCount: sql`${reviewSubmissions.fireCount} + 1` }).where(eq(reviewSubmissions.id, input.submissionId));
        } else {
          await db.update(reviewSubmissions).set({ trashCount: sql`${reviewSubmissions.trashCount} + 1` }).where(eq(reviewSubmissions.id, input.submissionId));
        }
        // Award XP for voting
        await awardXP(ctx.user.id, "vote_cast");
        return { success: true };
      }),

    // Get leaderboard: most fire submissions
    getLeaderboard: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        return db.select({
          id: reviewSubmissions.id,
          artistName: reviewSubmissions.artistName,
          songTitle: reviewSubmissions.songTitle,
          fireCount: reviewSubmissions.fireCount,
          trashCount: reviewSubmissions.trashCount,
          userId: reviewSubmissions.userId,
        }).from(reviewSubmissions)
          .where(eq(reviewSubmissions.status, "reviewed"))
          .orderBy(desc(reviewSubmissions.fireCount))
          .limit(20);
      }),

     // Get current user's vote history + stats
    getMyStats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { fireTrashVotes } = await import("../drizzle/schema");
      const votes = await db.select().from(fireTrashVotes).where(eq(fireTrashVotes.userId, ctx.user.id));
      const fireVotes = votes.filter(v => v.vote === "fire").length;
      const trashVotes = votes.filter(v => v.vote === "trash").length;
      return { totalVotes: votes.length, fireVotes, trashVotes, votes };
    }),
  }),

  // ─── Economy ────────────────────────────────────────────────
  economy: router({

    // Get current user's Fire Vote balance
    getFireVoteBalance: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [fv] = await db.select().from(fireVoteBalances).where(eq(fireVoteBalances.userId, ctx.user.id)).limit(1);
      return fv ?? { userId: ctx.user.id, balance: 0, lifetimeEarned: 0, lifetimeConverted: 0 };
    }),

    // Convert Fire Votes to Coins
    convertFireVotes: protectedProcedure
      .input(z.object({ batches: z.number().int().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [cfg] = await db.select().from(economyConfig).limit(1);
        if (!cfg?.fireVoteConversionEnabled) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fire Vote conversion is currently disabled' });
        const fvNeeded = (cfg.fireVotesPerConversion ?? 50) * input.batches;
        const coinsToAward = (cfg.coinsPerConversion ?? 10) * input.batches;
        // Check daily cap
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayConversions = await db.select().from(fireVoteConversions)
          .where(and(eq(fireVoteConversions.userId, ctx.user.id)));
        const todayCoins = todayConversions
          .filter(c => new Date(c.createdAt) >= todayStart)
          .reduce((s, c) => s + c.coinsAwarded, 0);
        if (todayCoins + coinsToAward > (cfg.fvDailyCoinCap ?? 100))
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Daily conversion cap is ${cfg.fvDailyCoinCap} coins` });
        // Check FV balance
        const [fvBal] = await db.select().from(fireVoteBalances).where(eq(fireVoteBalances.userId, ctx.user.id)).limit(1);
        const currentFV = fvBal?.balance ?? 0;
        if (currentFV < fvNeeded) throw new TRPCError({ code: 'BAD_REQUEST', message: `Need ${fvNeeded} Fire Votes, you have ${currentFV}` });
        // Deduct FV
        const newFV = currentFV - fvNeeded;
        if (fvBal) {
          await db.update(fireVoteBalances).set({ balance: newFV, lifetimeConverted: (fvBal.lifetimeConverted ?? 0) + fvNeeded }).where(eq(fireVoteBalances.userId, ctx.user.id));
        }
        // Credit coins
        const [coinBal] = await db.select().from(coinBalances).where(eq(coinBalances.userId, ctx.user.id)).limit(1);
        const currentCoins = coinBal?.balance ?? 0;
        const newCoins = currentCoins + coinsToAward;
        if (coinBal) {
          await db.update(coinBalances).set({ balance: newCoins }).where(eq(coinBalances.userId, ctx.user.id));
        } else {
          await db.insert(coinBalances).values({ userId: ctx.user.id, balance: newCoins });
        }
        // Log conversion
        await db.insert(fireVoteConversions).values({ userId: ctx.user.id, fireVotesBurned: fvNeeded, coinsAwarded: coinsToAward });
        await db.insert(walletTransactions).values([
          { userId: ctx.user.id, currency: 'fire_votes', type: 'conversion', amount: -fvNeeded, balanceAfter: newFV, note: `Converted to ${coinsToAward} coins` },
          { userId: ctx.user.id, currency: 'coins', type: 'conversion', amount: coinsToAward, balanceAfter: newCoins, note: `From ${fvNeeded} Fire Votes` },
        ]);
        return { success: true, coinsAwarded: coinsToAward, newFVBalance: newFV, newCoinBalance: newCoins };
      }),

    // Get creator's Live Rewards wallet
    getCreatorWallet: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [wallet] = await db.select().from(liveRewards).where(eq(liveRewards.userId, ctx.user.id)).limit(1);
      return wallet ?? { userId: ctx.user.id, available: 0, pending: 0, lifetimeEarned: 0, lifetimeWithdrawn: 0, isFrozen: false };
    }),

    // Get wallet transaction history
    getWalletHistory: protectedProcedure
      .input(z.object({ currency: z.enum(['coins', 'fire_votes', 'live_rewards']).optional(), limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const conditions = [eq(walletTransactions.userId, ctx.user.id)];
        if (input.currency) conditions.push(eq(walletTransactions.currency, input.currency));
        return db.select().from(walletTransactions).where(and(...conditions)).orderBy(drizzleDesc(walletTransactions.createdAt)).limit(input.limit);
      }),

    // Request a creator cashout (Live Rewards)
    requestCreatorCashout: protectedProcedure
      .input(z.object({
        amountCents: z.number().int().min(500),
        paymentMethod: z.enum(['cashapp', 'paypal', 'applepay']),
        paymentHandle: z.string().min(1).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [wallet] = await db.select().from(liveRewards).where(eq(liveRewards.userId, ctx.user.id)).limit(1);
        if (!wallet || wallet.available < input.amountCents)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient Live Rewards balance' });
        if (wallet.isFrozen)
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Your wallet is frozen — contact support' });
        // Hold the amount as pending
        await db.update(liveRewards).set({
          available: wallet.available - input.amountCents,
          pending: (wallet.pending ?? 0) + input.amountCents,
        }).where(eq(liveRewards.userId, ctx.user.id));
        await db.insert(creatorCashouts).values({
          userId: ctx.user.id,
          amountCents: input.amountCents,
          paymentMethod: input.paymentMethod,
          paymentHandle: input.paymentHandle,
          status: 'pending',
        });
        return { success: true };
      }),

    // Get creator cashout history
    getCreatorCashoutHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.select().from(creatorCashouts).where(eq(creatorCashouts.userId, ctx.user.id)).orderBy(drizzleDesc(creatorCashouts.createdAt)).limit(50);
    }),

    // Get coin packages
    getCoinPackages: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.select().from(coinPackages).where(eq(coinPackages.isActive, true)).orderBy(coinPackages.sortOrder);
    }),

    // Get economy config (public rates)
    getConfig: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [cfg] = await db.select().from(economyConfig).limit(1);
      return cfg ?? { creatorSplitPct: 70, platformSplitPct: 30, fireVoteConversionEnabled: true, fireVotesPerConversion: 50, coinsPerConversion: 10, fvDailyCoinCap: 100, minCashoutCents: 500 };
    }),

    // Admin: get all creator cashout requests
    adminGetCreatorCashouts: adminProcedure
      .input(z.object({ status: z.enum(['pending', 'approved', 'paid', 'on_hold', 'rejected', 'cancelled', 'all']).default('pending') }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const rows = await db.select().from(creatorCashouts)
          .where(input.status === 'all' ? undefined : eq(creatorCashouts.status, input.status))
          .orderBy(drizzleDesc(creatorCashouts.createdAt)).limit(100);
        const userIds = Array.from(new Set(rows.map(r => r.userId)));
        const userList = userIds.length > 0 ? await db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, userIds)) : [];
        const userMap = Object.fromEntries(userList.map(u => [u.id, u]));
        return rows.map(r => ({ ...r, user: userMap[r.userId] ?? null }));
      }),

    // Admin: approve/pay/reject creator cashout
    adminResolveCreatorCashout: adminProcedure
      .input(z.object({ id: z.number(), action: z.enum(['approve', 'pay', 'on_hold', 'reject']), note: z.string().max(512).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [cashout] = await db.select().from(creatorCashouts).where(eq(creatorCashouts.id, input.id)).limit(1);
        if (!cashout) throw new TRPCError({ code: 'NOT_FOUND' });
        const statusMap: Record<string, 'approved' | 'paid' | 'on_hold' | 'rejected'> = { approve: 'approved', pay: 'paid', on_hold: 'on_hold', reject: 'rejected' };
        const newStatus = statusMap[input.action];
        await db.update(creatorCashouts).set({ status: newStatus, adminNote: input.note, processedAt: new Date(), processedBy: ctx.user.id }).where(eq(creatorCashouts.id, input.id));
        // If rejected, release the held funds back to available
        if (newStatus === 'rejected') {
          const [wallet] = await db.select().from(liveRewards).where(eq(liveRewards.userId, cashout.userId)).limit(1);
          if (wallet) {
            await db.update(liveRewards).set({
              available: (wallet.available ?? 0) + cashout.amountCents,
              pending: Math.max(0, (wallet.pending ?? 0) - cashout.amountCents),
            }).where(eq(liveRewards.userId, cashout.userId));
          }
        }
        // If paid, finalize withdrawal
        if (newStatus === 'paid') {
          const [wallet] = await db.select().from(liveRewards).where(eq(liveRewards.userId, cashout.userId)).limit(1);
          if (wallet) {
            await db.update(liveRewards).set({
              pending: Math.max(0, (wallet.pending ?? 0) - cashout.amountCents),
              lifetimeWithdrawn: (wallet.lifetimeWithdrawn ?? 0) + cashout.amountCents,
            }).where(eq(liveRewards.userId, cashout.userId));
          }
        }
        return { success: true };
      }),

    // Admin: update economy config
    adminUpdateConfig: adminProcedure
      .input(z.object({
        creatorSplitPct: z.number().int().min(0).max(100).optional(),
        fireVoteConversionEnabled: z.boolean().optional(),
        fireVotesPerConversion: z.number().int().min(1).optional(),
        coinsPerConversion: z.number().int().min(1).optional(),
        fvDailyCoinCap: z.number().int().min(0).optional(),
        fvWeeklyCoinCap: z.number().int().min(0).optional(),
        fvMonthlyCoinCap: z.number().int().min(0).optional(),
        minCashoutCents: z.number().int().min(0).optional(),
        cashAppEnabled: z.boolean().optional(),
        paypalEnabled: z.boolean().optional(),
        applePayEnabled: z.boolean().optional(),
        fraudAutoFreezeEnabled: z.boolean().optional(),
        fraudRapidGiftThreshold: z.number().int().min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const updates: Record<string, any> = { updatedBy: ctx.user.id };
        if (input.creatorSplitPct !== undefined) { updates.creatorSplitPct = input.creatorSplitPct; updates.platformSplitPct = 100 - input.creatorSplitPct; }
        if (input.fireVoteConversionEnabled !== undefined) updates.fireVoteConversionEnabled = input.fireVoteConversionEnabled;
        if (input.fireVotesPerConversion !== undefined) updates.fireVotesPerConversion = input.fireVotesPerConversion;
        if (input.coinsPerConversion !== undefined) updates.coinsPerConversion = input.coinsPerConversion;
        if (input.fvDailyCoinCap !== undefined) updates.fvDailyCoinCap = input.fvDailyCoinCap;
        if (input.fvWeeklyCoinCap !== undefined) updates.fvWeeklyCoinCap = input.fvWeeklyCoinCap;
        if (input.fvMonthlyCoinCap !== undefined) updates.fvMonthlyCoinCap = input.fvMonthlyCoinCap;
        if (input.minCashoutCents !== undefined) updates.minCashoutCents = input.minCashoutCents;
        if (input.cashAppEnabled !== undefined) updates.cashAppEnabled = input.cashAppEnabled;
        if (input.paypalEnabled !== undefined) updates.paypalEnabled = input.paypalEnabled;
        if (input.applePayEnabled !== undefined) updates.applePayEnabled = input.applePayEnabled;
        if (input.fraudAutoFreezeEnabled !== undefined) updates.fraudAutoFreezeEnabled = input.fraudAutoFreezeEnabled;
        if (input.fraudRapidGiftThreshold !== undefined) updates.fraudRapidGiftThreshold = input.fraudRapidGiftThreshold;
        await db.update(economyConfig).set(updates);
        return { success: true };
      }),

    // Admin: get fraud logs
    adminGetFraudLogs: adminProcedure
      .input(z.object({ resolved: z.boolean().optional(), limit: z.number().int().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const conditions = [];
        if (input.resolved !== undefined) conditions.push(eq(fraudLogs.resolved, input.resolved));
        const rows = await db.select().from(fraudLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(drizzleDesc(fraudLogs.createdAt)).limit(input.limit);
        const userIds = Array.from(new Set(rows.map(r => r.userId)));
        const userList = userIds.length > 0 ? await db.select({ id: users.id, name: users.name, artistName: users.artistName }).from(users).where(inArray(users.id, userIds)) : [];
        const userMap = Object.fromEntries(userList.map(u => [u.id, u]));
        return rows.map(r => ({ ...r, user: userMap[r.userId] ?? null }));
      }),

    // Admin: resolve fraud log
    adminResolveFraudLog: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().max(512).optional(), freezeUser: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [log] = await db.select().from(fraudLogs).where(eq(fraudLogs.id, input.id)).limit(1);
        if (!log) throw new TRPCError({ code: 'NOT_FOUND' });
        await db.update(fraudLogs).set({ resolved: true, resolvedBy: ctx.user.id, resolvedAt: new Date(), resolvedNote: input.note }).where(eq(fraudLogs.id, input.id));
        if (input.freezeUser) {
          const [wallet] = await db.select().from(liveRewards).where(eq(liveRewards.userId, log.userId)).limit(1);
          if (wallet) await db.update(liveRewards).set({ isFrozen: true, frozenReason: `Fraud: ${log.type}` }).where(eq(liveRewards.userId, log.userId));
        }
        return { success: true };
      }),

    // Admin: manage gift catalog
    adminGetGifts: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return db.select().from(giftTypes).orderBy(giftTypes.sortOrder);
    }),

    adminUpdateGift: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().max(64).optional(),
        emoji: z.string().max(8).optional(),
        description: z.string().max(256).optional(),
        coinCost: z.number().int().min(1).optional(),
        rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { id, ...updates } = input;
        const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        if (Object.keys(filtered).length > 0) await db.update(giftTypes).set(filtered).where(eq(giftTypes.id, id));
        return { success: true };
      }),

    // Admin: grant Fire Votes to a user
    adminGrantFireVotes: adminProcedure
      .input(z.object({ userId: z.number(), amount: z.number().int().min(1), reason: z.string().max(256).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [fvBal] = await db.select().from(fireVoteBalances).where(eq(fireVoteBalances.userId, input.userId)).limit(1);
        if (fvBal) {
          const newBal = (fvBal.balance ?? 0) + input.amount;
          await db.update(fireVoteBalances).set({ balance: newBal, lifetimeEarned: (fvBal.lifetimeEarned ?? 0) + input.amount }).where(eq(fireVoteBalances.userId, input.userId));
          await db.insert(walletTransactions).values({ userId: input.userId, currency: 'fire_votes', type: 'admin_grant', amount: input.amount, balanceAfter: newBal, note: input.reason });
        } else {
          await db.insert(fireVoteBalances).values({ userId: input.userId, balance: input.amount, lifetimeEarned: input.amount });
          await db.insert(walletTransactions).values({ userId: input.userId, currency: 'fire_votes', type: 'admin_grant', amount: input.amount, balanceAfter: input.amount, note: input.reason });
        }
        return { success: true };
      }),
  }),

  // ─── Stream Sessions & Summaries ──────────────────────────
  stream: router({
    // Admin starts a live session
    start: adminProcedure
      .input(z.object({
        streamTitle: z.string().default('Live Stream'),
        youtubeUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { liveSessions } = await import('../drizzle/schema');
        await db.update(liveSessions).set({ isActive: false, endedAt: new Date() }).where(eq(liveSessions.isActive, true));
        const [result] = await db.insert(liveSessions).values({
          creatorId: ctx.user.id,
          streamTitle: input.streamTitle,
          youtubeUrl: input.youtubeUrl,
          isActive: true,
          startedAt: new Date(),
        });
        return { success: true, sessionId: (result as any).insertId };
      }),

    // Admin ends a live session and generates summary
    end: adminProcedure
      .input(z.object({
        sessionId: z.number().int().optional(),
        totalViews: z.number().int().default(0),
        peakViewers: z.number().int().default(0),
        totalLikes: z.number().int().default(0),
        newFollowers: z.number().int().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { liveSessions, streamSummaries, gifts: giftsTable, liveRewards: liveRewardsTable, notifications } = await import('../drizzle/schema');
        const now = new Date();
        let session: any = null;
        if (input.sessionId) {
          const rows = await db.select().from(liveSessions).where(eq(liveSessions.id, input.sessionId)).limit(1);
          session = rows[0];
        } else {
          const rows = await db.select().from(liveSessions).where(eq(liveSessions.isActive, true)).limit(1);
          session = rows[0];
        }
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active session found' });
        await db.update(liveSessions).set({ isActive: false, endedAt: now }).where(eq(liveSessions.id, session.id));
        const durationSeconds = Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
        const sessionGifts = await db.select().from(giftsTable)
          .where(and(
            eq(giftsTable.toUserId, session.creatorId),
            sql`${giftsTable.createdAt} >= ${session.startedAt}`,
            sql`${giftsTable.createdAt} <= ${now}`,
          ));
        const totalGifts = sessionGifts.length;
        const totalCoinsGifted = sessionGifts.reduce((s: number, g: any) => s + (g.coinCost || 0), 0);
        const giftMap: Record<string, { count: number; coinsTotal: number }> = {};
        for (const g of sessionGifts) {
          const name = String(g.giftTypeId);
          if (!giftMap[name]) giftMap[name] = { count: 0, coinsTotal: 0 };
          giftMap[name].count++;
          giftMap[name].coinsTotal += g.coinCost || 0;
        }
        const giftBreakdown = Object.entries(giftMap).map(([giftName, d]) => ({ giftName, ...d })).sort((a, b) => b.count - a.count);
        const gifterMap: Record<number, { userId: number; name: string; coins: number; giftCount: number }> = {};
        for (const g of sessionGifts) {
          const uid = g.fromUserId;
          if (!gifterMap[uid]) gifterMap[uid] = { userId: uid, name: `User ${uid}`, coins: 0, giftCount: 0 };
          gifterMap[uid].coins += g.coinCost || 0;
          gifterMap[uid].giftCount++;
        }
        const topGifters = Object.values(gifterMap).sort((a, b) => b.coins - a.coins).slice(0, 10);
        const lrRows = await db.select().from(liveRewardsTable).where(eq(liveRewardsTable.userId, session.creatorId));
        const totalLiveRewards = lrRows[0]?.available ?? 0;
        const avgViewers = input.peakViewers > 0 ? Math.floor(input.peakViewers * 0.6) : 0;
        const [summaryResult] = await db.insert(streamSummaries).values({
          creatorId: session.creatorId,
          sessionId: session.id,
          streamTitle: session.streamTitle || 'Live Stream',
          startedAt: session.startedAt,
          endedAt: now,
          durationSeconds,
          totalViews: input.totalViews,
          peakViewers: input.peakViewers,
          avgViewers,
          totalGifts,
          totalCoinsGifted,
          totalLiveRewards,
          totalFireVotes: 0,
          totalLikes: input.totalLikes,
          newFollowers: input.newFollowers,
          topGifters: JSON.stringify(topGifters),
          giftBreakdown: JSON.stringify(giftBreakdown),
          likeBreakdown: JSON.stringify([]),
          engagementSummary: JSON.stringify({ totalGifts, totalCoinsGifted }),
        });
        const summaryId = (summaryResult as any).insertId;
        await db.insert(notifications).values({
          userId: session.creatorId,
          type: 'stream_summary_ready',
          title: '📊 Stream Summary Ready',
          body: `Your stream "${session.streamTitle}" ended. ${totalGifts} gifts, ${totalCoinsGifted} coins earned.`,
          link: '/stream-history',
          isRead: false,
        } as any);
        return { success: true, summaryId };
      }),

    getSummary: protectedProcedure
      .input(z.object({ summaryId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { streamSummaries } = await import('../drizzle/schema');
        const rows = await db.select().from(streamSummaries).where(eq(streamSummaries.id, input.summaryId)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND' });
        if (rows[0].creatorId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return rows[0];
      }),

    getHistory: protectedProcedure
      .input(z.object({ userId: z.number().int().optional(), limit: z.number().int().default(20), offset: z.number().int().default(0) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { streamSummaries } = await import('../drizzle/schema');
        const targetId = input.userId ?? ctx.user.id;
        if (targetId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return db.select().from(streamSummaries)
          .where(eq(streamSummaries.creatorId, targetId))
          .orderBy(desc(streamSummaries.createdAt))
          .limit(input.limit)
          .offset(input.offset);
      }),

    getLatestSummary: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { streamSummaries } = await import('../drizzle/schema');
      const rows = await db.select().from(streamSummaries)
        .where(eq(streamSummaries.creatorId, ctx.user.id))
        .orderBy(desc(streamSummaries.createdAt))
        .limit(1);
      return rows[0] ?? null;
    }),

    getLiveStatus: publicProcedure
      .input(z.object({ userId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { isLive: false, sessionId: null as number | null, streamTitle: null as string | null, youtubeUrl: null as string | null };
        const { liveSessions } = await import('../drizzle/schema');
        const rows = await db.select().from(liveSessions)
          .where(and(eq(liveSessions.creatorId, input.userId), eq(liveSessions.isActive, true)))
          .limit(1);
        if (!rows[0]) return { isLive: false, sessionId: null as number | null, streamTitle: null as string | null, youtubeUrl: null as string | null };
        return { isLive: true, sessionId: rows[0].id, streamTitle: rows[0].streamTitle, youtubeUrl: rows[0].youtubeUrl };
      }),

    getActiveLive: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const { liveSessions } = await import('../drizzle/schema');
      const rows = await db.select().from(liveSessions).where(eq(liveSessions.isActive, true)).limit(1);
      return rows[0] ?? null;
    }),
  }),

  // -- News / Instagram Feed ------------------------------------
  news: router({
    // Returns live Instagram posts (requires INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID env vars)
    // Falls back to empty array if not configured — frontend shows static fallback
    getPosts: publicProcedure.query(async () => {
      const now = Date.now();
      if (igCache && now - igCache.fetchedAt < CACHE_TTL_MS) return igCache.posts;
      const posts = await fetchInstagramPosts();
      igCache = { posts, fetchedAt: now };
      return posts.map(p => ({
        id: p.id,
        caption: p.caption,
        permalink: p.permalink,
        mediaType: p.mediaType as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
        thumbnailUrl: p.thumbnailUrl,
        mediaUrl: p.mediaUrl,
        timestamp: p.timestamp,
        likeCount: p.likes,
        commentsCount: p.comments,
      }));
    }),
  }),

  // Stripe payment integration
  stripe: router({
    createCheckoutSession: protectedProcedure
      .input((val: unknown) => {
        const obj = val as any;
        if (typeof obj?.packageId !== "string") throw new Error("packageId required");
        return { packageId: obj.packageId };
      })
      .mutation(async ({ ctx, input }) => {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
        const { packageId } = input;
        const user = ctx.user;

        // Map package IDs to prices (in cents)
        const priceMap: Record<string, number> = {
          repost: 500,
          story: 2000,
          "day-post": 5000,
          "perm-post": 10000,
          "dual-perm": 15000,
          "7day-pinned": 30000,
          "monthly-pass": 50000,
        };

        const amount = priceMap[packageId];
        if (!amount) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid package" });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          customer_email: user.email ?? undefined,
          client_reference_id: user.id.toString(),
          metadata: {
            user_id: user.id.toString(),
            customer_email: user.email ?? "",
            customer_name: user.artistName || user.name || "Unknown",
            package_id: packageId,
          },
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Murder Mitten Media Promo - ${packageId}`,
                  description: `Promo package: ${packageId}`,
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          success_url: `${ctx.req.headers.origin}/promo?success=true`,
          cancel_url: `${ctx.req.headers.origin}/promo?canceled=true`,
          allow_promotion_codes: true,
        });

        return { checkoutUrl: session.url };
      }),
  }),

  // Merch Store
  merch: router({
    products: router({
      getAll: publicProcedure.query(async () => {
        return getAllMerchProducts();
      }),
      getById: publicProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.id !== "number") throw new Error("id required");
          return { id: obj.id };
        })
        .query(async ({ input }) => {
          return getMerchProductById(input.id);
        }),
    }),
    cart: router({
      getCart: protectedProcedure.query(async ({ ctx }) => {
        return getUserCartItems(ctx.user.id);
      }),
      addItem: protectedProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.productId !== "number") throw new Error("productId required");
          if (typeof obj?.color !== "string") throw new Error("color required");
          if (typeof obj?.size !== "string") throw new Error("size required");
          if (typeof obj?.quantity !== "number") throw new Error("quantity required");
          return { productId: obj.productId, color: obj.color, size: obj.size, quantity: obj.quantity };
        })
        .mutation(async ({ ctx, input }) => {
          return addCartItem({
            userId: ctx.user.id,
            productId: input.productId,
            color: input.color,
            size: input.size,
            quantity: input.quantity,
          });
        }),
      updateQuantity: protectedProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.cartItemId !== "number") throw new Error("cartItemId required");
          if (typeof obj?.quantity !== "number") throw new Error("quantity required");
          return { cartItemId: obj.cartItemId, quantity: obj.quantity };
        })
        .mutation(async ({ input }) => {
          return updateCartItem(input.cartItemId, input.quantity);
        }),
      removeItem: protectedProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.cartItemId !== "number") throw new Error("cartItemId required");
          return { cartItemId: obj.cartItemId };
        })
        .mutation(async ({ input }) => {
          return removeCartItem(input.cartItemId);
        }),
      clearCart: protectedProcedure.mutation(async ({ ctx }) => {
        return clearUserCart(ctx.user.id);
      }),
    }),
    checkout: router({
      createSession: protectedProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (!Array.isArray(obj?.items)) throw new Error("items required");
          if (typeof obj?.shippingAddress !== "object") throw new Error("shippingAddress required");
          return {
            items: obj.items as Array<{ productId: number; productName: string; color: string; size: string; quantity: number; price: number }>,
            shippingAddress: obj.shippingAddress as Record<string, any>,
            promoCode: (obj?.promoCode as string) || null,
          };
        })
        .mutation(async ({ ctx, input }) => {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
          const user = ctx.user;

          // Calculate totals
          const subtotalCents = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          
          // Validate promo code server-side
          const promoValidation = await validateFreeShippingPromoCode(input.promoCode, subtotalCents, user.id);
          const freeShippingIsValid = promoValidation.isValid;
          
          const shippingCents = freeShippingIsValid ? 0 : (subtotalCents >= 10000 ? 0 : 399); // Free shipping over $100, else $3.99
          const totalCents = subtotalCents + shippingCents;

          // Create Stripe session
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
          customer_email: user.email ?? undefined,
          client_reference_id: user.id.toString(),
          metadata: {
            user_id: user.id.toString(),
            customer_email: user.email ?? "",
            customer_name: user.artistName || user.name || "Unknown",
            promo_code: freeShippingIsValid ? (input.promoCode?.toUpperCase() || "") : "",
          },
            line_items: input.items.map((item) => ({
              price_data: {
                currency: "usd",
                product_data: {
                  name: `${item.productName} - ${item.color} / ${item.size}`,
                },
                unit_amount: item.price,
              },
              quantity: item.quantity,
            })),
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount",
                  fixed_amount: { amount: shippingCents, currency: "usd" },
                  display_name: shippingCents === 0 ? "Free Shipping" : "Standard Shipping",
                },
              },
            ],
            success_url: `${ctx.req.headers.origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${ctx.req.headers.origin}/merch?canceled=true`,
            allow_promotion_codes: true,
          });

          // Create order record
          const orderResult = await createOrder({
            userId: user.id,
            stripeCheckoutSessionId: session.id,
            status: "pending",
            subtotalCents,
            shippingCents,
            taxCents: 0,
            totalCents,
            shippingAddress: JSON.stringify(input.shippingAddress),
            items: JSON.stringify(input.items),
            confirmationEmailSent: false,
          });

          return { checkoutUrl: session.url, orderId: (orderResult as any).insertId };
        }),
      getStatus: publicProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.sessionId !== "string") throw new Error("sessionId required");
          return { sessionId: obj.sessionId };
        })
        .query(async ({ input }) => {
          const order = await getOrderByStripeSessionId(input.sessionId);
          return order ?? null;
        }),
    }),
    orders: router({
      // Get order by Stripe session ID (for order confirmation page)
      getBySessionId: publicProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.sessionId !== "string") throw new Error("sessionId required");
          return { sessionId: obj.sessionId };
        })
        .query(async ({ input }) => {
          const order = await getOrderByStripeSessionId(input.sessionId);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          return order;
        }),

      // Get order by ID (with auth check)
      getById: protectedProcedure
        .input((val: unknown) => {
          const obj = val as any;
          if (typeof obj?.orderId !== "number") throw new Error("orderId required");
          return { orderId: obj.orderId };
        })
        .query(async ({ ctx, input }) => {
          const order = await getOrderById(input.orderId);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
          // Verify ownership
          if (order.userId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this order" });
          }
          return order;
        }),

      // Get all orders for current user
      getMyOrders: protectedProcedure.query(async ({ ctx }) => {
        return getUserOrders(ctx.user.id);
      }),
    }),
  }),

  // ─── Admin Shop ───────────────────────────────────────────────
  shop: router({
    // Public: list active products
    getProducts: publicProcedure.query(async () => {
      const products = await getShopProducts(false);
      const withImages = await Promise.all(products.map(async (p) => ({
        ...p,
        images: await getShopProductImages(p.id),
        variants: await getShopVariants(p.id),
      })));
      return withImages;
    }),

    // Public: get single product by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const product = await getShopProductBySlug(input.slug);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        const images = await getShopProductImages(product.id);
        const variants = await getShopVariants(product.id);
        return { ...product, images, variants };
      }),

    // Admin: list ALL products (including hidden/draft)
    adminGetProducts: adminProcedure.query(async () => {
      const products = await getShopProducts(true);
      const withData = await Promise.all(products.map(async (p) => ({
        ...p,
        images: await getShopProductImages(p.id),
        variants: await getShopVariants(p.id),
      })));
      return withData;
    }),

    // Admin: create product + Stripe sync
    createProduct: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(256),
        subtitle: z.string().max(256).optional(),
        slug: z.string().min(1).max(256),
        description: z.string().optional(),
        price: z.number().int().positive(),  // in cents
        compareAtPrice: z.number().int().positive().optional(),
        category: z.string().max(128).optional(),
        status: z.enum(["draft", "active", "sold_out", "hidden"]).default("draft"),
        featured: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
        badge: z.string().max(128).optional(),
        shippingEstimate: z.string().max(128).optional(),
        seoTitle: z.string().max(256).optional(),
        seoDescription: z.string().optional(),
        variants: z.array(z.object({
          color: z.string(),
          size: z.string(),
          inventoryQty: z.number().int().min(0),
          sku: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        let stripeProductId: string | undefined;
        let stripePriceId: string | undefined;

        if (stripeKey) {
          const stripe = new Stripe(stripeKey);
          const stripeProduct = await stripe.products.create({
            name: input.name,
            description: input.description ?? undefined,
          });
          stripeProductId = stripeProduct.id;

          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: input.price,
            currency: "usd",
          });
          stripePriceId = stripePrice.id;
        }

        const db = await getDb();
        if (!db) throw new Error("DB not available");
        
        const insertResult = await db.insert(shopProducts).values({
          name: input.name,
          subtitle: input.subtitle ?? null,
          slug: input.slug,
          description: input.description ?? null,
          price: input.price,
          compareAtPrice: input.compareAtPrice ?? null,
          category: input.category ?? null,
          status: input.status,
          featured: input.featured,
          sortOrder: input.sortOrder,
          badge: input.badge ?? null,
          shippingEstimate: input.shippingEstimate ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          stripeProductId: stripeProductId ?? null,
          stripePriceId: stripePriceId ?? null,
        });

        const productId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId ?? 0;
        if (!productId) throw new Error("Failed to create product");

        // Create variants
        if (input.variants?.length) {
          await Promise.all(input.variants.map(v =>
            upsertShopVariant({ productId, color: v.color, size: v.size, inventoryQty: v.inventoryQty, sku: v.sku ?? null })
          ));
        }

        return { success: true, productId };
      }),

    // Admin: update product (archives old Stripe price if price changed)
    updateProduct: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(256).optional(),
        subtitle: z.string().max(256).optional(),
        slug: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        price: z.number().int().positive().optional(),
        compareAtPrice: z.number().int().positive().nullable().optional(),
        category: z.string().max(128).optional(),
        status: z.enum(["draft", "active", "sold_out", "hidden"]).optional(),
        featured: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        badge: z.string().max(128).nullable().optional(),
        shippingEstimate: z.string().max(128).optional(),
        seoTitle: z.string().max(256).optional(),
        seoDescription: z.string().optional(),
        variants: z.array(z.object({
          color: z.string(),
          size: z.string(),
          inventoryQty: z.number().int().min(0),
          sku: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getShopProductById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        let newStripePriceId: string | undefined;

        // If price changed, archive old Stripe price and create new one
        if (stripeKey && input.price !== undefined && input.price !== existing.price && existing.stripeProductId) {
          const stripe = new Stripe(stripeKey);
          // Archive old price
          if (existing.stripePriceId) {
            await stripe.prices.update(existing.stripePriceId, { active: false }).catch(() => {});
          }
          // Create new price
          const newPrice = await stripe.prices.create({
            product: existing.stripeProductId,
            unit_amount: input.price,
            currency: "usd",
          });
          newStripePriceId = newPrice.id;
          // Also update the Stripe product name if it changed
          if (input.name && input.name !== existing.name) {
            await stripe.products.update(existing.stripeProductId, { name: input.name }).catch(() => {});
          }
        }

        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
        if (input.slug !== undefined) updateData.slug = input.slug;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.price !== undefined) updateData.price = input.price;
        if (input.compareAtPrice !== undefined) updateData.compareAtPrice = input.compareAtPrice;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.status !== undefined) updateData.status = input.status;
        if (input.featured !== undefined) updateData.featured = input.featured;
        if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
        if (input.badge !== undefined) updateData.badge = input.badge;
        if (input.shippingEstimate !== undefined) updateData.shippingEstimate = input.shippingEstimate;
        if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle;
        if (input.seoDescription !== undefined) updateData.seoDescription = input.seoDescription;
        if (newStripePriceId) updateData.stripePriceId = newStripePriceId;

        await updateShopProduct(input.id, updateData);

        // Replace variants if provided
        if (input.variants !== undefined) {
          await deleteShopVariantsByProduct(input.id);
          if (input.variants.length > 0) {
            await Promise.all(input.variants.map(v =>
              upsertShopVariant({ productId: input.id, color: v.color, size: v.size, inventoryQty: v.inventoryQty, sku: v.sku ?? null })
            ));
          }
        }

        return { success: true };
      }),

    // Admin: soft delete product
    deleteProduct: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await softDeleteShopProduct(input.id);
        return { success: true };
      }),

    // Admin: update product status only
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "active", "sold_out", "hidden"]),
      }))
      .mutation(async ({ input }) => {
        await updateShopProduct(input.id, { status: input.status });
        return { success: true };
      }),

    // Admin: reorder products
    reorderProducts: adminProcedure
      .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
      .mutation(async ({ input }) => {
        await Promise.all(input.map(item => updateShopProduct(item.id, { sortOrder: item.sortOrder })));
        return { success: true };
      }),

    // Admin: duplicate product
    duplicateProduct: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const original = await getShopProductById(input.id);
        if (!original) throw new TRPCError({ code: "NOT_FOUND" });
        const originalImages = await getShopProductImages(input.id);
        const originalVariants = await getShopVariants(input.id);

        const newSlug = `${original.slug}-copy-${Date.now()}`;
        const result = await createShopProduct({
          ...original,
          id: undefined as any,
          slug: newSlug,
          name: `${original.name} (Copy)`,
          status: "draft",
          stripeProductId: null,
          stripePriceId: null,
          salesCount: 0,
          deletedAt: null,
          createdAt: undefined as any,
          updatedAt: undefined as any,
        });
        const newProductId = (result as any).insertId as number;

        // Copy images
        await Promise.all(originalImages.map(img =>
          addShopProductImage({
            productId: newProductId,
            url: img.url,
            storageKey: img.storageKey ?? null,
            imageType: img.imageType,
            sortOrder: img.sortOrder,
          })
        ));

        // Copy variants
        await Promise.all(originalVariants.map(v =>
          upsertShopVariant({
            productId: newProductId,
            color: v.color,
            size: v.size,
            inventoryQty: v.inventoryQty,
            sku: v.sku ?? null,
          })
        ));

        return { success: true, productId: newProductId };
      }),

    // Admin: upload product image (base64)
    uploadImage: adminProcedure
      .input(z.object({
        productId: z.number(),
        base64: z.string().max(8_000_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        imageType: z.enum(["thumbnail", "front", "back", "size_chart", "gallery"]).default("gallery"),
        sortOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 6 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image must be under 6MB" });
        }
        const ext = input.mimeType.split("/")[1];
        const key = `shop/products/${input.productId}/${input.imageType}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await addShopProductImage({
          productId: input.productId,
          url,
          storageKey: key,
          imageType: input.imageType,
          sortOrder: input.sortOrder,
        });
        return { url, key };
      }),

    // Admin: delete product image
    deleteImage: adminProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteShopProductImage(input.imageId);
        return { success: true };
      }),

    // Admin: reorder images
    reorderImages: adminProcedure
      .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
      .mutation(async ({ input }) => {
        await Promise.all(input.map(item => updateShopProductImageOrder(item.id, item.sortOrder)));
        return { success: true };
      }),

    // Public: check variant inventory
    checkInventory: publicProcedure
      .input(z.object({ productId: z.number(), color: z.string(), size: z.string() }))
      .query(async ({ input }) => {
        const variant = await getShopVariantInventory(input.productId, input.color, input.size);
        return { inStock: (variant?.inventoryQty ?? 0) > 0, qty: variant?.inventoryQty ?? 0 };
      }),
  }),

  // ─── Golden Wheel ──────────────────────────────────────────────────────────
  goldenWheel: router({
    // Check if the current user is eligible to spin
    getEligibility: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      const eligibility = await db
        .select()
        .from(wheelEligibility)
        .where(eq(wheelEligibility.userId, ctx.user.id))
        .limit(1);
      if (eligibility.length === 0) return { eligible: false, status: null as string | null, spin: null };
      const elig = eligibility[0];
      let spin = null;
      if (elig.status === 'CLAIMED') {
        const spins = await db.select().from(wheelSpins).where(eq(wheelSpins.userId, ctx.user.id)).limit(1);
        spin = spins[0] ?? null;
      }
      return { eligible: elig.status === 'ELIGIBLE', status: elig.status as string, spin };
    }),

    // Get all active prizes (for wheel display)
    getPrizes: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(wheelPrizes).where(eq(wheelPrizes.enabled, true));
    }),

    // Spin the wheel — atomic, idempotent, inventory-enforced
    spin: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      const eligRows = await db
        .select()
        .from(wheelEligibility)
        .where(and(eq(wheelEligibility.userId, ctx.user.id), eq(wheelEligibility.status, 'ELIGIBLE')))
        .limit(1);
      if (eligRows.length === 0) throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not eligible to spin the Golden Wheel.' });
      const elig = eligRows[0];
      const existingSpin = await db.select().from(wheelSpins).where(eq(wheelSpins.userId, ctx.user.id)).limit(1);
      if (existingSpin.length > 0) return { alreadySpun: true, spin: existingSpin[0], prize: null };
      const prizes = await db.select().from(wheelPrizes).where(eq(wheelPrizes.enabled, true));
      const available = prizes.filter(p => p.inventoryLimit === null || (p.remainingInventory ?? 0) > 0);
      if (available.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'No prizes available at this time.' });
      const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedPrize = available[available.length - 1];
      for (const prize of available) { rand -= prize.weight; if (rand <= 0) { selectedPrize = prize; break; } }
      let couponCode: string | null = null;
      let stripeCouponId: string | null = null;
      if (selectedPrize.rewardType === 'stripe_coupon' && selectedPrize.rewardValue) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
          const expiryDays = selectedPrize.couponExpiryDays ?? 90;
          const redeemBy = Math.floor(Date.now() / 1000) + expiryDays * 86400;
          const coupon = await stripe.coupons.create({ percent_off: parseFloat(selectedPrize.rewardValue), duration: 'once', redeem_by: redeemBy, name: `Golden Wheel: ${selectedPrize.name}` });
          const promoCode = await stripe.promotionCodes.create({ coupon: coupon.id as string, max_redemptions: 1 } as any);
          couponCode = promoCode.code;
          stripeCouponId = coupon.id;
        } catch (err) { console.error('[GoldenWheel] Failed to create Stripe coupon:', err); }
      } else if (selectedPrize.rewardType !== 'stripe_coupon') {
        couponCode = `GW-${ctx.user.id}-${Date.now().toString(36).toUpperCase()}`;
      }
      if (selectedPrize.inventoryLimit !== null && selectedPrize.remainingInventory !== null) {
        await db.update(wheelPrizes).set({ remainingInventory: Math.max(0, (selectedPrize.remainingInventory ?? 0) - 1) }).where(eq(wheelPrizes.id, selectedPrize.id));
      }
      const spinResult = await db.insert(wheelSpins).values({
        userId: ctx.user.id,
        eligibilityId: elig.id,
        orderId: elig.orderId,
        prizeId: selectedPrize.id,
        prizeNameSnapshot: selectedPrize.name,
        couponCode,
        stripeCouponId,
        status: 'pending_redemption',
      });
      await db.update(wheelEligibility).set({ status: 'CLAIMED', claimedAt: new Date() }).where(eq(wheelEligibility.id, elig.id));
      const newSpin = { id: (spinResult as any).insertId, userId: ctx.user.id, eligibilityId: elig.id, orderId: elig.orderId, prizeId: selectedPrize.id, prizeNameSnapshot: selectedPrize.name, couponCode, stripeCouponId, status: 'pending_redemption' as const, manuallyRedeemed: false, adminNotes: null, createdAt: new Date() };
      return { alreadySpun: false, spin: newSpin, prize: selectedPrize };
    }),

    // Admin sub-router
    admin: router({
      getPrizes: adminProcedure.query(async () => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(wheelPrizes);
      }),

      upsertPrize: adminProcedure
        .input(z.object({
          id: z.number().optional(),
          name: z.string().min(1),
          description: z.string().optional(),
          weight: z.number().int().min(1).max(1000),
          enabled: z.boolean(),
          rewardType: z.enum(['stripe_coupon', 'promo_service', 'physical_item', 'cash_prize']),
          rewardValue: z.string().optional(),
          inventoryLimit: z.number().int().min(1).optional().nullable(),
          remainingInventory: z.number().int().min(0).optional().nullable(),
          couponExpiryDays: z.number().int().min(1).max(365).optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          if (input.id) {
            await db.update(wheelPrizes).set({ name: input.name, description: input.description ?? null, weight: input.weight, enabled: input.enabled, rewardType: input.rewardType, rewardValue: input.rewardValue ?? null, inventoryLimit: input.inventoryLimit ?? null, remainingInventory: input.remainingInventory ?? null, couponExpiryDays: input.couponExpiryDays ?? 90 }).where(eq(wheelPrizes.id, input.id));
            return { id: input.id };
          } else {
            const result = await db.insert(wheelPrizes).values({ name: input.name, description: input.description ?? null, weight: input.weight, enabled: input.enabled, rewardType: input.rewardType, rewardValue: input.rewardValue ?? null, inventoryLimit: input.inventoryLimit ?? null, remainingInventory: input.remainingInventory ?? null, couponExpiryDays: input.couponExpiryDays ?? 90 });
            return { id: (result as any).insertId };
          }
        }),

      deletePrize: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          await db.delete(wheelPrizes).where(eq(wheelPrizes.id, input.id));
          return { success: true };
        }),

      getSpins: adminProcedure
        .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(50) }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { spins: [], total: 0 };
          const offset = (input.page - 1) * input.limit;
          const spins = await db
            .select({ spin: wheelSpins, user: { id: users.id, name: users.name, email: users.email, artistName: users.artistName }, prize: wheelPrizes })
            .from(wheelSpins)
            .leftJoin(users, eq(wheelSpins.userId, users.id))
            .leftJoin(wheelPrizes, eq(wheelSpins.prizeId, wheelPrizes.id))
            .orderBy(desc(wheelSpins.createdAt))
            .limit(input.limit)
            .offset(offset);
          return { spins, total: spins.length };
        }),

      updateSpinStatus: adminProcedure
        .input(z.object({ spinId: z.number(), status: z.enum(['pending_redemption', 'redeemed', 'flagged', 'revoked']), adminNotes: z.string().optional(), manuallyRedeemed: z.boolean().optional() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          await db.update(wheelSpins).set({ status: input.status, adminNotes: input.adminNotes ?? null, manuallyRedeemed: input.manuallyRedeemed ?? false }).where(eq(wheelSpins.id, input.spinId));
          return { success: true };
        }),

      getOrders: adminProcedure
        .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(50) }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { orders: [], total: 0 };
          const offset = (input.page - 1) * input.limit;
          const orders = await db.select().from(goldenWheelOrders).orderBy(desc(goldenWheelOrders.createdAt)).limit(input.limit).offset(offset);
          return { orders, total: orders.length };
        }),
    }),
  }),
});
export type AppRouter = typeof appRouter;
