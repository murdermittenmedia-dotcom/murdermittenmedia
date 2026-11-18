import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { makeReviewTestDatabase, resetReviewTestMemory } from "./review-test-database";
const memory = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: 0, failAt: 0 }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => makeReviewTestDatabase(memory) }));
import { startReviewQueueTrack, getSongReactionCounts } from "./db";
import { setReviewLivePublisher } from "./review-studio-events";
import { setReviewTransportPublisher } from "./review-transport";
import { authenticateReviewBridge, approveReviewGalaxy, bridgeCommandVote, bridgeHash, bridgeSignature, createBridgePairing,
  createReviewTikTokLinkCode, encryptBridgeCredential, isConfiguredGalaxy, pairReviewBridge, processReviewBridgeReceipt, reviewBridgeHeartbeat, type BridgeDevice, type BridgeInputEvent } from "./review-bridge";
import { reviewBridgeRouter } from "./review-bridge-router";
import { createLimitedReviewSubmission } from "./review-submission-limit";

const room = "7390123456789012345";
let device: BridgeDevice;
const event = (kind: BridgeInputEvent["kind"], patch: Partial<BridgeInputEvent> = {}): BridgeInputEvent => ({
  kind, roomId: room, messageId: randomUUID(), userId: "7001002003004005006", handle: "actualartist", ...patch,
});
const gift = (patch: Partial<BridgeInputEvent> = {}) => event("gift", { giftId: "5650", giftName: "Galaxy", giftType: 0, repeatCount: 1, ...patch });
const submit = (value: BridgeInputEvent, override?: Partial<BridgeDevice>) => processReviewBridgeReceipt({ ...device, ...override }, device.streamId, Date.now(), value, override?.testMode ?? false);
const admin = () => reviewBridgeRouter.createCaller({ user: { id: 1, role: "admin" }, req: { headers: {} }, res: { setHeader: () => {} } } as any);
const rows = (name: string) => memory.tables[name] ?? [];
const pendingOrder = () => rows("review_submissions").filter(song => song.status === "pending").sort((a, b) => a.position - b.position).map(song => song.id);
const ownerContext = () => ({ user: { id: 101, role: "user" }, req: { headers: {} }, res: { setHeader: () => {} } } as any);

beforeEach(async () => {
  vi.stubEnv("DATABASE_URL", "memory://review-v2-isolated"); vi.stubEnv("JWT_SECRET", "isolated-test-signing-secret-not-production");
  resetReviewTestMemory(memory); setReviewTransportPublisher(async () => {}); await setReviewLivePublisher(() => {});
  device = { id: randomUUID(), pairingHash: null, pairingExpiresAtMs: null, credentialCiphertext: encryptBridgeCredential("isolated-secret"),
    deviceLabel: "Test streaming PC", enabled: true, testMode: false, streamId: randomUUID(), roomId: room,
    fireCommand: "!fire", trashCommand: "!trash", galaxyGiftId: "5650", localConnected: true,
    lastHeartbeatMs: Date.now(), lastLiveEventMs: null, lastTestEventMs: null, createdAtMs: Date.now(), createdByUserId: 1 };
  memory.tables.review_bridge_devices = [device];
  for (const song of rows("review_submissions")) { song.userId = 101; song.paidSubmissionConfirmed = true; song.skipPaymentConfirmed = false; }
  memory.tables.users.push({ id: 101, role: "user", artistName: "Actual Artist" });
});
afterEach(() => vi.restoreAllMocks());

describe("outbound bridge authentication and isolation", () => {
  it("pairs once using an expiring hash, encrypts credentials, and reveals neither in status", async () => {
    const pairing = await createBridgePairing(1, room, "PC");
    const stored = rows("review_bridge_devices").find(item => item.id === pairing.bridgeId);
    expect(stored.pairingHash).toBe(bridgeHash(pairing.pairingCode)); expect(stored).not.toHaveProperty("pairingCode");
    const result = await pairReviewBridge(pairing.pairingCode, "Windows PC"); expect(result.secret).toHaveLength(43);
    await expect(pairReviewBridge(pairing.pairingCode, "PC")).rejects.toThrow(/invalid|consumed/i);
    expect(rows("review_bridge_devices").find(item => item.id === pairing.bridgeId).credentialCiphertext).not.toContain(result.secret);
    expect(JSON.stringify(await admin().status())).not.toContain(result.secret);
  });
  it("requires a fresh signed exact body and rejects replayed nonces, modified bodies and revoked bridges", async () => {
    const body = JSON.stringify({ localConnected: true, testMode: false }); const timestamp = String(Date.now()); const nonce = randomUUID();
    const headers = { "x-review-bridge-id": device.id, "x-review-timestamp": timestamp, "x-review-nonce": nonce,
      "x-review-signature": bridgeSignature("isolated-secret", timestamp, nonce, body) };
    expect((await authenticateReviewBridge(headers, body)).id).toBe(device.id);
    await expect(authenticateReviewBridge(headers, body)).rejects.toThrow(/already delivered/);
    await expect(authenticateReviewBridge({ ...headers, "x-review-nonce": randomUUID() }, body + " ")).rejects.toThrow(/signature/);
    await expect(authenticateReviewBridge({ ...headers, "x-review-timestamp": String(Date.now() - 70_000) }, body)).rejects.toThrow(/fresh/);
    rows("review_bridge_devices")[0].enabled = false;
    await expect(authenticateReviewBridge({ ...headers, "x-review-nonce": randomUUID() }, body)).rejects.toThrow(/revoked/);
  });
  it("isolates simulator receipts from real votes, gifts, priority and audio", async () => {
    await startReviewQueueTrack(1); const snapshot = structuredClone(rows("review_submissions"));
    for (const sample of [event("chat", { comment: "!fire" }), gift(), event("follow"), event("gift", { giftName: "Corn", giftId: "1", giftType: 0, repeatCount: 1 })]) {
      expect((await submit(sample, { testMode: true })).outcome).toBe("simulated_no_live_changes");
    }
    expect(rows("review_submissions")).toEqual(snapshot); expect(rows("review_galaxy_redemptions")).toHaveLength(0);
    expect(rows("review_occurrence_votes")).toHaveLength(0); expect(rows("review_live_events").filter(item => item.type === "gift_received")).toHaveLength(0);
  });
  it("reports local disconnect, reconnect and test mode honestly", async () => {
    expect((await admin().status())[0].state).toBe("Connected");
    await reviewBridgeHeartbeat(device, { localConnected: false, testMode: false }); expect((await admin().status())[0].state).toBe("Reconnecting");
    rows("review_bridge_devices")[0].lastHeartbeatMs = Date.now() - 25_000; expect((await admin().status())[0].state).toBe("Disconnected");
    await admin().configure({ bridgeId: device.id, testMode: true }); expect((await admin().status())[0].state).toBe("Test Mode");
  });
});

describe("explicit occurrence-safe TikTok votes", () => {
  it("only counts configured exact commands; duplicate choice is inert and changes replace it", async () => {
    const active = await startReviewQueueTrack(1); const occurrenceId = active.reviewOccurrenceId!;
    expect(bridgeCommandVote("ordinary FIRE is great", "!fire", "!trash")).toBeNull();
    expect((await submit(event("chat", { comment: "FIRE", occurrenceId }))).outcome).toBe("ordinary_comment_not_a_vote");
    expect((await submit(event("chat", { comment: "!fire", occurrenceId }))).outcome).toBe("vote_recorded");
    expect((await submit(event("chat", { comment: "!fire", occurrenceId }))).outcome).toBe("duplicate_choice_ignored");
    await submit(event("chat", { comment: "!trash", occurrenceId }));
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 0, trash: 1 }); expect(rows("review_occurrence_votes")).toHaveLength(1);
  });
  it("rejects duplicate receipts and old occurrence votes on an advanced track", async () => {
    const active = await startReviewQueueTrack(1); const receipt = event("chat", { comment: "!fire", occurrenceId: active.reviewOccurrenceId! });
    await submit(receipt); expect((await submit(receipt)).duplicate).toBe(true);
    await startReviewQueueTrack(2); expect((await submit(event("chat", { comment: "!trash", occurrenceId: active.reviewOccurrenceId! }))).outcome).toBe("stale_occurrence_vote_ignored");
    expect(await getSongReactionCounts(2)).toMatchObject({ fire: 0, trash: 0 });
    await expect(processReviewBridgeReceipt(device, device.streamId, Date.now() - 130_000, receipt, false)).rejects.toThrow(/Stale/);
  });
});

describe("Galaxy-only priority and secure linking", () => {
  it("Corn, Tomato, Fire, Heart Me and Follow cannot alter order or generate website sound", async () => {
    await startReviewQueueTrack(1); const original = pendingOrder();
    for (const name of ["Corn", "Tom the Tomato", "Fire", "Heart Me"]) await submit(gift({ giftId: randomUUID(), giftName: name }));
    await submit(event("follow")); expect(pendingOrder()).toEqual(original); expect(rows("review_galaxy_redemptions")).toHaveLength(0);
    for (const row of rows("review_live_events").filter(row => row.type === "gift_received")) expect(JSON.parse(row.payload)).not.toHaveProperty("soundUrl");
    expect(isConfiguredGalaxy(gift({ giftName: "Corn" }), device)).toBe(false);
  });
  it("consumes one-time linking proof and requires admin confirmation before moving a matched song", async () => {
    await startReviewQueueTrack(1); const code = await createReviewTikTokLinkCode(ownerContext(), 3);
    expect((await submit(event("chat", { comment: code.command }))).outcome).toBe("submission_identity_linked");
    expect((await submit(event("chat", { comment: code.command }))).outcome).toBe("link_code_invalid_expired_or_consumed");
    const original = pendingOrder(); const receipt = gift(); await submit(receipt);
    expect(pendingOrder()).toEqual(original); const reward = rows("review_galaxy_redemptions")[0];
    await approveReviewGalaxy(1, reward.id, 3, false, "Verified actual Galaxy receipt");
    expect(pendingOrder()[0]).toBe(3); expect(rows("queue_state")[0].currentPlayingId).toBe(1);
    expect(rows("review_submissions").find(item => item.id === 3).paidSubmissionConfirmed).toBe(true);
    expect(rows("review_submissions").find(item => item.id === 3).skipPaymentConfirmed).toBe(false);
    await expect(approveReviewGalaxy(1, reward.id, 3, false, "")).rejects.toThrow(/already/);
    expect((await submit(receipt)).duplicate).toBe(true); expect(rows("review_galaxy_redemptions")).toHaveLength(1);
  });
  it("holds unmatched gifts, refuses random/unpaid/current songs, and audits explicit reconciliation", async () => {
    await startReviewQueueTrack(1); await submit(gift()); const reward = rows("review_galaxy_redemptions")[0]; const order = pendingOrder();
    await expect(approveReviewGalaxy(1, reward.id, 2, false, "")).rejects.toThrow(/matching one-time/);
    await expect(approveReviewGalaxy(1, reward.id, 1, true, "Verified identity")).rejects.toThrow(/waiting track/);
    rows("queue_state")[0].playbackMode = "paid_only"; rows("review_submissions").find(item => item.id === 2).paidSubmissionConfirmed = false;
    await expect(approveReviewGalaxy(1, reward.id, 2, true, "Verified identity")).rejects.toThrow(/unpaid/);
    expect(pendingOrder()).toEqual(order);
    await approveReviewGalaxy(1, reward.id, 3, true, "Verified artist owns the submission manually");
    expect(rows("review_galaxy_redemptions")[0]).toMatchObject({ status: "redeemed", reviewedByUserId: 1, auditNote: "Verified artist owns the submission manually" });
  });
  it("deduplicates cumulative gift streak units and grants each unit at most once", async () => {
    await startReviewQueueTrack(1); const base = { giftType: 1, streakId: "actual-group-100", repeatEnd: false };
    await submit(gift({ ...base, repeatCount: 1 })); await submit(gift({ ...base, repeatCount: 2 })); await submit(gift({ ...base, repeatCount: 2, repeatEnd: true }));
    expect(rows("review_galaxy_redemptions")).toHaveLength(2); expect(rows("review_galaxy_redemptions").map(item => item.unit)).toEqual([1, 2]);
    await approveReviewGalaxy(1, rows("review_galaxy_redemptions")[0].id, 2, true, "Verified unit one artist");
    await expect(approveReviewGalaxy(1, rows("review_galaxy_redemptions")[1].id, 2, true, "Verified unit two artist")).rejects.toThrow(/already/);
  });
  it("serializes simultaneous rewards behind existing paid priorities without interrupting current", async () => {
    await startReviewQueueTrack(1); rows("review_submissions").find(item => item.id === 2).skipPaymentConfirmed = true;
    await submit(gift()); await submit(gift({ userId: "other-stable-user", handle: "secondartist" }));
    const rewards = rows("review_galaxy_redemptions");
    const responses = await Promise.allSettled([approveReviewGalaxy(1, rewards[0].id, 3, true, "Verified artist ownership"), approveReviewGalaxy(1, rewards[1].id, 3, true, "Verified artist ownership")]);
    expect(responses.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(pendingOrder().slice(0, 2)).toEqual([2, 3]); expect(rows("queue_state")[0].currentPlayingId).toBe(1);
  });
  it("restricts reconciliation and bridge credential management to admins", async () => {
    const visitor = reviewBridgeRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any);
    await expect(visitor.status()).rejects.toThrow(); await expect(visitor.createPairing({ roomId: room })).rejects.toThrow();
    const user = reviewBridgeRouter.createCaller(ownerContext()); await expect(user.approveGalaxy({ redemptionId: "a".repeat(64), submissionId: 2 })).rejects.toThrow();
  });
});

it("keeps bridge HTTP and private links separate from public overlay credentials", () => {
  const source = readFileSync(new URL("./review-bridge-http.ts", import.meta.url), "utf8"); expect(source).toContain('limit: "128kb"');
  expect(source).toContain("authenticateReviewBridge"); expect(source).not.toContain("console.log");
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  expect(html.indexOf("window.__reviewTrackingToken")).toBeLessThan(html.indexOf("adsbygoogle"));
});
