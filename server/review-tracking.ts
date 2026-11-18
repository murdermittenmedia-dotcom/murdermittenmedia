import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { parse } from "cookie";
import { and, desc, eq, getTableColumns, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  reviewOccurrences,
  reviewSubmissionOwners,
  reviewSubmissions,
  type ReviewSubmission,
} from "../drizzle/schema";
import { reviewSubmissionRecoveryTokens } from "../drizzle/review-tracking-schema";
import { isReviewSubmissionEligible } from "../shared/review-payment-access";
import {
  REVIEW_TRACKING_FRESH_MS,
  REVIEW_TRACKING_LABELS,
  type MyReviewTrackingSnapshot,
  type PrivateReviewTrackingItem,
  type PublicReviewQueueSnapshot,
  type PublicReviewTrackingItem,
  type ResolvedReviewTrackingSnapshot,
  type ReviewTrackingMetadata,
  type ReviewTrackingStatus,
} from "../shared/review-tracking";
import type { TrpcContext } from "./_core/context";
import { getDb, getReviewQueueSnapshot } from "./db";
import { hashReviewIdentity } from "./review-submission-identity";

type QueueSnapshot = Awaited<ReturnType<typeof getReviewQueueSnapshot>>;
export const REVIEW_RECOVERY_TOKEN_PATTERN = /^rt1_[A-Za-z0-9_-]{43}$/;
const denied = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "This tracking link or submission is not available to you.",
  });
function signingSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Review tracking is not configured.",
    });
  return secret;
}

/** Read-only validation of V1's signed opaque HttpOnly cookie. Does not issue
 * cookies, fingerprint a browser, inspect its IP, or read/write daily quotas. */
export function readTrackingDeviceHash(ctx: TrpcContext): string | null {
  let token: string;
  try {
    token = parse(ctx.req.headers.cookie ?? "").mmm_review_device ?? "";
  } catch {
    return null;
  }
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !/^[a-f0-9]{64}$/.test(parts[0]) ||
    !/^[a-f0-9]{64}$/.test(parts[1])
  )
    return null;
  const expected = createHmac("sha256", signingSecret())
    .update(parts[0])
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(parts[1], "hex")
  )
    ? hashReviewIdentity("device", parts[0])
    : null;
}
export function hashReviewRecoveryToken(token: string): string {
  return createHash("sha256")
    .update(`mmm:review:recovery:v1:${token}`)
    .digest("hex");
}
export function reviewTrackingPublicKey(submissionId: number): string {
  return `q_${createHmac("sha256", signingSecret()).update(`mmm:review:public:v1:${submissionId}`).digest("base64url")}`;
}
export function buildReviewTrackingMetadata(
  snapshot: QueueSnapshot,
  nowMs = Date.now()
): ReviewTrackingMetadata {
  const isLive = snapshot.state?.isLive === true;
  return {
    observedAtMs: nowMs,
    expiresAtMs: nowMs + REVIEW_TRACKING_FRESH_MS,
    availability: snapshot.state
      ? isLive
        ? "live"
        : "offline"
      : "unavailable",
    isLive,
  };
}
function waitingRows(snapshot: QueueSnapshot) {
  // Preserve exactly V1's ordered snapshot, applying V1's next-track eligibility.
  return snapshot.submissions.filter(
    row =>
      row.status === "pending" &&
      isReviewSubmissionEligible(row, snapshot.state?.playbackMode)
  );
}
export function reviewTrackingTerminalStatus(
  row: ReviewSubmission,
  completionReason?: string | null
): ReviewTrackingStatus | null {
  if (row.status === "removed") return "removed";
  if (row.status !== "reviewed") return null;
  if (completionReason === "skipped") return "skipped";
  if (completionReason === "removed") return "removed";
  if (completionReason === "completed") return "completed";
  // V1 manually-skipped and naturally-ended occurrences are indistinguishable.
  // Never infer a skip from no votes, skippedLine (a paid benefit), or occurrence
  // completion. Parent may persist verdict="Skipped by admin" for new skips.
  return row.skipVoteTriggered ||
    /^Skipped(?: by audience| by admin)?$/i.test(row.verdict ?? "")
    ? "skipped"
    : "completed";
}
export function buildPrivateReviewTrackingItem(
  row: ReviewSubmission,
  snapshot: QueueSnapshot,
  nowMs = Date.now(),
  completionReasons: ReadonlyMap<string, string | null> = new Map()
): PrivateReviewTrackingItem {
  // Prefer the single server queue snapshot to an earlier ownership/history read.
  const authoritative =
    snapshot.submissions.find(song => song.id === row.id) ?? row;
  const terminal = reviewTrackingTerminalStatus(
    authoritative,
    authoritative.reviewOccurrenceId
      ? completionReasons.get(authoritative.reviewOccurrenceId)
      : null
  );
  const waiting = waitingRows(snapshot);
  const index = waiting.findIndex(song => song.id === authoritative.id);
  const current = snapshot.currentPlaying?.id === authoritative.id && !terminal;
  const status: ReviewTrackingStatus =
    terminal ??
    (current ? "now_reviewing" : index === 0 ? "up_next" : "waiting");
  const queueEligible = !!current || index >= 0;
  const queueEligibilityReason: PrivateReviewTrackingItem["queueEligibilityReason"] =
    queueEligible
      ? "eligible"
      : authoritative.status !== "pending"
        ? "not_in_queue"
        : authoritative.isPaidSubmission &&
            !authoritative.paidSubmissionConfirmed
          ? "awaiting_payment_confirmation"
          : "paid_only";
  const live = buildReviewTrackingMetadata(snapshot, nowMs).isLive;
  const position = live && queueEligible ? (current ? 0 : index + 1) : null;
  const numberAhead =
    position === null
      ? null
      : current
        ? 0
        : index + (snapshot.currentPlaying ? 1 : 0);
  const label = REVIEW_TRACKING_LABELS[status];
  return {
    key: reviewTrackingPublicKey(authoritative.id),
    submissionId: authoritative.id,
    artistName: authoritative.artistName,
    songTitle: authoritative.songTitle,
    status,
    label,
    position,
    positionLabel:
      position === null
        ? label
        : position === 0
          ? label
          : `#${position} · ${label}`,
    numberAhead,
    queueEligible,
    queueEligibilityReason,
  };
}
export function buildPublicReviewTrackingItem(
  row: ReviewSubmission,
  snapshot: QueueSnapshot,
  nowMs = Date.now(),
  completionReasons: ReadonlyMap<string, string | null> = new Map()
): PublicReviewTrackingItem {
  const item = buildPrivateReviewTrackingItem(
    row,
    snapshot,
    nowMs,
    completionReasons
  );
  // Explicit allowlist: NEVER spread a DB row or private tracking item.
  return {
    key: item.key,
    artistName: item.artistName,
    songTitle: item.songTitle,
    status: item.status,
    label: item.label,
    position: item.position,
    positionLabel: item.positionLabel,
  };
}
export function buildPublicReviewQueueSnapshot(
  snapshot: QueueSnapshot,
  nowMs = Date.now(),
  completionReasons: ReadonlyMap<string, string | null> = new Map()
): PublicReviewQueueSnapshot {
  const waiting = waitingRows(snapshot);
  // Only display fields already authorized for V1's public review queue.
  const recent = snapshot.submissions
    .filter(row => row.status === "reviewed")
    .sort(
      (a, b) =>
        +(b.reviewedAt ?? b.updatedAt ?? b.createdAt) -
        +(a.reviewedAt ?? a.updatedAt ?? a.createdAt)
    )
    .slice(0, 20);
  return {
    ...buildReviewTrackingMetadata(snapshot, nowMs),
    current: snapshot.currentPlaying
      ? buildPublicReviewTrackingItem(snapshot.currentPlaying, snapshot, nowMs)
      : null,
    upNext: waiting[0]
      ? buildPublicReviewTrackingItem(waiting[0], snapshot, nowMs)
      : null,
    waiting: waiting
      .slice(1)
      .map(row => buildPublicReviewTrackingItem(row, snapshot, nowMs)),
    recent: recent.map(row =>
      buildPublicReviewTrackingItem(row, snapshot, nowMs, completionReasons)
    ),
  };
}
async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Review tracking is temporarily unavailable.",
    });
  return db;
}
async function findSubmission(submissionId: number) {
  const db = await requireDb();
  const [row] = await db
    .select()
    .from(reviewSubmissions)
    .where(eq(reviewSubmissions.id, submissionId))
    .limit(1);
  return row;
}
async function hasRecoveryAuthorization(
  submissionId: number,
  token?: string
): Promise<boolean> {
  if (!token || !REVIEW_RECOVERY_TOKEN_PATTERN.test(token)) return false;
  const db = await requireDb();
  const [credential] = await db
    .select()
    .from(reviewSubmissionRecoveryTokens)
    .where(
      and(
        eq(reviewSubmissionRecoveryTokens.submissionId, submissionId),
        eq(
          reviewSubmissionRecoveryTokens.tokenHash,
          hashReviewRecoveryToken(token)
        )
      )
    )
    .limit(1);
  return !!credential;
}
/** READ / linking-proof authorization only, never permission to edit, pay,
 * reprioritize, claim the account, rotate a credential, or operate the queue.
 * Returns the real row so the Galaxy linking service can check eligibility. */
export async function authorizeTrackedSubmission(
  ctx: TrpcContext,
  submissionId: number,
  token?: string
): Promise<ReviewSubmission> {
  if (!Number.isSafeInteger(submissionId) || submissionId <= 0) throw denied();
  const row = await findSubmission(submissionId);
  if (!row) throw denied();
  if (ctx.user && row.userId === ctx.user.id) return row;
  const deviceHash = readTrackingDeviceHash(ctx);
  if (deviceHash) {
    const db = await requireDb();
    const [owner] = await db
      .select()
      .from(reviewSubmissionOwners)
      .where(
        and(
          eq(reviewSubmissionOwners.submissionId, submissionId),
          eq(reviewSubmissionOwners.deviceHash, deviceHash)
        )
      )
      .limit(1);
    if (owner) return row;
  }
  if (await hasRecoveryAuthorization(submissionId, token)) return row;
  throw denied();
}
async function getCompletionReasons(
  rows: ReviewSubmission[]
): Promise<Map<string, string | null>> {
  const ids = Array.from(
    new Set(
      rows
        .filter(row => row.status === "reviewed")
        .map(row => row.reviewOccurrenceId)
        .filter((id): id is string => !!id)
    )
  );
  if (!ids.length) return new Map();
  const db = await requireDb();
  const occurrences = await db
    .select()
    .from(reviewOccurrences)
    .where(inArray(reviewOccurrences.id, ids));
  // Parent adds this nullable column to the existing occurrence schema; legacy
  // null rows retain verdict fallback. Never let requeue inherit prior status.
  return new Map(
    occurrences.map(row => [
      row.id,
      (row as typeof row & { completionReason?: string | null })
        .completionReason ?? null,
    ])
  );
}
export async function getPublicReviewTrackingQueue(): Promise<PublicReviewQueueSnapshot> {
  const snapshot = await getReviewQueueSnapshot();
  return buildPublicReviewQueueSnapshot(
    snapshot,
    Date.now(),
    await getCompletionReasons(snapshot.submissions)
  );
}
export async function getMyReviewTracking(
  ctx: TrpcContext
): Promise<MyReviewTrackingSnapshot> {
  const db = await getDb();
  if (!db)
    return {
      ...buildReviewTrackingMetadata({
        submissions: [],
        state: null,
        currentPlaying: null,
      }),
      current: null,
      upNext: null,
      submissions: [],
    };
  const deviceHash = readTrackingDeviceHash(ctx);
  const conditions = [
    ctx.user ? eq(reviewSubmissions.userId, ctx.user.id) : undefined,
    deviceHash ? eq(reviewSubmissionOwners.deviceHash, deviceHash) : undefined,
  ].filter(condition => condition !== undefined);
  const rows = conditions.length
    ? await db
        .select(getTableColumns(reviewSubmissions))
        .from(reviewSubmissions)
        .leftJoin(
          reviewSubmissionOwners,
          eq(reviewSubmissionOwners.submissionId, reviewSubmissions.id)
        )
        .where(or(...conditions))
        .orderBy(desc(reviewSubmissions.createdAt), desc(reviewSubmissions.id))
    : [];
  const snapshot = await getReviewQueueSnapshot();
  const completionReasons = await getCompletionReasons(rows);
  const nowMs = Date.now();
  const publicSnapshot = buildPublicReviewQueueSnapshot(snapshot, nowMs);
  return {
    ...buildReviewTrackingMetadata(snapshot, nowMs),
    current: publicSnapshot.current,
    upNext: publicSnapshot.upNext,
    submissions: rows.map(row =>
      buildPrivateReviewTrackingItem(row, snapshot, nowMs, completionReasons)
    ),
  };
}
/** Explicit owner/admin action; reissuance revokes every earlier link.
 * Only the digest is persisted. A recovery-token holder cannot rotate it. */
export async function issueReviewRecovery(
  ctx: TrpcContext,
  submissionId: number
): Promise<{ token: string; trackingPath: string }> {
  if (ctx.user?.isBanned) throw denied();
  const row =
    ctx.user?.role === "admin"
      ? await findSubmission(submissionId)
      : await authorizeTrackedSubmission(ctx, submissionId);
  if (!row) throw denied();
  const token = `rt1_${randomBytes(32).toString("base64url")}`;
  const tokenHash = hashReviewRecoveryToken(token);
  const updatedAtMs = Date.now();
  const db = await requireDb();
  await db
    .insert(reviewSubmissionRecoveryTokens)
    .values({ submissionId: row.id, tokenHash, updatedAtMs })
    .onDuplicateKeyUpdate({ set: { tokenHash, updatedAtMs } });
  return { token, trackingPath: `/review/track#${token}` };
}
export async function resolveReviewRecovery(
  token: string
): Promise<ResolvedReviewTrackingSnapshot> {
  if (!REVIEW_RECOVERY_TOKEN_PATTERN.test(token)) throw denied();
  const db = await requireDb();
  const [credential] = await db
    .select()
    .from(reviewSubmissionRecoveryTokens)
    .where(
      eq(
        reviewSubmissionRecoveryTokens.tokenHash,
        hashReviewRecoveryToken(token)
      )
    )
    .limit(1);
  if (!credential) throw denied();
  const row = await findSubmission(credential.submissionId);
  if (!row) throw denied();
  const snapshot = await getReviewQueueSnapshot();
  const completionReasons = await getCompletionReasons([row]);
  const nowMs = Date.now();
  const publicSnapshot = buildPublicReviewQueueSnapshot(snapshot, nowMs);
  return {
    ...buildReviewTrackingMetadata(snapshot, nowMs),
    current: publicSnapshot.current,
    upNext: publicSnapshot.upNext,
    submission: buildPrivateReviewTrackingItem(
      row,
      snapshot,
      nowMs,
      completionReasons
    ),
  };
}
