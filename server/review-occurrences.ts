import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { queueState, reviewOccurrences, reviewOccurrenceVotes, reviewSubmissions, reviewLiveEvents, songReactions, users } from "../drizzle/schema";
import { appendReviewEvent, broadcastReviewEvent } from "./review-studio-events";
import type { ReviewLiveEvent, ReviewAdminVotesInput, ReviewAdminVotesResult } from "../shared/review-studio";

export function reviewActor(user: { username?: string | null; instagramHandle?: string | null; artistName?: string | null; name?: string | null }) {
  const handle = user.username || user.instagramHandle;
  return handle ? `@${handle.replace(/^@/, "").slice(0, 100)}` : (user.artistName || user.name || "").slice(0, 128);
}
/** Called inside the same transaction that promotes the queue cursor. */
export async function beginReviewOccurrence(tx: any, song: { id: number; artistName: string; songTitle: string }, importLegacy = false) {
  const id: string = randomUUID();
  await tx.insert(reviewOccurrences).values({ id, submissionId: song.id, startedAtMs: Date.now() });
  await tx.update(reviewSubmissions).set({ reviewOccurrenceId: id, ...(importLegacy ? {} : { fireCount: 0, trashCount: 0 }) }).where(eq(reviewSubmissions.id, song.id));
  if (importLegacy) {
    const legacy = await tx.select().from(songReactions).where(eq(songReactions.submissionId, song.id));
    const seen = new Set<number>();
    for (const vote of legacy) {
      if (seen.has(vote.userId)) continue;
      seen.add(vote.userId);
      const [user] = await tx.select().from(users).where(eq(users.id, vote.userId)).limit(1);
      await tx.insert(reviewOccurrenceVotes).values({ occurrenceId: id, platform: "website", platformUserId: String(vote.userId), userId: vote.userId, displayName: user ? reviewActor(user) : "Website voter", reaction: vote.reaction });
    }
  }
  await appendReviewEvent(tx, { id: `started:${id}`, type: "song_started", occurrenceId: id, submissionId: song.id, artistName: song.artistName, songTitle: song.songTitle });
  return id;
}
/** Only the natural JS safe-integer limit applies; never round huge totals. */
function assertSafeReactionTotals(fire: number, trash: number) {
  if (![fire, trash, fire + trash].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The resulting vote total must be a safe integer (at most Number.MAX_SAFE_INTEGER)." });
  }
}
async function occurrenceTotals(reader: any, occurrence: any) {
  const votes = await reader.select().from(reviewOccurrenceVotes).where(eq(reviewOccurrenceVotes.occurrenceId, occurrence.id));
  const adminFire: number = occurrence.adminFire ?? 0;
  const adminTrash: number = occurrence.adminTrash ?? 0;
  const fire: number = occurrence.completedAtMs != null ? occurrence.fire : votes.filter((vote: any) => vote.reaction === "fire").length + adminFire;
  const trash: number = occurrence.completedAtMs != null ? occurrence.trash : votes.filter((vote: any) => vote.reaction === "trash").length + adminTrash;
  assertSafeReactionTotals(fire, trash);
  return { fire, trash, adminFire, adminTrash };
}
export async function finishReviewOccurrence(tx: any, song: { id: number; reviewOccurrenceId?: string | null; artistName: string; songTitle: string }, completionReason: "completed" | "skipped" | "removed" = "completed") {
  if (!song.reviewOccurrenceId) return;
  const [occurrence] = await tx.select().from(reviewOccurrences).where(eq(reviewOccurrences.id, song.reviewOccurrenceId)).limit(1).for("update");
  if (!occurrence || occurrence.completedAtMs != null) return;
  const { fire, trash } = await occurrenceTotals(tx, occurrence);
  await tx.update(reviewOccurrences).set({ completedAtMs: Date.now(), completionReason, fire, trash }).where(eq(reviewOccurrences.id, song.reviewOccurrenceId));
  await tx.update(reviewSubmissions).set({ fireCount: fire, trashCount: trash, totalVoteCount: fire + trash }).where(eq(reviewSubmissions.id, song.id));
  await appendReviewEvent(tx, { id: `completed:${song.reviewOccurrenceId}`, type: "song_completed", occurrenceId: song.reviewOccurrenceId, submissionId: song.id, artistName: song.artistName, songTitle: song.songTitle });
}
/** Adopt an already-running pre-update review without restarting its audio. */
export async function ensureCurrentReviewOccurrence() {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const [state] = await tx.select().from(queueState).limit(1).for("update");
    if (!state?.currentPlayingId) return null;
    const [song] = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1).for("update");
    if (!song || song.status !== "playing") return null;
    if (song.reviewOccurrenceId) return song.reviewOccurrenceId;
    return beginReviewOccurrence(tx, song, true);
  });
}
type OccurrenceReactionCounts = {
  occurrenceId: string; fire: number; trash: number; adminFire: number; adminTrash: number; judgeFire: number; judgeTrash: number;
  judgeVotes: Array<{ userId: number; username: string; reaction: "fire" | "trash"; avatarUrl: string | null }>;
};
export async function getOccurrenceReactionCounts(submissionId: number, reader?: any): Promise<OccurrenceReactionCounts | null> {
  const db = reader ?? await getDb();
  if (!db) return null;
  const [song] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, submissionId)).limit(1);
  if (!song?.reviewOccurrenceId) return null;
  const [occurrence] = await db.select().from(reviewOccurrences).where(eq(reviewOccurrences.id, song.reviewOccurrenceId)).limit(1);
  if (!occurrence) return null;
  const totals = await occurrenceTotals(db, occurrence);
  const judges = await db.select({ userId: users.id, artistName: users.artistName, name: users.name, avatarUrl: users.avatarUrl, reaction: reviewOccurrenceVotes.reaction })
    .from(reviewOccurrenceVotes).innerJoin(users, eq(users.id, reviewOccurrenceVotes.userId))
    .where(and(eq(reviewOccurrenceVotes.occurrenceId, song.reviewOccurrenceId), eq(users.role, "judge")));
  return { occurrenceId: song.reviewOccurrenceId, ...totals,
    judgeFire: judges.filter((vote: any) => vote.reaction === "fire").length, judgeTrash: judges.filter((vote: any) => vote.reaction === "trash").length,
    judgeVotes: judges.map((vote: any) => ({ userId: vote.userId, username: vote.artistName || vote.name || "Mitten Panel Judge", reaction: vote.reaction, avatarUrl: vote.avatarUrl })),
  };
}
export async function getOccurrenceUserReaction(submissionId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [song] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, submissionId)).limit(1);
  if (!song?.reviewOccurrenceId) return undefined;
  const [vote] = await db.select().from(reviewOccurrenceVotes).where(and(eq(reviewOccurrenceVotes.occurrenceId, song.reviewOccurrenceId), eq(reviewOccurrenceVotes.platform, "website"), eq(reviewOccurrenceVotes.platformUserId, String(userId)))).limit(1);
  return vote ?? null;
}
export type ReviewVoteIdentity = { platform: "website" | "tiktok"; platformUserId: string; userId?: number; displayName: string };
/** The cursor lock serializes votes with queue advancement. Source IDs stay
 * distinct unless accounts are actually linked; native poll totals never enter. */
export async function recordReviewVoteInTransaction(tx: any, submissionId: number, identity: ReviewVoteIdentity, reaction: "fire" | "trash", expectedOccurrence?: string) {
  const [state] = await tx.select().from(queueState).limit(1).for("update");
  const [song] = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, submissionId)).limit(1).for("update");
  if (!state?.isLive || state.currentPlayingId !== submissionId || song?.status !== "playing") throw new TRPCError({ code: "BAD_REQUEST", message: "Vote for the track currently playing in the live review." });
  const occurrenceId = song.reviewOccurrenceId ?? await beginReviewOccurrence(tx, song, true);
  if (expectedOccurrence && expectedOccurrence !== occurrenceId) throw new TRPCError({ code: "CONFLICT", message: "The review changed. Refresh and vote for the current song." });
  const [occurrence] = await tx.select().from(reviewOccurrences).where(eq(reviewOccurrences.id, occurrenceId)).limit(1).for("update");
  if (!occurrence || occurrence.submissionId !== submissionId || occurrence.completedAtMs != null) throw new TRPCError({ code: "CONFLICT", message: "This review occurrence has ended. Refresh the current song." });
  const [old] = await tx.select().from(reviewOccurrenceVotes).where(and(eq(reviewOccurrenceVotes.occurrenceId, occurrenceId), eq(reviewOccurrenceVotes.platform, identity.platform), eq(reviewOccurrenceVotes.platformUserId, identity.platformUserId))).limit(1).for("update");
  if (old?.reaction === reaction) return { changed: false, occurrenceId, event: null };
  const revision = (old?.revision ?? 0) + 1;
  if (old) await tx.update(reviewOccurrenceVotes).set({ reaction, revision, displayName: identity.displayName }).where(eq(reviewOccurrenceVotes.id, old.id));
  else await tx.insert(reviewOccurrenceVotes).values({ occurrenceId, platform: identity.platform, platformUserId: identity.platformUserId, userId: identity.userId ?? null, displayName: identity.displayName, reaction, revision });
  if (identity.platform === "website" && identity.userId) {
    const [legacy] = await tx.select().from(songReactions).where(and(eq(songReactions.submissionId, submissionId), eq(songReactions.userId, identity.userId))).limit(1);
    if (legacy) await tx.update(songReactions).set({ reaction }).where(eq(songReactions.id, legacy.id));
    else await tx.insert(songReactions).values({ submissionId, userId: identity.userId, reaction });
  }
  const { fire, trash } = await occurrenceTotals(tx, occurrence);
  await tx.update(reviewSubmissions).set({ fireCount: fire, trashCount: trash }).where(eq(reviewSubmissions.id, submissionId));
  const voter = createHash("sha256").update(identity.platformUserId).digest("hex").slice(0, 32);
  const event = await appendReviewEvent(tx, { id: `vote:${occurrenceId}:${identity.platform}:${voter}:${revision}`, type: old ? "vote_changed" : "valid_vote_recorded", occurrenceId, submissionId, actor: identity.displayName, reaction, songTitle: song.songTitle, artistName: song.artistName });
  return { changed: true, occurrenceId, event };
}
export async function recordWebsiteReviewVote(submissionId: number, userId: number, reaction: "fire" | "trash", expectedOccurrence?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to vote." });
  const result = await db.transaction((tx) => recordReviewVoteInTransaction(tx, submissionId, { platform: "website", platformUserId: String(userId), userId, displayName: reviewActor(user) }, reaction, expectedOccurrence));
  broadcastReviewEvent(result.event as ReviewLiveEvent | null);
  return { success: true as const, changed: result.changed, occurrenceId: result.occurrenceId };
}
/** Called only by the admin procedure. One durable journal entry represents the
 * whole addition, not fabricated voter identities or per-vote audio events. */
export async function addAdminReviewVotes(input: ReviewAdminVotesInput, adminUserId: number): Promise<ReviewAdminVotesResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a positive safe-integer number of votes." });
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const eventId = `admin-votes:${input.requestId.toLowerCase()}`;
  const requestedOccurrenceId = input.occurrenceId ?? null;
  const result = await db.transaction(async (tx) => {
    // Lock order agrees with normal votes and queue transitions. Deduplicate
    // before any mutation, even if the original occurrence is no longer live.
    const [state] = await tx.select().from(queueState).limit(1).for("update");
    const [existing] = await tx.select().from(reviewLiveEvents).where(eq(reviewLiveEvents.eventId, eventId)).limit(1).for("update");
    if (existing) {
      const previous = JSON.parse(existing.payload) as ReviewLiveEvent;
      if (existing.type !== "admin_votes_added" || existing.submissionId !== input.submissionId || previous.reaction !== input.reaction || previous.amount !== input.amount || previous.adminUserId !== adminUserId || (previous.requestedOccurrenceId ?? null) !== requestedOccurrenceId) {
        throw new TRPCError({ code: "CONFLICT", message: "This request ID was already used for a different vote addition." });
      }
      return { response: { success: true as const, occurrenceId: existing.occurrenceId!, fire: previous.fire!, trash: previous.trash!, adminFire: previous.adminFire!, adminTrash: previous.adminTrash!, added: 0, duplicate: true }, event: null };
    }
    const [song] = await tx.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, input.submissionId)).limit(1).for("update");
    if (!state?.isLive || state.currentPlayingId !== input.submissionId || song?.status !== "playing") throw new TRPCError({ code: "BAD_REQUEST", message: "Add votes only to the track currently playing in the live review." });
    const occurrenceId = song.reviewOccurrenceId ?? await beginReviewOccurrence(tx, song, true);
    if (requestedOccurrenceId && requestedOccurrenceId !== occurrenceId) throw new TRPCError({ code: "CONFLICT", message: "The review changed. Refresh before adding votes." });
    const [occurrence] = await tx.select().from(reviewOccurrences).where(eq(reviewOccurrences.id, occurrenceId)).limit(1).for("update");
    if (!occurrence || occurrence.submissionId !== input.submissionId || occurrence.completedAtMs != null) throw new TRPCError({ code: "CONFLICT", message: "This review occurrence has ended. Refresh the current song." });
    const totals = await occurrenceTotals(tx, occurrence);
    const fire = totals.fire + (input.reaction === "fire" ? input.amount : 0);
    const trash = totals.trash + (input.reaction === "trash" ? input.amount : 0);
    const adminFire = totals.adminFire + (input.reaction === "fire" ? input.amount : 0);
    const adminTrash = totals.adminTrash + (input.reaction === "trash" ? input.amount : 0);
    assertSafeReactionTotals(fire, trash);
    await tx.update(reviewOccurrences).set({ adminFire, adminTrash }).where(eq(reviewOccurrences.id, occurrenceId));
    await tx.update(reviewSubmissions).set({ fireCount: fire, trashCount: trash }).where(eq(reviewSubmissions.id, input.submissionId));
    const event = await appendReviewEvent(tx, { id: eventId, type: "admin_votes_added", occurrenceId, submissionId: input.submissionId, actor: "Review admin", adminUserId, requestedOccurrenceId, reaction: input.reaction, amount: input.amount, fire, trash, adminFire, adminTrash, songTitle: song.songTitle, artistName: song.artistName });
    if (!event) throw new TRPCError({ code: "CONFLICT", message: "This vote addition was already recorded. Retry with the same request ID." });
    return { response: { success: true as const, occurrenceId, fire, trash, adminFire, adminTrash, added: input.amount, duplicate: false }, event };
  });
  broadcastReviewEvent(result.event);
  return result.response;
}
