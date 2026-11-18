import { randomUUID } from "node:crypto";
import { desc, eq, gt, asc } from "drizzle-orm";
import { getDb, getSetting, getQueueState } from "./db";
import { reviewLiveEvents, reviewSubmissions } from "../drizzle/schema";
import { REVIEW_STUDIO_DEFAULTS, type ReviewLiveEvent, type ReviewStudioSettings } from "../shared/review-studio";

export type ReviewEventInput = Omit<ReviewLiveEvent, "sequence" | "timestamp"> & { timestamp?: number };
let publisher: ((event: ReviewLiveEvent) => void) | undefined;
let dispatchedSequence = 0;
const delivered = new Set<string>();
export async function setReviewLivePublisher(fn: (event: ReviewLiveEvent) => void) {
  publisher = fn;
  const db = await getDb();
  if (db) {
    const [latest] = await db.select({ sequence: reviewLiveEvents.sequence }).from(reviewLiveEvents).orderBy(desc(reviewLiveEvents.sequence)).limit(1);
    dispatchedSequence = latest?.sequence ?? 0;
  }
}
const fromRow = (row: typeof reviewLiveEvents.$inferSelect): ReviewLiveEvent => ({ ...JSON.parse(row.payload), id: row.eventId, sequence: row.sequence, type: row.type, occurrenceId: row.occurrenceId, submissionId: row.submissionId, timestamp: row.timestampMs });
export async function appendReviewEvent(tx: any, event: ReviewEventInput): Promise<ReviewLiveEvent | null> {
  const timestamp = event.timestamp ?? Date.now();
  const [result] = await tx.insert(reviewLiveEvents).ignore().values({ eventId: event.id, type: event.type, occurrenceId: event.occurrenceId, submissionId: event.submissionId, timestampMs: timestamp, payload: JSON.stringify(event) });
  if (!result.affectedRows) return null;
  const [row] = await tx.select().from(reviewLiveEvents).where(eq(reviewLiveEvents.eventId, event.id)).limit(1);
  return row ? fromRow(row) : null;
}
export function broadcastReviewEvent(event: ReviewLiveEvent | null) {
  if (!event || delivered.has(event.id)) return;
  delivered.add(event.id);
  if (delivered.size > 5000) delivered.delete(delivered.values().next().value!);
  publisher?.(event);
}
export async function dispatchReviewJournal() {
  const db = await getDb(); if (!db) return;
  let rows;
  do {
    rows = await db.select().from(reviewLiveEvents).where(gt(reviewLiveEvents.sequence, dispatchedSequence)).orderBy(asc(reviewLiveEvents.sequence)).limit(250);
    for (const row of rows) { broadcastReviewEvent(fromRow(row)); dispatchedSequence = Math.max(dispatchedSequence, row.sequence); }
  } while (rows.length === 250);
}
export async function publishReviewEvent(event: ReviewEventInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const record = await appendReviewEvent(db, event);
  broadcastReviewEvent(record);
  return record;
}
export async function publishQueueChanged() {
  const state = await getQueueState();
  await publishReviewEvent({ id: `queue:${randomUUID()}`, type: "queue_changed", occurrenceId: null, submissionId: state?.currentPlayingId ?? null });
}
export async function getReviewEventFeed(after?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [latest] = await db.select({ sequence: reviewLiveEvents.sequence }).from(reviewLiveEvents).orderBy(desc(reviewLiveEvents.sequence)).limit(1);
  const state = await getQueueState();
  const [current] = state?.currentPlayingId ? await db.select({ reviewOccurrenceId: reviewSubmissions.reviewOccurrenceId }).from(reviewSubmissions).where(eq(reviewSubmissions.id, state.currentPlayingId)).limit(1) : [];
  const rows = after === undefined ? [] : await db.select().from(reviewLiveEvents).where(gt(reviewLiveEvents.sequence, after)).orderBy(asc(reviewLiveEvents.sequence)).limit(250);
  return { latestSequence: latest?.sequence ?? 0, occurrenceId: current?.reviewOccurrenceId ?? null, events: rows.map(fromRow) };
}
export async function getReviewStudioSettings(): Promise<ReviewStudioSettings> {
  let stored: Partial<ReviewStudioSettings> = {};
  try { stored = JSON.parse(await getSetting("review_studio_settings") ?? "{}"); } catch {}
  return { ...REVIEW_STUDIO_DEFAULTS, ...stored,
    sounds: REVIEW_STUDIO_DEFAULTS.sounds.map((sound) => ({ ...sound, ...(stored.sounds?.find((entry) => entry.id === sound.id) ?? {}) })),
    giftMappings: stored.giftMappings ?? [],
  };
}
