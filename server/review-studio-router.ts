import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { desc, eq, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, publicProcedure } from "./_core/trpc";
import { getDb, getSetting, setSetting } from "./db";
import { storagePut } from "./storage";
import { reviewOccurrences, reviewSubmissions, reviewTikTokDeliveries, reviewGiftStreaks, queueState } from "../drizzle/schema";
import { getReviewEventFeed, getReviewStudioSettings, publishReviewEvent, appendReviewEvent, broadcastReviewEvent } from "./review-studio-events";
import { addAdminReviewVotes, recordReviewVoteInTransaction } from "./review-occurrences";
import { withReviewTransportLock } from "./review-transport";
import { parseReviewCommentVote } from "../shared/review-studio";

const audioSources = new Map<string, number>();
const audioCount = () => { for (const [id, time] of Array.from(audioSources.entries())) if (Date.now() - time > 10_000) audioSources.delete(id); return audioSources.size; };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const settingsInput = z.object({
  musicVolume: z.number().min(0).max(1).optional(), soundboardVolume: z.number().min(0).max(1).optional(),
  submissionAlertsEnabled: z.boolean().optional(), tiktokEnabled: z.boolean().optional(),
  tiktokRoomId: z.string().regex(/^\d{5,30}$/, "Use the actual TikTok LIVE room ID").nullable().optional(),
  giftMappings: z.array(z.object({ giftId: z.string().min(1).max(64), soundId: z.string().min(1).max(64) })).max(100).optional(),
});
export const tiktokEventInput = z.object({
  kind: z.enum(["chat", "gift"]), roomId: z.string().regex(/^\d{5,30}$/),
  messageId: z.string().min(1).max(128), userId: z.string().min(1).max(128),
  handle: z.string().max(100).optional(), displayName: z.string().max(128).optional(),
  comment: z.string().max(2000).optional(), occurrenceId: z.string().max(64).optional(),
  giftId: z.string().max(64).optional(), giftType: z.number().int().optional(),
  repeatCount: z.number().int().min(1).max(1000000).optional(), repeatEnd: z.boolean().optional(),
  streakId: z.string().max(128).optional(),
});
export const adminVotesInput = z.object({
  submissionId: z.number().int().positive(),
  occurrenceId: z.string().min(1).max(64).nullish(),
  reaction: z.enum(["fire", "trash"]),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  requestId: z.string().uuid(),
});
export async function ingestTikTokReviewEvent(input: z.infer<typeof tiktokEventInput>) {
  const settings = await getReviewStudioSettings();
  if (!settings.tiktokEnabled || settings.tiktokRoomId !== input.roomId) throw new TRPCError({ code: "FORBIDDEN", message: "Enable the TikFinity connection for this actual live room first." });
  const actor = input.handle ? `@${input.handle.replace(/^@/, "")}` : input.displayName;
  if (!actor) throw new TRPCError({ code: "BAD_REQUEST", message: "The provider must supply an actual handle or display name." });
  const reaction = input.kind === "chat" ? parseReviewCommentVote(input.comment ?? "") : null;
  if (input.kind === "chat" && !reaction) return { accepted: false, reason: "Not an unambiguous FIRE/TRASH vote" };
  if (input.kind === "gift" && (!input.giftId || input.giftType === undefined)) throw new TRPCError({ code: "BAD_REQUEST", message: "Gift ID and gift type are required to resolve real gift receipts safely." });
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const deliveryId = hash(`${input.roomId}:${input.kind}:${input.messageId}`);
  const result = await withReviewTransportLock(() => db.transaction(async (tx) => {
    const [state] = await tx.select().from(queueState).limit(1).for("update");
    const [delivery] = await tx.insert(reviewTikTokDeliveries).ignore().values({ id: deliveryId, timestampMs: Date.now() });
    if (!delivery.affectedRows) return { accepted: false, duplicate: true, event: null };
    if (reaction) {
      if (!state?.currentPlayingId) return { accepted: false, reason: "No live song", event: null };
      const vote = await recordReviewVoteInTransaction(tx, state.currentPlayingId, { platform: "tiktok", platformUserId: input.userId, displayName: actor }, reaction, input.occurrenceId);
      return { accepted: vote.changed, event: vote.event };
    }
    const cumulative = input.repeatCount ?? 1;
    let units = cumulative;
    if (input.giftType === 1) {
      if (input.streakId) {
        const id = hash(`${input.roomId}:${input.userId}:${input.giftId}:${input.streakId}`);
        const [streak] = await tx.select().from(reviewGiftStreaks).where(eq(reviewGiftStreaks.id, id)).limit(1).for("update");
        units = Math.max(0, cumulative - (streak?.unitsSeen ?? 0));
        if (streak) await tx.update(reviewGiftStreaks).set({ unitsSeen: Math.max(cumulative, streak.unitsSeen) }).where(eq(reviewGiftStreaks.id, id));
        else await tx.insert(reviewGiftStreaks).values({ id, unitsSeen: cumulative });
      } else if (input.repeatEnd !== true) return { accepted: false, reason: "Waiting for final streak receipt", event: null };
    }
    if (!units) return { accepted: false, reason: "No new gift units", event: null };
    const [current] = state?.currentPlayingId ? await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1) : [];
    const event = await appendReviewEvent(tx, { id: `gift:${deliveryId}`, type: "gift_received", occurrenceId: current?.reviewOccurrenceId ?? null, submissionId: current?.id ?? null, actor, giftId: input.giftId, units // TikFinity owns viewer-triggered audio; manual soundboard remains separate.
     });
    return { accepted: true, units, event };
  }));
  broadcastReviewEvent(result.event);
  await setSetting("review_tiktok_last_event_at", String(Date.now()));
  await setSetting("review_tiktok_last_room_id", input.roomId);
  const { event, ...response } = result;
  return response;
}
export const reviewStudioRouter = router({
  settings: publicProcedure.query(getReviewStudioSettings),
  events: publicProcedure.input(z.object({ after: z.number().int().nonnegative().optional() })).query(({ input }) => getReviewEventFeed(input.after)),
  addVotes: adminProcedure.input(adminVotesInput).mutation(({ ctx, input }) => addAdminReviewVotes(input, ctx.user.id)),
  previous: publicProcedure.query(async () => {
    const db = await getDb(); if (!db) return null;
    const [previous] = await db.select({ id: reviewSubmissions.id, songTitle: reviewSubmissions.songTitle, artistName: reviewSubmissions.artistName, userId: reviewSubmissions.userId, reviewedAt: reviewSubmissions.reviewedAt })
      .from(reviewOccurrences).innerJoin(reviewSubmissions, eq(reviewSubmissions.id, reviewOccurrences.submissionId))
      .where(isNotNull(reviewOccurrences.completedAtMs))
      .orderBy(desc(reviewOccurrences.completedAtMs)).limit(1);
    if (previous) return previous;
    const [legacy] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.status, "reviewed")).orderBy(desc(reviewSubmissions.reviewedAt)).limit(1);
    return legacy ? { id: legacy.id, songTitle: legacy.songTitle, artistName: legacy.artistName, userId: legacy.userId, reviewedAt: legacy.reviewedAt } : null;
  }),
  setSettings: adminProcedure.input(settingsInput).mutation(({ input }) => withReviewTransportLock(async () => {
    const settings = { ...await getReviewStudioSettings(), ...input };
    if (input.giftMappings && (new Set(input.giftMappings.map((entry) => entry.giftId)).size !== input.giftMappings.length || input.giftMappings.some((entry) => !settings.sounds.some((sound) => sound.id === entry.soundId)))) throw new TRPCError({ code: "BAD_REQUEST", message: "Map each gift once to an existing sound." });
    await setSetting("review_studio_settings", JSON.stringify(settings));
    await publishReviewEvent({ id: `settings:${randomUUID()}`, type: "studio_settings_changed", occurrenceId: null, submissionId: null });
    return settings;
  })),
  uploadSound: adminProcedure.input(z.object({ id: z.string().min(1).max(64), label: z.string().trim().min(1).max(80).optional(), fileName: z.string().max(200), mimeType: z.string().max(80), fileBase64: z.string().max(28_000_000) })).mutation(async ({ input }) => {
    const extension = input.fileName.split(".").pop()?.toLowerCase();
    const mime: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg" };
    if (!extension || !mime[extension] || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.fileBase64)) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a valid MP3, WAV, M4A, or OGG sound." });
    const bytes = Buffer.from(input.fileBase64, "base64");
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Sound files must be under 20 MB." });
    const current = await getReviewStudioSettings();
    if (!current.sounds.some((sound) => sound.id === input.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an existing soundboard slot." });
    const uploaded = await storagePut(`review-soundboard/${input.id}-${randomUUID()}.${extension}`, bytes, mime[extension]);
    return withReviewTransportLock(async () => {
      const settings = await getReviewStudioSettings();
      settings.sounds = settings.sounds.map((sound) => sound.id === input.id ? { ...sound, label: input.label ?? sound.label, url: uploaded.url } : sound);
      await setSetting("review_studio_settings", JSON.stringify(settings));
      await publishReviewEvent({ id: `settings:${randomUUID()}`, type: "studio_settings_changed", occurrenceId: null, submissionId: null });
      return settings;
    });
  }),
  triggerSound: adminProcedure.input(z.object({ soundId: z.string().max(64), requestId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const settings = await getReviewStudioSettings(); const sound = settings.sounds.find((entry) => entry.id === input.soundId);
    if (!sound?.url) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload your owned or licensed audio into this sound slot first." });
    return publishReviewEvent({ id: `manual:${ctx.user.id}:${input.requestId}`, type: "manual_sound_triggered", occurrenceId: null, submissionId: null, soundId: sound.id, soundUrl: sound.url, units: 1 });
  }),
  stopSoundboard: adminProcedure.mutation(() => publishReviewEvent({ id: `stop:${randomUUID()}`, type: "soundboard_stopped", occurrenceId: null, submissionId: null })),
  sourceHeartbeat: publicProcedure.input(z.object({ sourceId: z.string().uuid() })).mutation(({ input }) => { audioSources.set(input.sourceId, Date.now()); return { audioSources: audioCount() }; }),
  status: adminProcedure.query(async () => {
    const settings = await getReviewStudioSettings(); const lastTikTokEventAt = Number(await getSetting("review_tiktok_last_event_at") ?? 0) || null;
    const lastRoomId = await getSetting("review_tiktok_last_room_id");
    return { audioSources: audioCount(), lastTikTokEventAt, tiktokConnected: settings.tiktokEnabled && lastRoomId === settings.tiktokRoomId && !!lastTikTokEventAt && Date.now() - lastTikTokEventAt < 90_000, nativePollMergingSupported: false as const, provider: "TikFinity Desktop local Event API", requiredAction: "Connect TikFinity to your actual live account on the streaming computer, then connect its local event API here." };
  }),
  ingestTikTok: adminProcedure.input(tiktokEventInput).mutation(({ input }) => ingestTikTokReviewEvent(input)),
});
