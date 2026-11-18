import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeReviewTestDatabase, resetReviewTestMemory } from "./review-test-database";
import type { TrpcContext } from "./_core/context";
import type { ReviewAdminVotesInput, ReviewLiveEvent } from "../shared/review-studio";

const memory = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: 0, failAt: 0 }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => makeReviewTestDatabase(memory) }));

import { getSongReactionCounts, startReviewQueueTrack, completeAndAdvanceReviewQueue, requeueSubmission } from "./db";
import { getOccurrenceReactionCounts, recordWebsiteReviewVote, recordReviewVoteInTransaction } from "./review-occurrences";
import { reviewStudioRouter } from "./review-studio-router";
import { setReviewLivePublisher, dispatchReviewJournal } from "./review-studio-events";
import { setReviewTransportPublisher } from "./review-transport";
import { reviewActivityText } from "../shared/review-studio";
import { getDb } from "./db";

function caller(role: string | null = "admin", id = 900) {
  return reviewStudioRouter.createCaller({ user: role ? { id, role, username: "private-admin-name", email: "private@example.test" } : null, req: { headers: {} }, res: {} } as unknown as TrpcContext);
}
function input(overrides: Partial<ReviewAdminVotesInput> = {}): ReviewAdminVotesInput {
  return { submissionId: 1, occurrenceId: memory.tables.review_submissions[0].reviewOccurrenceId, reaction: "fire", amount: 25, requestId: randomUUID(), ...overrides };
}
const additions = () => memory.tables.review_live_events.filter(row => row.type === "admin_votes_added");

beforeEach(async () => {
  vi.stubEnv("DATABASE_URL", "memory://isolated-admin-vote-regression-only");
  resetReviewTestMemory(memory);
  memory.tables.users.push({ id: 101, role: "user", username: "real-voter" }, { id: 102, role: "judge", artistName: "Panel Judge" });
  setReviewTransportPublisher(async () => {});
  await setReviewLivePublisher(() => {});
  await startReviewQueueTrack(1);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("reviewStudio.addVotes production backend", () => {
  it.each([null, "user", "judge", "contestant"])("rejects non-admin role %s without mutation", async role => {
    const original = structuredClone(memory.tables);
    await expect(caller(role).addVotes(input())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(memory.tables).toEqual(original);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amount %s without mutation", async amount => {
    const original = structuredClone(memory.tables);
    await expect(caller().addVotes(input({ amount }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(memory.tables).toEqual(original);
  });

  it("requires a UUID request ID and an actual reaction", async () => {
    await expect(caller().addVotes(input({ requestId: "not-a-uuid" }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().addVotes({ ...input(), reaction: "fake" as "fire" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(additions()).toHaveLength(0);
  });

  it("adds repeated arbitrary bulk amounts as separate counters and one administrative event per request", async () => {
    const received: ReviewLiveEvent[] = [];
    await setReviewLivePublisher(event => received.push(event));
    const firstInput = input({ amount: 3_000_000_000 });
    expect(await caller().addVotes(firstInput)).toEqual({ success: true, occurrenceId: firstInput.occurrenceId, fire: 3_000_000_000, trash: 0, adminFire: 3_000_000_000, adminTrash: 0, added: 3_000_000_000, duplicate: false });
    await caller().addVotes(input({ reaction: "trash", amount: 41 }));
    await caller().addVotes(input({ amount: 7 }));
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 3_000_000_007, trash: 41, adminFire: 3_000_000_007, adminTrash: 41, judgeFire: 0, judgeTrash: 0, judgeVotes: [] });
    expect(memory.tables.review_submissions[0]).toMatchObject({ fireCount: 3_000_000_007, trashCount: 41 });
    expect(memory.tables.review_occurrence_votes).toHaveLength(0);
    expect(memory.tables.song_reactions).toHaveLength(0);
    expect(memory.tables.users).toHaveLength(2);
    expect(additions()).toHaveLength(3);
    expect(received.map(event => event.type)).toEqual(["admin_votes_added", "admin_votes_added", "admin_votes_added"]);
    expect(received[0]).toMatchObject({ id: `admin-votes:${firstInput.requestId}`, actor: "Review admin", amount: 3_000_000_000, reaction: "fire", adminUserId: 900 });
    expect(received[0].soundId).toBeUndefined();
    expect(JSON.stringify(received)).not.toContain("private-admin-name");
    expect(JSON.stringify(received)).not.toContain("private@example.test");
    expect(reviewActivityText(received[0])).toBe("Review admin added 3,000,000,000 FIRE votes.");
  });

  it("preserves additions through normal website changes, repeats, TikTok votes, and judge votes", async () => {
    const occurrenceId = input().occurrenceId!;
    await caller().addVotes(input({ amount: 10 }));
    await caller().addVotes(input({ reaction: "trash", amount: 4 }));
    await recordWebsiteReviewVote(1, 101, "fire", occurrenceId);
    await recordWebsiteReviewVote(1, 101, "trash", occurrenceId);
    expect(await recordWebsiteReviewVote(1, 101, "trash", occurrenceId)).toMatchObject({ changed: false });
    await recordWebsiteReviewVote(1, 102, "fire", occurrenceId);
    const db = (await getDb())!;
    await db.transaction(tx => recordReviewVoteInTransaction(tx, 1, { platform: "tiktok", platformUserId: "actual-tiktok-viewer", displayName: "@actual-viewer" }, "fire", occurrenceId));
    expect(await getSongReactionCounts(1)).toMatchObject({ fire: 12, trash: 5, adminFire: 10, adminTrash: 4, judgeFire: 1, judgeTrash: 0, judgeVotes: [{ userId: 102, reaction: "fire" }] });
    expect(memory.tables.review_submissions[0]).toMatchObject({ fireCount: 12, trashCount: 5 });
    expect(memory.tables.review_occurrence_votes).toHaveLength(3);
    expect(memory.tables.song_reactions).toHaveLength(2);
  });

  it("deduplicates concurrent retries before mutation and returns original totals after completion", async () => {
    const request = input();
    const results = await Promise.all([caller().addVotes(request), caller().addVotes(request)]);
    expect(results.map(result => result.added)).toEqual([25, 0]);
    expect(results.map(result => result.duplicate)).toEqual([false, true]);
    expect(additions()).toHaveLength(1);
    await caller().addVotes(input({ amount: 3 }));
    await completeAndAdvanceReviewQueue(1);
    const original = structuredClone(memory.tables);
    const retry = await caller().addVotes({ ...request, requestId: request.requestId.toUpperCase() });
    expect(retry).toMatchObject({ fire: 25, trash: 0, adminFire: 25, adminTrash: 0, added: 0, duplicate: true, occurrenceId: request.occurrenceId });
    expect(memory.tables).toEqual(original);
    await setReviewLivePublisher(() => {});
    expect(await caller().addVotes(request)).toMatchObject({ duplicate: true, added: 0 });
    await dispatchReviewJournal();
    expect(additions()).toHaveLength(2);
  });

  it("binds a durable request ID to submission, reaction, amount, expected occurrence, and admin", async () => {
    const request = input();
    await caller().addVotes(request);
    const original = structuredClone(memory.tables);
    for (const changes of [{ amount: 26 }, { reaction: "trash" as const }, { submissionId: 2 }, { occurrenceId: randomUUID() }, { occurrenceId: undefined }]) {
      await expect(caller().addVotes({ ...request, ...changes })).rejects.toMatchObject({ code: "CONFLICT" });
    }
    await expect(caller("admin", 901).addVotes(request)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(memory.tables).toEqual(original);
  });

  it("rejects noncurrent, offline, completed, and stale occurrences without writes", async () => {
    const original = structuredClone(memory.tables);
    await expect(caller().addVotes(input({ submissionId: 2 }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().addVotes(input({ occurrenceId: randomUUID() }))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(memory.tables).toEqual(original);
    memory.tables.queue_state[0].isLive = false;
    await expect(caller().addVotes(input())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    memory.tables.queue_state[0].isLive = true;
    memory.tables.review_occurrences[0].completedAtMs = Date.now();
    await expect(caller().addVotes(input())).rejects.toMatchObject({ code: "CONFLICT" });
    expect(additions()).toHaveLength(0);
  });

  it("freezes combined completion results and starts requeued occurrences with no additions", async () => {
    const request = input({ amount: 9 });
    await caller().addVotes(request);
    await caller().addVotes(input({ reaction: "trash", amount: 2 }));
    await recordWebsiteReviewVote(1, 102, "fire", request.occurrenceId!);
    await completeAndAdvanceReviewQueue(1);
    const completed = structuredClone(memory.tables.review_occurrences[0]);
    expect(completed).toMatchObject({ fire: 10, trash: 2, adminFire: 9, adminTrash: 2, completedAtMs: expect.any(Number) });
    expect(memory.tables.review_submissions[0]).toMatchObject({ fireCount: 10, trashCount: 2, totalVoteCount: 12, judgeFireCount: 1 });
    expect(await getOccurrenceReactionCounts(1)).toMatchObject({ fire: 10, trash: 2, adminFire: 9, adminTrash: 2 });
    await requeueSubmission(1);
    const started = await startReviewQueueTrack(1);
    expect(started.reviewOccurrenceId).not.toBe(request.occurrenceId);
    expect(await getOccurrenceReactionCounts(1)).toMatchObject({ fire: 0, trash: 0, adminFire: 0, adminTrash: 0, judgeFire: 0 });
    await expect(caller().addVotes(input({ occurrenceId: request.occurrenceId }))).rejects.toMatchObject({ code: "CONFLICT" });
    await caller().addVotes(input({ amount: 8 }));
    expect(memory.tables.review_occurrences.find(row => row.id === request.occurrenceId)).toEqual(completed);
  });

  it("serializes addition with queue advancement, never leaking additions to the next song", async () => {
    const request = input({ amount: 17 });
    const [added, advanced] = await Promise.allSettled([caller().addVotes(request), completeAndAdvanceReviewQueue(1)]);
    expect(advanced.status).toBe("fulfilled");
    if (advanced.status === "fulfilled") expect(advanced.value.next?.id).toBe(2);
    if (added.status === "fulfilled") {
      expect(added.value.added).toBe(17);
      expect(memory.tables.review_occurrences[0]).toMatchObject({ fire: 17, adminFire: 17 });
    } else {
      expect(added.reason).toMatchObject({ code: "BAD_REQUEST" });
      expect(memory.tables.review_occurrences[0]).toMatchObject({ fire: 0, adminFire: 0 });
      expect(additions()).toHaveLength(0);
    }
    expect(await getOccurrenceReactionCounts(2)).toMatchObject({ fire: 0, trash: 0, adminFire: 0, adminTrash: 0 });
    await expect(caller().addVotes(input({ occurrenceId: request.occurrenceId }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows the safe integer maximum but atomically rejects overflow, including normal votes", async () => {
    const request = input({ amount: Number.MAX_SAFE_INTEGER });
    expect(await caller().addVotes(request)).toMatchObject({ fire: Number.MAX_SAFE_INTEGER, added: Number.MAX_SAFE_INTEGER });
    const original = structuredClone(memory.tables);
    await expect(caller().addVotes(input({ amount: 1 }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().addVotes(input({ reaction: "trash", amount: 1 }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(recordWebsiteReviewVote(1, 101, "trash", request.occurrenceId!)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(memory.tables).toEqual(original);
    await completeAndAdvanceReviewQueue(1);
    expect(memory.tables.review_submissions[0].totalVoteCount).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([1, 2, 3])("rolls back failure at mutation write %s so the same request can be retried", async offset => {
    const request = input();
    const original = structuredClone(memory.tables);
    memory.failAt = memory.writes + offset;
    await expect(caller().addVotes(request)).rejects.toThrow("Injected database failure");
    expect(memory.tables).toEqual(original);
    memory.failAt = 0;
    expect(await caller().addVotes(request)).toMatchObject({ added: 25, duplicate: false });
    expect(additions()).toHaveLength(1);
  });

  it("supports omitted occurrence only for the locked current song and adopts genuine legacy votes", async () => {
    memory.tables.review_submissions[0].reviewOccurrenceId = null;
    memory.tables.review_occurrences = [];
    memory.tables.review_live_events = [];
    memory.tables.song_reactions.push({ id: 1, submissionId: 1, userId: 101, reaction: "trash" });
    expect(await caller().addVotes(input({ occurrenceId: undefined, amount: 5 }))).toMatchObject({ fire: 5, trash: 1, adminFire: 5, adminTrash: 0 });
    expect(memory.tables.review_occurrence_votes).toMatchObject([{ userId: 101, reaction: "trash" }]);
    expect(memory.tables.review_submissions[0]).toMatchObject({ fireCount: 5, trashCount: 1 });
  });
});
