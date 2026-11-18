import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { queueState, reviewGiftStreaks, reviewSubmissions, reviewTikTokDeliveries } from "../drizzle/schema";
import { reviewBridgeDevices, reviewBridgeNonces, reviewBridgeReceipts, reviewGalaxyRedemptions, reviewTikTokLinkCodes, reviewTikTokSubmissionLinks } from "../drizzle/review-bridge-schema";
import { appendReviewEvent, broadcastReviewEvent } from "./review-studio-events";
import { recordReviewVoteInTransaction } from "./review-occurrences";
import { mutateReviewQueue, withReviewTransportLock } from "./review-transport";
import { isReviewSubmissionEligible } from "../shared/review-payment-access";
import type { TrpcContext } from "./_core/context";
import { authorizeTrackedSubmission } from "./review-tracking";

export type BridgeDevice = typeof reviewBridgeDevices.$inferSelect;
export type BridgeInputEvent = {
  kind: "chat" | "gift" | "follow" | "like" | "share" | "subscribe" | "roomUser";
  roomId: string; messageId: string; userId?: string; handle?: string; displayName?: string;
  comment?: string; occurrenceId?: string | null; giftId?: string; giftName?: string;
  giftType?: number; repeatCount?: number; repeatEnd?: boolean; streakId?: string;
};
export const bridgeHash = (text: string) => createHash("sha256").update(text).digest("hex");
const dbRequired = async () => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); return db; };
const encryptionKey = () => { if (!process.env.JWT_SECRET) throw new Error("Server credential encryption is unavailable"); return createHash("sha256").update(`review-bridge:${process.env.JWT_SECRET}`).digest(); };
export function encryptBridgeCredential(secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(item => item.toString("base64url")).join(".");
}
function decryptBridgeCredential(value: string) {
  const [iv, tag, ciphertext] = value.split(".").map(item => Buffer.from(item, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
export function bridgeSignature(secret: string, timestamp: string, nonce: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}\n${nonce}\n${body}`).digest("hex");
}
export async function createBridgePairing(adminId: number, roomId: string, label: string) {
  const db = await dbRequired(); const code = randomBytes(12).toString("hex"); const now = Date.now();
  const id = randomUUID();
  await db.insert(reviewBridgeDevices).values({ id, pairingHash: bridgeHash(code), pairingExpiresAtMs: now + 300_000,
    deviceLabel: label, enabled: true, testMode: false, streamId: randomUUID(), roomId,
    fireCommand: "!fire", trashCommand: "!trash", localConnected: false, createdAtMs: now, createdByUserId: adminId });
  return { bridgeId: id, pairingCode: code, expiresAtMs: now + 300_000 };
}
export async function pairReviewBridge(code: string, deviceLabel: string) {
  const db = await dbRequired();
  return db.transaction(async tx => {
    const [device] = await tx.select().from(reviewBridgeDevices).where(eq(reviewBridgeDevices.pairingHash, bridgeHash(code))).limit(1).for("update");
    if (!device?.enabled || !device.pairingExpiresAtMs || device.pairingExpiresAtMs < Date.now() || device.credentialCiphertext) throw new TRPCError({ code: "UNAUTHORIZED", message: "Pairing code is invalid, consumed, or expired." });
    const secret = randomBytes(32).toString("base64url");
    await tx.update(reviewBridgeDevices).set({ credentialCiphertext: encryptBridgeCredential(secret), pairingHash: null, pairingExpiresAtMs: null, deviceLabel }).where(eq(reviewBridgeDevices.id, device.id));
    return { bridgeId: device.id, secret };
  });
}
export async function authenticateReviewBridge(headers: Record<string, unknown>, body: string, now = Date.now()) {
  const id = headers["x-review-bridge-id"]; const timestamp = headers["x-review-timestamp"];
  const nonce = headers["x-review-nonce"]; const signature = headers["x-review-signature"];
  if (typeof id !== "string" || typeof timestamp !== "string" || typeof nonce !== "string" || typeof signature !== "string" ||
      !/^\d{13}$/.test(timestamp) || !/^[0-9a-f-]{36}$/i.test(nonce) || !/^[0-9a-f]{64}$/i.test(signature) || Math.abs(now - Number(timestamp)) > 60_000) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A fresh signed bridge request is required." });
  }
  const db = await dbRequired(); const [device] = await db.select().from(reviewBridgeDevices).where(eq(reviewBridgeDevices.id, id)).limit(1);
  if (!device?.enabled || !device.credentialCiphertext) throw new TRPCError({ code: "UNAUTHORIZED", message: "Bridge is not paired or was revoked." });
  const expected = Buffer.from(bridgeSignature(decryptBridgeCredential(device.credentialCiphertext), timestamp, nonce, body), "hex");
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Bridge signature rejected." });
  const [claim] = await db.insert(reviewBridgeNonces).ignore().values({ id: bridgeHash(`${id}:${nonce}`), timestampMs: now });
  if (!claim.affectedRows) throw new TRPCError({ code: "CONFLICT", message: "Bridge request already delivered; sign retries with a fresh nonce." });
  return device;
}
export async function reviewBridgeHeartbeat(device: BridgeDevice, input: { localConnected: boolean; testMode: boolean; roomId?: string }) {
  if (input.testMode !== device.testMode) throw new TRPCError({ code: "FORBIDDEN", message: "Select the matching Live/Test mode in admin first." });
  if (input.roomId && input.roomId !== device.roomId) throw new TRPCError({ code: "FORBIDDEN", message: "The configured live room does not match." });
  const db = await dbRequired();
  await db.update(reviewBridgeDevices).set({ localConnected: input.localConnected, lastHeartbeatMs: Date.now() }).where(eq(reviewBridgeDevices.id, device.id));
  const [state] = await db.select().from(queueState).limit(1);
  const [song] = state?.currentPlayingId ? await db.select({ occurrenceId: reviewSubmissions.reviewOccurrenceId }).from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1) : [];
  return { streamId: device.streamId, roomId: device.roomId, occurrenceId: state?.isLive ? song?.occurrenceId ?? null : null,
    enabled: device.enabled, testMode: device.testMode, commands: { fire: device.fireCommand, trash: device.trashCommand, link: "!link" }, galaxyGiftId: device.galaxyGiftId };
}
export function bridgeCommandVote(comment: string, fire: string, trash: string): "fire" | "trash" | null {
  const text = comment.trim().toLowerCase(); return text === fire.toLowerCase() ? "fire" : text === trash.toLowerCase() ? "trash" : null;
}
export function isConfiguredGalaxy(event: BridgeInputEvent, device: Pick<BridgeDevice, "galaxyGiftId">) {
  return event.kind === "gift" && !!device.galaxyGiftId && event.giftId === device.galaxyGiftId && event.giftName?.trim().toLowerCase() === "galaxy";
}
export async function createReviewTikTokLinkCode(ctx: TrpcContext, submissionId: number, token?: string) {
  const song = await authorizeTrackedSubmission(ctx, submissionId, token);
  if (song.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Link an eligible waiting song before it starts reviewing." });
  const db = await dbRequired();
  const [device] = await db.select().from(reviewBridgeDevices).where(and(eq(reviewBridgeDevices.enabled, true), eq(reviewBridgeDevices.testMode, false))).orderBy(desc(reviewBridgeDevices.createdAtMs)).limit(1);
  if (!device?.credentialCiphertext) throw new TRPCError({ code: "BAD_REQUEST", message: "TikFinity has not been paired for the current stream." });
  const code = randomBytes(6).toString("hex").toUpperCase(); const expiresAtMs = Date.now() + 300_000;
  await db.insert(reviewTikTokLinkCodes).values({ codeHash: bridgeHash(code), submissionId, streamId: device.streamId, expiresAtMs });
  return { code, expiresAtMs, command: `!link ${code}` };
}
export async function processReviewBridgeReceipt(device: BridgeDevice, streamId: string, receivedAtMs: number, event: BridgeInputEvent, testMode: boolean) {
  if (streamId !== device.streamId || event.roomId !== device.roomId || testMode !== device.testMode) throw new TRPCError({ code: "FORBIDDEN", message: "Wrong bridge stream, room, or test mode." });
  if (Math.abs(Date.now() - receivedAtMs) > 120_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Stale event rejected; no old vote or reward was replayed." });
  const id = bridgeHash(`${device.id}:${streamId}:${event.kind}:${event.messageId}`);
  const actor = (event.handle ? `@${event.handle.replace(/^@/, "")}` : event.displayName ?? "").slice(0, 128);
  const db = await dbRequired();
  const outcome = await withReviewTransportLock(() => db.transaction(async tx => {
    const [state] = await tx.select().from(queueState).limit(1).for("update");
    const [prior] = await tx.select().from(reviewBridgeReceipts).where(eq(reviewBridgeReceipts.id, id)).limit(1).for("update");
    if (prior) return { accepted: false, duplicate: true, outcome: prior.outcome, event: null };
    let label = "ignored_unneeded_event"; let broadcast: Awaited<ReturnType<typeof appendReviewEvent>> = null;
    if (testMode) label = "simulated_no_live_changes";
    else if ((event.kind === "chat" || event.kind === "gift") && (!event.userId || !actor)) label = "rejected_missing_reliable_identity";
    else if (event.kind === "chat") {
      const link = /^!link ([A-F0-9]{12})$/i.exec((event.comment ?? "").trim());
      const reaction = bridgeCommandVote(event.comment ?? "", device.fireCommand, device.trashCommand);
      if (link) {
        const [code] = await tx.select().from(reviewTikTokLinkCodes).where(eq(reviewTikTokLinkCodes.codeHash, bridgeHash(link[1].toUpperCase()))).limit(1).for("update");
        const [song] = code ? await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, code.submissionId)).limit(1).for("update") : [];
        if (!code || code.consumedAtMs || code.expiresAtMs < Date.now() || code.streamId !== streamId || song?.status !== "pending") label = "link_code_invalid_expired_or_consumed";
        else {
          await tx.update(reviewTikTokLinkCodes).set({ consumedAtMs: Date.now() }).where(eq(reviewTikTokLinkCodes.codeHash, code.codeHash));
          await tx.insert(reviewTikTokSubmissionLinks).values({ submissionId: code.submissionId, streamId, platformUserId: event.userId!, actor, linkedAtMs: Date.now() })
            .onDuplicateKeyUpdate({ set: { streamId, platformUserId: event.userId!, actor, linkedAtMs: Date.now() } });
          label = "submission_identity_linked";
        }
      } else if (reaction) {
        if (!state?.isLive || !state.currentPlayingId || !event.occurrenceId) label = "no_active_verified_occurrence";
        else {
          const [song] = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1);
          if (song?.reviewOccurrenceId !== event.occurrenceId) label = "stale_occurrence_vote_ignored";
          else {
            const result = await recordReviewVoteInTransaction(tx, state.currentPlayingId, { platform: "tiktok", platformUserId: event.userId!, displayName: actor }, reaction, event.occurrenceId);
            label = result.changed ? "vote_recorded" : "duplicate_choice_ignored"; broadcast = result.event;
          }
        }
      } else label = "ordinary_comment_not_a_vote";
    } else if (event.kind === "gift") {
      if (!state?.isLive) label = "review_offline_gift_not_rewarded";
      else if (!event.giftId || event.giftType === undefined) label = "gift_missing_streak_identity";
      else {
        const deliveryId = bridgeHash(`${streamId}:${event.roomId}:gift:${event.messageId}`);
        const [delivery] = await tx.insert(reviewTikTokDeliveries).ignore().values({ id: deliveryId, timestampMs: Date.now() });
        if (!delivery.affectedRows) label = "duplicate_gift_delivery";
        else {
          const cumulative = event.repeatCount ?? 1; let units = cumulative; let underlying = deliveryId;
          if (event.giftType === 1) {
            if (event.streakId) {
              underlying = bridgeHash(`${streamId}:${event.roomId}:${event.userId}:${event.giftId}:${event.streakId}`);
              const [streak] = await tx.select().from(reviewGiftStreaks).where(eq(reviewGiftStreaks.id, underlying)).limit(1).for("update");
              units = Math.max(0, cumulative - (streak?.unitsSeen ?? 0));
              if (streak) await tx.update(reviewGiftStreaks).set({ unitsSeen: Math.max(cumulative, streak.unitsSeen) }).where(eq(reviewGiftStreaks.id, underlying));
              else await tx.insert(reviewGiftStreaks).values({ id: underlying, unitsSeen: cumulative });
            } else if (event.repeatEnd !== true) units = 0;
          }
          if (!units) label = "gift_streak_waiting_or_duplicate";
          else {
            // TikFinity owns viewer-triggered sound. This event deliberately has no soundId/soundUrl.
            const [current] = state.currentPlayingId ? await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1) : [];
            broadcast = await appendReviewEvent(tx, { id: `bridgegift:${id}`, type: "gift_received", occurrenceId: current?.reviewOccurrenceId ?? null, submissionId: current?.id ?? null, actor, giftId: event.giftId, units });
            if (isConfiguredGalaxy(event, device)) {
              const start = cumulative - units;
              for (let unit = start + 1; unit <= cumulative; unit++) await tx.insert(reviewGalaxyRedemptions).ignore().values({
                id: bridgeHash(`${underlying}:${unit}`), bridgeId: device.id, streamId, providerUserId: event.userId!, actor, giftId: event.giftId,
                unit, status: "awaiting_admin", receivedAtMs,
              });
              label = "galaxy_awaiting_admin_confirmation";
            } else label = event.giftName?.toLowerCase() === "galaxy" ? "galaxy_gift_id_not_configured" : "non_galaxy_no_queue_action";
          }
        }
      }
    }
    await tx.insert(reviewBridgeReceipts).values({ id, bridgeId: device.id, streamId, eventKind: event.kind, actor: actor || null,
      giftId: event.giftId ?? null, giftName: event.giftName?.slice(0, 100) ?? null, outcome: label, testMode, timestampMs: Date.now() });
    return { accepted: true, duplicate: false, outcome: label, event: broadcast };
  }));
  broadcastReviewEvent(outcome.event);
  await db.update(reviewBridgeDevices).set(testMode ? { lastTestEventMs: Date.now() } : { lastLiveEventMs: Date.now() }).where(eq(reviewBridgeDevices.id, device.id));
  const { event: ignored, ...result } = outcome; return result;
}
export async function approveReviewGalaxy(adminId: number, redemptionId: string, submissionId: number, reconcile: boolean, note: string) {
  const db = await dbRequired();
  return mutateReviewQueue(() => db.transaction(async tx => {
    const [state] = await tx.select().from(queueState).limit(1).for("update");
    const [gift] = await tx.select().from(reviewGalaxyRedemptions).where(eq(reviewGalaxyRedemptions.id, redemptionId)).limit(1).for("update");
    if (!gift || gift.status !== "awaiting_admin") throw new TRPCError({ code: "CONFLICT", message: "This Galaxy was already reviewed or redeemed." });
    const [bridge] = await tx.select().from(reviewBridgeDevices).where(eq(reviewBridgeDevices.id, gift.bridgeId)).limit(1);
    if (!state?.isLive || !bridge?.enabled || bridge.testMode || gift.streamId !== bridge.streamId) throw new TRPCError({ code: "FORBIDDEN", message: "Galaxy belongs to a closed, disconnected, or test stream." });
    const [song] = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, submissionId)).limit(1).for("update");
    if (!song || song.status !== "pending" || !isReviewSubmissionEligible(song, state.playbackMode)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an eligible waiting track; a Galaxy cannot approve an unpaid entry or interrupt playback." });
    const [link] = await tx.select().from(reviewTikTokSubmissionLinks).where(and(eq(reviewTikTokSubmissionLinks.submissionId, submissionId), eq(reviewTikTokSubmissionLinks.streamId, gift.streamId))).limit(1);
    if (link?.platformUserId !== gift.providerUserId && (!reconcile || note.trim().length < 8)) throw new TRPCError({ code: "FORBIDDEN", message: "A matching one-time TikTok link is required, or an explicit administrator reconciliation reason." });
    const already = await tx.select().from(reviewGalaxyRedemptions).where(and(eq(reviewGalaxyRedemptions.streamId, gift.streamId), eq(reviewGalaxyRedemptions.submissionId, submissionId))).limit(1);
    if (already.length || song.skipPaymentConfirmed) throw new TRPCError({ code: "CONFLICT", message: "That track already has a priority commitment; this gift remains for reconciliation." });
    // Existing positions remain the source of truth. Preserve earlier paid/Galaxy commitments in order.
    const waiting = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.status, "pending"))
      .orderBy(asc(reviewSubmissions.position), asc(reviewSubmissions.createdAt), asc(reviewSubmissions.id)).for("update");
    const used = await tx.select({ id: reviewGalaxyRedemptions.id, submissionId: reviewGalaxyRedemptions.submissionId, receivedAtMs: reviewGalaxyRedemptions.receivedAtMs }).from(reviewGalaxyRedemptions).where(eq(reviewGalaxyRedemptions.status, "redeemed"));
    const others = waiting.filter(item => item.id !== song.id);
    let insertAt = 0;
    for (let index = 0; index < others.length; index++) {
      const earlierGalaxy = used.find(reward => reward.submissionId === others[index].id);
      if (others[index].skipPaymentConfirmed || earlierGalaxy && (earlierGalaxy.receivedAtMs < gift.receivedAtMs || earlierGalaxy.receivedAtMs === gift.receivedAtMs && earlierGalaxy.id < gift.id)) insertAt = index + 1;
    }
    others.splice(insertAt, 0, song);
    for (let index = 0; index < others.length; index++) await tx.update(reviewSubmissions).set({ position: index + 1 }).where(eq(reviewSubmissions.id, others[index].id));
    await tx.update(reviewGalaxyRedemptions).set({ status: "redeemed", submissionId, redeemedAtMs: Date.now(), reviewedByUserId: adminId,
      auditNote: note.trim() || "Confirmed Galaxy matched through one-time TikTok submission linking." }).where(eq(reviewGalaxyRedemptions.id, gift.id));
    return { success: true as const, status: "redeemed", note: "Next available slot after existing priority commitments; current song unchanged." };
  }));
}
let lastCleanup = 0;
export async function cleanupReviewBridgeDiagnostics() {
  if (Date.now() - lastCleanup < 60_000) return; lastCleanup = Date.now(); const db = await dbRequired();
  await db.delete(reviewBridgeReceipts).where(lt(reviewBridgeReceipts.timestampMs, Date.now() - 7 * 86400_000));
  await db.delete(reviewBridgeNonces).where(lt(reviewBridgeNonces.timestampMs, Date.now() - 180_000));
  await db.delete(reviewTikTokLinkCodes).where(lt(reviewTikTokLinkCodes.expiresAtMs, Date.now() - 86400_000));
}
