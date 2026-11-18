import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeReviewTestDatabase,
  resetReviewTestMemory,
  reviewTestSong,
} from "./review-test-database";
import type { TrpcContext } from "./_core/context";
import type { ReviewSubmission } from "../drizzle/schema";

const memory = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  writes: 0,
  failAt: 0,
}));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => makeReviewTestDatabase(memory),
}));

import {
  getReviewQueueSnapshot,
  startReviewQueueTrack,
  completeAndAdvanceReviewQueue,
  reorderQueueSubmissions,
  requeueSubmission,
  confirmSkipPayment,
} from "./db";
import { hashReviewIdentity } from "./review-submission-identity";
import {
  authorizeTrackedSubmission,
  buildPrivateReviewTrackingItem,
  buildPublicReviewQueueSnapshot,
  getMyReviewTracking,
  getPublicReviewTrackingQueue,
  hashReviewRecoveryToken,
  issueReviewRecovery,
  readTrackingDeviceHash,
  resolveReviewRecovery,
  reviewTrackingPublicKey,
  reviewTrackingTerminalStatus,
} from "./review-tracking";
import { reviewTrackingRouter } from "./review-tracking-router";
import {
  getReviewTrackingDisplayPosition,
  isReviewTrackingSnapshotLive,
  REVIEW_TRACKING_FRESH_MS,
} from "../shared/review-tracking";

const device = "a".repeat(64);
function context(userId?: number, cookieDevice?: string): TrpcContext {
  const cookie = cookieDevice
    ? `${cookieDevice}.${createHmac("sha256", process.env.JWT_SECRET!).update(cookieDevice).digest("hex")}`
    : "";
  return {
    user: userId
      ? ({ id: userId, role: "user", isBanned: false } as TrpcContext["user"])
      : null,
    io: null,
    req: {
      headers: { cookie: cookie ? `mmm_review_device=${cookie}` : "" },
    } as TrpcContext["req"],
    res: {
      setHeader: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}
function track(
  id: number,
  fields: Partial<ReviewSubmission> = {}
): ReviewSubmission {
  return {
    ...reviewTestSong(id),
    userId: null,
    reviewOccurrenceId: null,
    verdict: null,
    skipVoteTriggered: false,
    skippedLine: false,
    isPaidSubmission: false,
    paidSubmissionConfirmed: false,
    updatedAt: new Date(id * 1000),
    reviewedAt: null,
    contactInfo: `private${id}@example.com`,
    notes: "private artist note",
    stripePaymentSessionId: "stripe_private",
    cashappPaymentReceiptUrl: "https://private.example/receipt",
    ...fields,
  } as ReviewSubmission;
}
function setTracks(...rows: ReviewSubmission[]) {
  memory.tables.review_submissions = rows;
}
function own(submissionId: number, cookieDevice = device) {
  memory.tables.review_submission_owners.push({
    submissionId,
    deviceHash: hashReviewIdentity("device", cookieDevice),
  });
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "memory://isolated-review-tracking-only");
  vi.stubEnv("JWT_SECRET", "isolated-test-tracking-signing-key");
  resetReviewTestMemory(memory);
  memory.tables.review_submission_owners = [];
  memory.tables.review_submission_recovery_tokens = [];
  memory.tables.queue_state[0].playbackMode = "90sec";
  setTracks(track(1), track(2), track(3));
});

describe("safe authoritative public queue", () => {
  it("uses server cursor and ordered eligibility, not stored absolute positions or priority flags", async () => {
    setTracks(
      track(1, { position: 40, skipPaymentConfirmed: true }),
      track(2, { position: 20 }),
      track(3, { position: 1, isPaidSubmission: true }),
      track(4, { position: 100 })
    );
    await startReviewQueueTrack(4);
    const queue = await getPublicReviewTrackingQueue();
    expect(queue.current).toMatchObject({
      songTitle: "Song 4",
      status: "now_reviewing",
      position: 0,
    });
    expect(queue.upNext).toMatchObject({
      songTitle: "Song 2",
      status: "up_next",
      position: 1,
    });
    expect(queue.waiting).toMatchObject([
      { songTitle: "Song 1", status: "waiting", position: 2 },
    ]);
    expect(JSON.stringify(queue)).not.toContain("Song 3");
  });
  it("paid_only eligibility remains authoritative even with zero submit price", async () => {
    memory.tables.queue_state[0].playbackMode = "paid_only";
    memory.tables.queue_state[0].submitPriceCents = 0;
    setTracks(
      track(1),
      track(2, { paidSubmissionConfirmed: true }),
      track(3, { isPaidSubmission: true })
    );
    own(1);
    own(3);
    const queue = await getPublicReviewTrackingQueue();
    expect(queue.upNext?.songTitle).toBe("Song 2");
    expect(queue.waiting).toEqual([]);
    const mine = await getMyReviewTracking(context(undefined, device));
    expect(
      mine.submissions.find(item => item.submissionId === 1)
    ).toMatchObject({
      position: null,
      numberAhead: null,
      queueEligibilityReason: "paid_only",
    });
    expect(
      mine.submissions.find(item => item.submissionId === 3)
    ).toMatchObject({
      position: null,
      queueEligibilityReason: "awaiting_payment_confirmation",
    });
    expect(memory.tables.queue_state[0].submitPriceCents).toBe(0);
  });
  it("public items are an explicit allowlist with opaque non-credential keys", async () => {
    const queue = await getPublicReviewTrackingQueue();
    expect(Object.keys(queue.upNext!).sort()).toEqual(
      [
        "artistName",
        "key",
        "label",
        "position",
        "positionLabel",
        "songTitle",
        "status",
      ].sort()
    );
    expect(queue.upNext!.key).toBe(reviewTrackingPublicKey(1));
    expect(queue.upNext!.key).toMatch(/^q_[A-Za-z0-9_-]{43}$/);
    expect(queue.upNext!.key).not.toBe(
      hashReviewRecoveryToken("rt1_" + "a".repeat(43))
    );
    const serialized = JSON.stringify(queue);
    for (const secret of [
      "submissionId",
      "userId",
      "contactInfo",
      "stripePayment",
      "cashapp",
      "private artist",
      "tokenHash",
      "deviceHash",
      "fileUrl",
      "youtubeUrl",
    ])
      expect(serialized).not.toContain(secret);
  });
  it("tracks real reorder and paid priority without moving the current song", async () => {
    await startReviewQueueTrack(1);
    await reorderQueueSubmissions([3, 2]);
    expect((await getPublicReviewTrackingQueue()).upNext?.songTitle).toBe(
      "Song 3"
    );
    await confirmSkipPayment(2);
    const queue = await getPublicReviewTrackingQueue();
    expect(queue.current?.songTitle).toBe("Song 1");
    expect(queue.upNext?.songTitle).toBe("Song 2");
  });
  it("does not label unrelated legacy playing rows as current", async () => {
    setTracks(track(1, { status: "playing" }), track(2));
    memory.tables.queue_state[0].currentPlayingId = 99;
    const queue = await getPublicReviewTrackingQueue();
    expect(queue.current).toBeNull();
    const item = buildPrivateReviewTrackingItem(
      memory.tables.review_submissions[0],
      await getReviewQueueSnapshot()
    );
    expect(item).toMatchObject({
      status: "waiting",
      position: null,
      numberAhead: null,
      queueEligible: false,
    });
  });
  it("empty, offline and unavailable snapshots have no live positions", async () => {
    setTracks();
    expect(await getPublicReviewTrackingQueue()).toMatchObject({
      current: null,
      upNext: null,
      waiting: [],
      recent: [],
    });
    setTracks(track(1));
    memory.tables.queue_state[0].isLive = false;
    expect(await getPublicReviewTrackingQueue()).toMatchObject({
      isLive: false,
      availability: "offline",
      upNext: { position: null, positionLabel: "Up Next" },
    });
    memory.tables.queue_state = [];
    expect(await getPublicReviewTrackingQueue()).toMatchObject({
      isLive: false,
      availability: "unavailable",
      upNext: { position: null },
    });
  });
  it("completed and skipped occurrence reasons never turn into queue positions", async () => {
    setTracks(
      track(1, { status: "reviewed", reviewOccurrenceId: "manual-skip" }),
      track(2, { status: "reviewed", skipVoteTriggered: true }),
      track(3, { status: "reviewed", skippedLine: true })
    );
    memory.tables.review_occurrences = [
      {
        id: "manual-skip",
        submissionId: 1,
        completedAtMs: 1,
        completionReason: "skipped",
      },
    ];
    const queue = await getPublicReviewTrackingQueue();
    expect(
      queue.recent.find(item => item.songTitle === "Song 1")
    ).toMatchObject({ status: "skipped", position: null });
    expect(queue.recent.find(item => item.songTitle === "Song 2")?.status).toBe(
      "skipped"
    );
    expect(queue.recent.find(item => item.songTitle === "Song 3")?.status).toBe(
      "completed"
    );
  });
  it("database read failures reject instead of returning a fresh live fact", async () => {
    const row = memory.tables.review_submissions[0];
    Object.defineProperty(row, "artistName", {
      get() {
        throw new Error("Read failed");
      },
      enumerable: true,
    });
    await expect(getPublicReviewTrackingQueue()).rejects.toThrow("Read failed");
  });
});

describe("private tracking ownership and lifecycle", () => {
  it("combines signed browser tracks with account tracks across devices including terminal states", async () => {
    setTracks(
      track(1, { userId: 7 }),
      track(2, { userId: 99, status: "removed" }),
      track(3, {
        userId: 7,
        status: "reviewed",
        verdict: "Skipped by audience",
      }),
      track(4, { userId: 99 })
    );
    own(2);
    own(1);
    const mine = await getMyReviewTracking(context(7, device));
    expect(mine.submissions.map(item => item.submissionId)).toEqual([3, 2, 1]);
    expect(
      mine.submissions.find(item => item.submissionId === 2)
    ).toMatchObject({ status: "removed", position: null });
    expect(
      mine.submissions.find(item => item.submissionId === 3)
    ).toMatchObject({ status: "skipped", position: null });
    expect(
      (await getMyReviewTracking(context(7))).submissions.map(
        item => item.submissionId
      )
    ).toEqual([3, 1]);
    expect(
      (await getMyReviewTracking(context(undefined, "b".repeat(64))))
        .submissions
    ).toEqual([]);
    expect(JSON.stringify(mine)).not.toMatch(
      /userId|contactInfo|stripePayment|cashapp|deviceHash|private artist/
    );
  });
  it("anonymous view creates no identity cookie and no quota writes", async () => {
    const ctx = context();
    expect((await getMyReviewTracking(ctx)).submissions).toEqual([]);
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    expect(memory.writes).toBe(0);
    expect(memory.tables.review_daily_quotas).toBeUndefined();
  });
  it("positions and number ahead include current review, without exposing its raw ID", async () => {
    own(2);
    own(3);
    await startReviewQueueTrack(1);
    const mine = await getMyReviewTracking(context(undefined, device));
    expect(mine.current).toMatchObject({ songTitle: "Song 1", position: 0 });
    expect(mine.current).not.toHaveProperty("submissionId");
    expect(
      mine.submissions.find(item => item.submissionId === 2)
    ).toMatchObject({ position: 1, numberAhead: 1, status: "up_next" });
    expect(
      mine.submissions.find(item => item.submissionId === 3)
    ).toMatchObject({ position: 2, numberAhead: 2 });
    memory.tables.queue_state[0].isLive = false;
    expect(
      (await getMyReviewTracking(context(undefined, device))).submissions.every(
        item => item.position === null && item.numberAhead === null
      )
    ).toBe(true);
  });
  it("without a current review the next entry has nobody ahead", async () => {
    own(1);
    expect(
      (await getMyReviewTracking(context(undefined, device))).submissions[0]
    ).toMatchObject({ position: 1, numberAhead: 0 });
  });
  it("rejects tampered/malformed cookies and cannot use an unverified request cache", async () => {
    own(1);
    const ctx = context(undefined, device);
    expect(readTrackingDeviceHash(ctx)).toBe(
      hashReviewIdentity("device", device)
    );
    ctx.req.headers.cookie += ".extra";
    expect(readTrackingDeviceHash(ctx)).toBeNull();
    await expect(authorizeTrackedSubmission(ctx, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    ctx.req.headers.cookie = `mmm_review_device=${device}.${"0".repeat(64)}`;
    (ctx.req as any).reviewDevice = device;
    expect(readTrackingDeviceHash(ctx)).toBeNull();
    expect((await getMyReviewTracking(ctx)).submissions).toEqual([]);
  });
  it("read authorizer returns actual rows only for owning account/cookie", async () => {
    memory.tables.review_submissions[0].userId = 7;
    own(2);
    expect(await authorizeTrackedSubmission(context(7), 1)).toMatchObject({
      id: 1,
      contactInfo: "private1@example.com",
    });
    expect(
      await authorizeTrackedSubmission(context(undefined, device), 2)
    ).toMatchObject({ id: 2 });
    await expect(
      authorizeTrackedSubmission(context(8), 1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      authorizeTrackedSubmission(context(), 999)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      authorizeTrackedSubmission(context(), -1)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("honors new completion reason and legacy fallback without inventing manual skip history", () => {
    const reviewed = track(1, {
      status: "reviewed",
      verdict: "No crowd verdict",
      reviewOccurrenceId: "old",
    });
    expect(reviewTrackingTerminalStatus(reviewed)).toBe("completed");
    expect(reviewTrackingTerminalStatus(reviewed, "skipped")).toBe("skipped");
    expect(
      reviewTrackingTerminalStatus(
        { ...reviewed, skipVoteTriggered: true },
        "completed"
      )
    ).toBe("completed");
    expect(
      reviewTrackingTerminalStatus(
        { ...reviewed, status: "pending", skipVoteTriggered: true },
        "skipped"
      )
    ).toBeNull();
  });
  it("follows real completion/requeue and occurrence reason without stale-history status", async () => {
    own(1);
    await startReviewQueueTrack(1);
    await completeAndAdvanceReviewQueue(1);
    const occurrence = memory.tables.review_occurrences.find(
      row => row.submissionId === 1
    );
    occurrence.completionReason = "skipped";
    expect(
      (await getMyReviewTracking(context(undefined, device))).submissions[0]
    ).toMatchObject({ status: "skipped", position: null });
    await requeueSubmission(1);
    expect(
      (await getMyReviewTracking(context(undefined, device))).submissions[0]
    ).toMatchObject({
      status: "waiting",
      queueEligible: true,
      position: 2,
      numberAhead: 2,
    });
  });
});

describe("private recovery credentials and POST contracts", () => {
  it("issues 256-bit random fragment links, stores hashes only and resolves on another device", async () => {
    own(1);
    const issued = await issueReviewRecovery(context(undefined, device), 1);
    expect(issued.token).toMatch(/^rt1_[A-Za-z0-9_-]{43}$/);
    expect(issued.trackingPath).toBe(`/review/track#${issued.token}`);
    expect(issued.trackingPath).not.toContain("?");
    expect(memory.tables.review_submission_recovery_tokens[0]).toEqual({
      submissionId: 1,
      tokenHash: hashReviewRecoveryToken(issued.token),
      updatedAtMs: expect.any(Number),
    });
    expect(JSON.stringify(memory.tables)).not.toContain(issued.token);
    expect(await resolveReviewRecovery(issued.token)).toMatchObject({
      submission: { submissionId: 1, position: 1, numberAhead: 0 },
      upNext: { songTitle: "Song 1" },
    });
    expect(
      await authorizeTrackedSubmission(context(), 1, issued.token)
    ).toMatchObject({ id: 1 });
    await expect(
      authorizeTrackedSubmission(context(), 2, issued.token)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      JSON.stringify(await resolveReviewRecovery(issued.token))
    ).not.toMatch(/tokenHash|deviceHash|userId|cashapp|contactInfo|stripe/);
  });
  it("owner rotation revokes previous link and does not grant token holders mutation rights", async () => {
    own(1);
    const first = await issueReviewRecovery(context(undefined, device), 1);
    await expect(issueReviewRecovery(context(), 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const second = await issueReviewRecovery(context(undefined, device), 1);
    expect(second.token).not.toBe(first.token);
    expect(memory.tables.review_submission_recovery_tokens).toHaveLength(1);
    await expect(resolveReviewRecovery(first.token)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      (await resolveReviewRecovery(second.token)).submission.submissionId
    ).toBe(1);
  });
  it("only a real owner or admin can issue; missing rows and wrong ownership use same denial", async () => {
    await expect(issueReviewRecovery(context(), 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(issueReviewRecovery(context(), 999)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const admin = context(77);
    admin.user!.role = "admin";
    expect((await issueReviewRecovery(admin, 1)).trackingPath).toMatch(
      /^\/review\/track#/
    );
    const banned = context(7);
    banned.user!.isBanned = true;
    memory.tables.review_submissions[0].userId = 7;
    await expect(issueReviewRecovery(banned, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("resolves terminal rows and occurrence reasons with no live position", async () => {
    own(1);
    const issued = await issueReviewRecovery(context(undefined, device), 1);
    memory.tables.review_submissions[0].status = "reviewed";
    memory.tables.review_submissions[0].reviewOccurrenceId = "skip";
    memory.tables.review_occurrences = [
      { id: "skip", submissionId: 1, completionReason: "skipped" },
    ];
    expect(
      (await resolveReviewRecovery(issued.token)).submission
    ).toMatchObject({ status: "skipped", position: null });
    memory.tables.review_submissions[0].status = "removed";
    expect(
      (await resolveReviewRecovery(issued.token)).submission
    ).toMatchObject({ status: "removed", position: null });
  });
  it("unknown/malformed tokens cannot enumerate or read another submission", async () => {
    await expect(
      resolveReviewRecovery("rt1_" + "A".repeat(43))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveReviewRecovery("1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(memory.writes).toBe(0);
  });
  it("credential write failure returns no link and commits no token", async () => {
    own(1);
    memory.failAt = 1;
    await expect(
      issueReviewRecovery(context(undefined, device), 1)
    ).rejects.toThrow("Injected database failure");
    expect(memory.tables.review_submission_recovery_tokens).toEqual([]);
  });
  it("tRPC uses queries for public/mine and POST mutations for secret inputs with no-store headers", async () => {
    expect(reviewTrackingRouter._def.procedures.publicQueue._def.type).toBe(
      "query"
    );
    expect(reviewTrackingRouter._def.procedures.mine._def.type).toBe("query");
    expect(reviewTrackingRouter._def.procedures.issueRecovery._def.type).toBe(
      "mutation"
    );
    expect(reviewTrackingRouter._def.procedures.resolve._def.type).toBe(
      "mutation"
    );
    const ctx = context(undefined, device);
    own(1);
    const caller = reviewTrackingRouter.createCaller(ctx);
    const issued = await caller.issueRecovery({ submissionId: 1 });
    expect(
      (await caller.resolve({ token: issued.token })).submission.submissionId
    ).toBe(1);
    expect(ctx.res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, private"
    );
    expect(ctx.res.setHeader).toHaveBeenCalledWith(
      "Referrer-Policy",
      "no-referrer"
    );
    await expect(caller.resolve({ token: "bad" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.issueRecovery({ submissionId: -1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("freshness contract", () => {
  it("expired, error/reconnecting, browser-offline and server-offline data never expose live position", async () => {
    const now = 100_000;
    const queue = buildPublicReviewQueueSnapshot(
      await getReviewQueueSnapshot(),
      now
    );
    expect(isReviewTrackingSnapshotLive(queue, now)).toBe(true);
    expect(getReviewTrackingDisplayPosition(queue.upNext!, queue, now)).toBe(1);
    expect(
      getReviewTrackingDisplayPosition(
        queue.upNext!,
        queue,
        now + REVIEW_TRACKING_FRESH_MS
      )
    ).toBeNull();
    expect(
      getReviewTrackingDisplayPosition(queue.upNext!, queue, now, false)
    ).toBeNull();
    expect(
      getReviewTrackingDisplayPosition(
        queue.upNext!,
        { ...queue, availability: "offline", isLive: false },
        now
      )
    ).toBeNull();
    expect(isReviewTrackingSnapshotLive(undefined, now)).toBe(false);
    expect(isReviewTrackingSnapshotLive(queue, 0)).toBe(false);
  });
});
