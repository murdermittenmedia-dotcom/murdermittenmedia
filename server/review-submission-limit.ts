import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reviewDailyQuotas, reviewSubmissionOwners, reviewSubmissions, queueState, users, notifications, type InsertReviewSubmission } from "../drizzle/schema";
import { getDb, createActivityEvent } from "./db";
import { appendReviewEvent, dispatchReviewJournal, publishQueueChanged } from "./review-studio-events";
import { reviewActor } from "./review-occurrences";
import type { ReviewIdentity } from "./review-submission-identity";
import type { TrpcContext } from "./_core/context";

export const REVIEW_DAILY_LIMIT = 2;
export const REVIEW_DAILY_LIMIT_MESSAGE = "Daily limit reached: two Music Review submissions per device/IP per day. Resets at midnight Michigan time. Line skips and full-song add-ons do not unlock extra submissions.";

export async function getReviewSubmissionAllowance(identity: ReviewIdentity) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const rows = await db.select().from(reviewDailyQuotas).where(and(eq(reviewDailyQuotas.day, identity.day), inArray(reviewDailyQuotas.identityHash, identity.keys)));
  const used = Math.max(0, ...rows.map((row) => row.submissions));
  return { limit: REVIEW_DAILY_LIMIT, used, remaining: Math.max(0, REVIEW_DAILY_LIMIT - used), day: identity.day, resetTimezone: "America/Detroit" };
}
export async function assertReviewSubmissionAllowance(identity: ReviewIdentity) {
  const allowance = await getReviewSubmissionAllowance(identity);
  if (!allowance.remaining) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: REVIEW_DAILY_LIMIT_MESSAGE });
  return allowance;
}

/** Counter claims, insertion and private ownership commit together. Removing or
 * replaying a track cannot refund daily capacity; paying cannot bypass it. */
export async function createLimitedReviewSubmission(data: InsertReviewSubmission, identity: ReviewIdentity) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const submissionId = await db.transaction(async (tx) => {
    for (const key of [...identity.keys].sort()) {
      await tx.insert(reviewDailyQuotas).values({ day: identity.day, identityHash: key, submissions: 0 })
        .onDuplicateKeyUpdate({ set: { identityHash: key } });
      const [quota] = await tx.select().from(reviewDailyQuotas).where(and(eq(reviewDailyQuotas.day, identity.day), eq(reviewDailyQuotas.identityHash, key))).for("update");
      if (!quota || quota.submissions >= REVIEW_DAILY_LIMIT) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: REVIEW_DAILY_LIMIT_MESSAGE });
      await tx.update(reviewDailyQuotas).set({ submissions: quota.submissions + 1 }).where(eq(reviewDailyQuotas.id, quota.id));
    }
    // Share the queue cursor lock with admin transitions to assign a stable tail.
    const [lockedState] = await tx.select().from(queueState).limit(1).for("update");
    if (lockedState?.playbackMode === "paid_only" && !data.isPaidSubmission) throw new TRPCError({ code: "FORBIDDEN", message: "Music Review is paid only. Free submissions are blocked until the admin switches this mode off." });
    const [tail] = await tx.select({ maxPos: sql<number>`MAX(${reviewSubmissions.position})` }).from(reviewSubmissions).where(eq(reviewSubmissions.status, "pending"));
    const [result] = await tx.insert(reviewSubmissions).values({ ...data, position: Number(tail?.maxPos ?? 0) + 1 });
    const id = Number(result.insertId);
    await tx.insert(reviewSubmissionOwners).values({ submissionId: id, deviceHash: identity.deviceHash });
    const [artist] = data.userId ? await tx.select().from(users).where(eq(users.id, data.userId)).limit(1) : [];
    await appendReviewEvent(tx, { id: `submission:${id}`, type: "submission_accepted", occurrenceId: null, submissionId: id, actor: artist ? reviewActor(artist) || data.artistName : data.artistName, songTitle: data.songTitle, artistName: data.artistName });
    return id;
  });
  await dispatchReviewJournal();
  await publishQueueChanged();
  void createActivityEvent("review", `${data.artistName} entered the review queue`, { detail: data.songTitle }).catch(() => {});
  try {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    if (admins.length) await db.insert(notifications).values(admins.map((admin) => ({ userId: admin.id, type: "admin_new_submission" as const, title: "New music review submission", body: `${data.artistName} submitted “${data.songTitle}” to the review queue.`, link: "/admin-popout" })));
  } catch {}
  return submissionId;
}

export async function getOwnedReviewSubmission(ctx: TrpcContext, identity: ReviewIdentity, submissionId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [song] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, submissionId)).limit(1);
  const [owner] = await db.select().from(reviewSubmissionOwners).where(eq(reviewSubmissionOwners.submissionId, submissionId)).limit(1);
  if (!song || !(ctx.user && song.userId === ctx.user.id) && owner?.deviceHash !== identity.deviceHash) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This submission does not belong to your account or device." });
  }
  return song;
}
export async function getDeviceReviewSubmissions(identity: ReviewIdentity) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: reviewSubmissions.id, songTitle: reviewSubmissions.songTitle, artistName: reviewSubmissions.artistName, status: reviewSubmissions.status })
    .from(reviewSubmissions).innerJoin(reviewSubmissionOwners, eq(reviewSubmissionOwners.submissionId, reviewSubmissions.id))
    .where(and(eq(reviewSubmissionOwners.deviceHash, identity.deviceHash), inArray(reviewSubmissions.status, ["pending", "playing"]))).orderBy(asc(reviewSubmissions.createdAt));
}
