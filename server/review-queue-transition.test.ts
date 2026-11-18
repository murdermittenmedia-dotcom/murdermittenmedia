import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeReviewTestDatabase,
  resetReviewTestMemory,
  reviewTestSong as song,
} from "./review-test-database";
import { selectReviewOverlayState } from "../shared/review-overlay";

const memory = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  writes: 0,
  failAt: 0,
}));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => makeReviewTestDatabase(memory),
}));

import {
  approveReviewPayment,
  confirmSkipPayment,
  reorderQueueSubmissions,
  completeAndAdvanceReviewQueue,
  getReviewQueueSnapshot,
  startReviewQueueTrack,
  stopReviewQueuePlayback,
  updateLiveReviewClock,
} from "./db";
import {
  executeReviewTransport,
  setReviewTransportPublisher,
  withReviewTransportLock,
} from "./review-transport";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "memory://isolated-regression-only");
  resetReviewTestMemory(memory);
  setReviewTransportPublisher(async () => {});
});

describe("production live-review queue transitions", () => {
  it("manual skip commits history and broadcasts the next track without any client follow-up load", async () => {
    const received: any[] = [];
    setReviewTransportPublisher(async () => {
      received.push(await getReviewQueueSnapshot());
    });
    await executeReviewTransport({ action: "start", submissionId: 1 });
    const result = await executeReviewTransport({
      action: "complete",
      submissionId: 1,
    });
    expect(result.next?.id).toBe(2);
    expect(received.at(-1).currentPlaying.id).toBe(2);
    // Preloaded career totals do not leak into a freshly started occurrence.
    expect(
      received.at(-1).submissions.find((row: any) => row.id === 1)
    ).toMatchObject({ status: "reviewed", totalVoteCount: 0 });
    expect(
      received.at(-1).submissions.filter((row: any) => row.status === "pending")
    ).toMatchObject([{ id: 3, position: 1 }]);
    expect(
      memory.tables.review_live_events
        .filter(row => row.type !== "queue_changed")
        .map(row => row.type)
    ).toEqual(["song_started", "song_completed", "song_started"]);
    expect(memory.tables.review_occurrences[0]).toMatchObject({
      submissionId: 1,
      fire: 0,
      trash: 0,
      completedAtMs: expect.any(Number),
    });
  });

  it("natural endings advance YouTube -> file -> YouTube in order and end with a clean stopped queue", async () => {
    await startReviewQueueTrack(1);
    for (const [completedId, nextId] of [
      [1, 2],
      [2, 3],
      [3, null],
    ]) {
      const result = await executeReviewTransport({
        action: "complete",
        submissionId: completedId!,
      });
      expect(result.next?.id ?? null).toBe(nextId);
    }
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying).toBeNull();
    expect(snapshot.state?.livePlaybackState).toBe("stopped");
    expect(snapshot.submissions.every(row => row.status === "reviewed")).toBe(
      true
    );
    expect(memory.tables.review_occurrences).toHaveLength(3);
    expect(
      memory.tables.review_occurrences.every(row => row.completedAtMs != null)
    ).toBe(true);
  });

  it("simultaneous skip/ended/cutoff for the old song promotes exactly one next track", async () => {
    await startReviewQueueTrack(1);
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        executeReviewTransport({ action: "complete", submissionId: 1 })
      )
    );
    expect(results.filter(result => !result.stale)).toHaveLength(1);
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying?.id).toBe(2);
    expect(snapshot.submissions.find(row => row.id === 2)?.status).toBe(
      "playing"
    );
    expect(
      memory.tables.review_occurrences.filter(row => row.submissionId === 2)
    ).toHaveLength(1);
    expect(
      memory.tables.review_live_events.filter(
        row => row.type === "song_completed"
      )
    ).toHaveLength(1);
  });

  it("rolls back a failed promotion so retry still has the original active song", async () => {
    await startReviewQueueTrack(1);
    const original = structuredClone(memory.tables);
    // Fail at the next occurrence's journal insert, after both old completion
    // writes and the new cursor/occurrence have already changed the snapshot.
    memory.failAt = memory.writes + 10;
    await expect(completeAndAdvanceReviewQueue(1)).rejects.toThrow(
      "Injected database failure"
    );
    expect(memory.tables).toEqual(original);
    memory.failAt = 0;
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(2);
    expect(memory.tables.review_occurrences).toHaveLength(2);
  });

  it("repairs a null cursor only for a genuinely playing row, never a reviewed row", async () => {
    memory.tables.review_submissions[0].status = "playing";
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(2);
    const original = structuredClone(memory.tables);
    expect((await completeAndAdvanceReviewQueue(1)).stale).toBe(true);
    expect(memory.tables).toEqual(original);
  });

  it("an old YouTube tick cannot resurrect its song or overwrite the next song clock", async () => {
    await startReviewQueueTrack(1);
    await executeReviewTransport({ action: "complete", submissionId: 1 });
    const before = structuredClone(memory.tables.queue_state[0]);
    await withReviewTransportLock(() =>
      updateLiveReviewClock({
        submissionId: 1,
        playbackState: "playing",
        startedAt: 100,
        positionMs: 88000,
      })
    );
    expect(memory.tables.queue_state[0]).toEqual(before);
    await updateLiveReviewClock({
      submissionId: 2,
      playbackState: "paused",
      startedAt: before.livePlaybackStartedAt,
      positionMs: 12000,
    });
    expect(memory.tables.queue_state[0]).toMatchObject({
      currentPlayingId: 2,
      livePlaybackPositionMs: 12000,
      livePlaybackState: "paused",
    });
  });

  it("keeps paid priority ordering and renumbers the normal waiting line from one", async () => {
    memory.tables.review_submissions.push(song(4));
    await startReviewQueueTrack(1);
    await confirmSkipPayment(4);
    const result = await completeAndAdvanceReviewQueue(1);
    expect(result.next?.id).toBe(4);
    const waiting = (await getReviewQueueSnapshot()).submissions.filter(
      row => row.status === "pending"
    );
    expect(waiting.map(row => [row.id, row.position])).toEqual([
      [2, 1],
      [3, 2],
    ]);
  });

  it("rejects loading a reviewed song and stopping returns only playing songs to pending", async () => {
    await startReviewQueueTrack(1);
    await completeAndAdvanceReviewQueue(1);
    await expect(startReviewQueueTrack(1)).rejects.toThrow("Requeue");
    await stopReviewQueuePlayback();
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying).toBeNull();
    expect(snapshot.submissions.find(row => row.id === 1)?.status).toBe(
      "reviewed"
    );
    expect(snapshot.submissions.find(row => row.id === 2)?.status).toBe(
      "pending"
    );
  });

  it("manually selecting another queued track finishes the old track instead of putting it back at number one", async () => {
    await executeReviewTransport({ action: "start", submissionId: 1 });
    await executeReviewTransport({ action: "start", submissionId: 3 });
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying?.id).toBe(3);
    expect(snapshot.submissions.find(row => row.id === 1)?.status).toBe(
      "reviewed"
    );
    expect(
      snapshot.submissions.filter(row => row.status === "pending")
    ).toMatchObject([{ id: 2, position: 1 }]);
  });

  it("holds an unpaid entry out of automatic playback until the administrator approves it", async () => {
    Object.assign(memory.tables.review_submissions[1], {
      isPaidSubmission: true,
      paidSubmissionConfirmed: false,
      paidSubmissionType: "reentry5",
    });
    await startReviewQueueTrack(1);
    await expect(startReviewQueueTrack(2)).rejects.toThrow(
      "no longer in the active queue"
    );
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(3);
    await approveReviewPayment(2, "paid_submission");
    expect((await completeAndAdvanceReviewQueue(3)).next?.id).toBe(2);
  });

  it("approving a full-song payment or skip does not restart the current playback clock", async () => {
    await startReviewQueueTrack(1);
    const transport = structuredClone(memory.tables.queue_state[0]);
    await approveReviewPayment(1, "full_song");
    await approveReviewPayment(3, "skip");
    expect(memory.tables.queue_state[0]).toEqual(transport);
    expect(
      memory.tables.review_submissions.find(row => row.id === 1)
        .paidSubmissionConfirmed
    ).toBe(true);
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(3);
  });

  it("manual reordering can override a paid skip without changing the playing song", async () => {
    await startReviewQueueTrack(1);
    await confirmSkipPayment(3);
    await reorderQueueSubmissions([2, 3]);
    expect((await getReviewQueueSnapshot()).currentPlaying?.id).toBe(1);
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(2);
  });

  it("a stale reorder cannot return the active or completed track to the waiting line", async () => {
    await startReviewQueueTrack(1);
    await expect(reorderQueueSubmissions([1, 2, 3])).rejects.toThrow(
      "queue has changed"
    );
    expect((await getReviewQueueSnapshot()).currentPlaying?.id).toBe(1);
    await expect(reorderQueueSubmissions([2, 2])).rejects.toThrow("unique");
  });

  it("reloading the already active song preserves its occurrence, clock, and start journal", async () => {
    await startReviewQueueTrack(1);
    const original = structuredClone(memory.tables);
    const result = await startReviewQueueTrack(1);
    expect(result.reviewOccurrenceId).toBe(
      original.review_submissions[0].reviewOccurrenceId
    );
    expect(memory.tables).toEqual(original);
  });

  it("paid-only mode neither plays nor displays free/unapproved tracks and preserves approved priority order", async () => {
    memory.tables.queue_state[0].playbackMode = "paid_only";
    Object.assign(memory.tables.review_submissions[1], {
      isPaidSubmission: true,
      paidSubmissionConfirmed: false,
    });
    Object.assign(memory.tables.review_submissions[2], {
      isPaidSubmission: true,
      paidSubmissionConfirmed: true,
    });
    memory.tables.review_submissions.push({
      ...song(4),
      isPaidSubmission: true,
      paidSubmissionConfirmed: true,
    });
    await confirmSkipPayment(4);
    const before = await getReviewQueueSnapshot();
    const overlay = selectReviewOverlayState(before, []);
    expect(overlay.next.map(track => track.id)).toEqual([4, 3]);
    expect(overlay.inLine).toBe(2);
    await expect(startReviewQueueTrack(1)).rejects.toThrow(
      "no longer in the active queue"
    );
    await expect(startReviewQueueTrack(2)).rejects.toThrow(
      "no longer in the active queue"
    );
    await startReviewQueueTrack(4);
    expect((await completeAndAdvanceReviewQueue(4)).next?.id).toBe(3);
    expect((await completeAndAdvanceReviewQueue(3)).next).toBeNull();
    const after = await getReviewQueueSnapshot();
    expect(
      after.submissions
        .filter(row => row.status === "pending")
        .map(row => row.id)
    ).toEqual([1, 2]);
    expect(selectReviewOverlayState(after, []).inLine).toBe(0);
  });
});
