import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { reviewSubmissions } from "../drizzle/schema";
import { reviewBridgeDevices, reviewBridgeReceipts, reviewGalaxyRedemptions, reviewTikTokSubmissionLinks } from "../drizzle/review-bridge-schema";
import { approveReviewGalaxy, createBridgePairing, createReviewTikTokLinkCode } from "./review-bridge";
import { authorizeTrackedSubmission } from "./review-tracking";

const deviceId = z.string().uuid();
const command = z.string().trim().regex(/^![a-zA-Z][a-zA-Z0-9_-]{0,29}$/, "Use a single explicit command such as !fire");
export const reviewBridgeRouter = router({
  createPairing: adminProcedure.input(z.object({ roomId: z.string().regex(/^\d{5,30}$/), deviceLabel: z.string().trim().min(1).max(80).default("Streaming PC") }))
    .mutation(({ ctx, input }) => createBridgePairing(ctx.user.id, input.roomId, input.deviceLabel)),
  status: adminProcedure.query(async () => {
    const db = await getDb(); if (!db) throw new Error("Database unavailable");
    const devices = await db.select().from(reviewBridgeDevices).orderBy(desc(reviewBridgeDevices.createdAtMs)).limit(10);
    return devices.map(device => ({ bridgeId: device.id, deviceLabel: device.deviceLabel, roomId: device.roomId,
      streamId: device.streamId, enabled: device.enabled, testMode: device.testMode, paired: !!device.credentialCiphertext,
      fireCommand: device.fireCommand, trashCommand: device.trashCommand, galaxyGiftId: device.galaxyGiftId,
      lastHeartbeatMs: device.lastHeartbeatMs, lastLiveEventMs: device.lastLiveEventMs, lastTestEventMs: device.lastTestEventMs,
      state: !device.enabled ? "Disconnected" : !device.credentialCiphertext ? "Not Configured" : device.testMode ? "Test Mode" :
        !device.lastHeartbeatMs || Date.now() - device.lastHeartbeatMs > 20_000 ? "Disconnected" : !device.localConnected ? "Reconnecting" :
          device.lastLiveEventMs && Date.now() - device.lastLiveEventMs < 90_000 ? "Live Events Received" : "Connected",
      verification: "Live Verification Pending — provider receipts are not cryptographically verified by TikTok; Galaxy moves require admin confirmation.",
    }));
  }),
  configure: adminProcedure.input(z.object({ bridgeId: deviceId, roomId: z.string().regex(/^\d{5,30}$/).optional(), testMode: z.boolean().optional(),
    fireCommand: command.optional(), trashCommand: command.optional(), galaxyGiftId: z.string().regex(/^\d{1,64}$/).nullable().optional(), newStream: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!; const [old] = await db.select().from(reviewBridgeDevices).where(eq(reviewBridgeDevices.id, input.bridgeId)).limit(1);
      if (!old?.enabled) throw new TRPCError({ code: "NOT_FOUND", message: "Active bridge not found." });
      if ((input.fireCommand ?? old.fireCommand).toLowerCase() === (input.trashCommand ?? old.trashCommand).toLowerCase() || [input.fireCommand, input.trashCommand].some(value => value?.toLowerCase() === "!link")) throw new TRPCError({ code: "BAD_REQUEST", message: "Use distinct vote commands; !link is reserved for ownership proof." });
      const { bridgeId, newStream, ...patch } = input;
      await db.update(reviewBridgeDevices).set({ ...patch, ...((newStream || input.roomId && input.roomId !== old.roomId || input.testMode !== undefined && input.testMode !== old.testMode) ? { streamId: randomUUID(), lastLiveEventMs: null, lastTestEventMs: null } : {}) }).where(eq(reviewBridgeDevices.id, bridgeId));
      return { success: true as const };
    }),
  revoke: adminProcedure.input(z.object({ bridgeId: deviceId })).mutation(async ({ input }) => {
    await (await getDb())!.update(reviewBridgeDevices).set({ enabled: false, pairingHash: null, credentialCiphertext: null, localConnected: false }).where(eq(reviewBridgeDevices.id, input.bridgeId));
    return { success: true as const };
  }),
  diagnostics: adminProcedure.query(async () => {
    const db = (await getDb())!;
    return db.select({ id: reviewBridgeReceipts.id, eventKind: reviewBridgeReceipts.eventKind, actor: reviewBridgeReceipts.actor,
      giftId: reviewBridgeReceipts.giftId, giftName: reviewBridgeReceipts.giftName, outcome: reviewBridgeReceipts.outcome,
      testMode: reviewBridgeReceipts.testMode, timestampMs: reviewBridgeReceipts.timestampMs }).from(reviewBridgeReceipts).orderBy(desc(reviewBridgeReceipts.timestampMs)).limit(50);
  }),
  galaxies: adminProcedure.query(async () => {
    const db = (await getDb())!;
    const gifts = await db.select().from(reviewGalaxyRedemptions).orderBy(asc(reviewGalaxyRedemptions.receivedAtMs), asc(reviewGalaxyRedemptions.id)).limit(100);
    const links = await db.select().from(reviewTikTokSubmissionLinks);
    const songs = await db.select({ id: reviewSubmissions.id, artistName: reviewSubmissions.artistName, songTitle: reviewSubmissions.songTitle, status: reviewSubmissions.status })
      .from(reviewSubmissions).where(eq(reviewSubmissions.status, "pending"));
    return gifts.map(gift => ({ id: gift.id, actor: gift.actor, giftId: gift.giftId, unit: gift.unit, status: gift.status,
      receivedAtMs: gift.receivedAtMs, redeemedAtMs: gift.redeemedAtMs, auditNote: gift.auditNote, submissionId: gift.submissionId,
      candidates: links.filter(link => link.platformUserId === gift.providerUserId && link.streamId === gift.streamId)
        .map(link => songs.find(song => song.id === link.submissionId)).filter((song): song is NonNullable<typeof song> => !!song),
    }));
  }),
  approveGalaxy: adminProcedure.input(z.object({ redemptionId: z.string().regex(/^[a-f0-9]{64}$/), submissionId: z.number().int().positive(),
    reconcile: z.boolean().default(false), note: z.string().trim().max(500).default("") }))
    .mutation(({ ctx, input }) => approveReviewGalaxy(ctx.user.id, input.redemptionId, input.submissionId, input.reconcile, input.note)),
  declineGalaxy: adminProcedure.input(z.object({ redemptionId: z.string().regex(/^[a-f0-9]{64}$/), note: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await (await getDb())!.update(reviewGalaxyRedemptions).set({ status: "declined", reviewedByUserId: ctx.user.id, auditNote: input.note })
        .where(and(eq(reviewGalaxyRedemptions.id, input.redemptionId), eq(reviewGalaxyRedemptions.status, "awaiting_admin")));
      if (!result[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "Gift already reviewed." });
      return { success: true as const };
    }),
  createLinkCode: publicProcedure.input(z.object({ submissionId: z.number().int().positive(), token: z.string().min(32).max(256).optional() }))
    .mutation(({ ctx, input }) => createReviewTikTokLinkCode(ctx, input.submissionId, input.token)),
  trackStatus: publicProcedure.input(z.object({ submissionId: z.number().int().positive(), token: z.string().min(32).max(256).optional() }))
    .mutation(async ({ ctx, input }) => {
      await authorizeTrackedSubmission(ctx, input.submissionId, input.token); const db = (await getDb())!;
      const [link] = await db.select().from(reviewTikTokSubmissionLinks).where(eq(reviewTikTokSubmissionLinks.submissionId, input.submissionId)).limit(1);
      const gifts = link ? await db.select({ status: reviewGalaxyRedemptions.status, receivedAtMs: reviewGalaxyRedemptions.receivedAtMs, redeemedAtMs: reviewGalaxyRedemptions.redeemedAtMs })
        .from(reviewGalaxyRedemptions).where(and(eq(reviewGalaxyRedemptions.streamId, link.streamId), eq(reviewGalaxyRedemptions.providerUserId, link.platformUserId))).orderBy(desc(reviewGalaxyRedemptions.receivedAtMs)).limit(10) : [];
      return { linked: !!link, actor: link?.actor ?? null, gifts, note: "Galaxy benefits are confirmed by admin, never interrupt the current track, and do not approve unpaid entries." };
    }),
});
