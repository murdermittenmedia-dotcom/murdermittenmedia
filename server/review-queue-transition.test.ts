import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const memory = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: 0, failAt: 0 }));

// Stateful transactional adapter, not a reimplementation of queue advancement.
// Tests below invoke the production DB helpers and executeReviewTransport itself.
function makeDatabase(tables: Record<string, any[]>, transactional = false): any {
  const dialect = new MySqlDialect();
  const match = (row: any, condition: any) => {
    if (!condition) return true;
    const { sql, params } = dialect.sqlToQuery(condition);
    let index = 0;
    const terms = [...sql.matchAll(/`[^`]+`\.`([^`]+)`\s*(=|<>|!=)\s*\?/g)];
    return terms.every((term) => {
      const expected = params[index++];
      return term[2] === "=" ? row[term[1]] === expected : row[term[1]] !== expected;
    });
  };
  const db: any = {
    select() {
      let table = "", condition: any, maximum = Infinity, ordering: any[] = [];
      const builder: any = {
        from(value: any) { table = getTableName(value); return builder; },
        where(value: any) { condition = value; return builder; },
        limit(value: number) { maximum = value; return builder; },
        orderBy(...values: any[]) { ordering = values; return builder; },
        for() { return builder; }, innerJoin() { return builder; },
        then(resolve: any, reject: any) {
          try {
            const rows = (tables[table] ?? []).filter((row) => match(row, condition));
            rows.sort((a, b) => {
              for (const order of ordering) {
                const q = dialect.sqlToQuery(order).sql;
                const key = q.match(/`[^`]+`\.`([^`]+)`/)?.[1];
                if (!key || a[key] === b[key]) continue;
                return (a[key] > b[key] ? 1 : -1) * (/desc/i.test(q) ? -1 : 1);
              }
              return 0;
            });
            return Promise.resolve(structuredClone(rows.slice(0, maximum))).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return builder;
    },
    update(value: any) {
      let values: any;
      const builder = {
        set(next: any) { values = next; return builder; },
        async where(condition: any) {
          memory.writes++;
          if (memory.failAt && memory.writes === memory.failAt) throw new Error("Injected database failure");
          let affectedRows = 0;
          for (const row of tables[getTableName(value)] ?? []) {
            if (match(row, condition)) { Object.assign(row, values); affectedRows++; }
          }
          return [{ affectedRows }];
        },
      };
      return builder;
    },
    async transaction(operation: any) {
      const snapshot = structuredClone(memory.tables);
      const result = await operation(makeDatabase(snapshot, true));
      // Publish the entire committed state only after all writes succeed.
      for (const key of Object.keys(tables)) delete tables[key];
      Object.assign(tables, snapshot);
      return result;
    },
  };
  return db;
}
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => makeDatabase(memory.tables) }));

import { approveReviewPayment, confirmSkipPayment, reorderQueueSubmissions, completeAndAdvanceReviewQueue, getReviewQueueSnapshot, startReviewQueueTrack, stopReviewQueuePlayback, updateLiveReviewClock } from "./db";
import { executeReviewTransport, setReviewTransportPublisher, withReviewTransportLock } from "./review-transport";

const song = (id: number, type = "youtube", priority = false) => ({ id, status: "pending", position: id,
  artistName: `Artist ${id}`, songTitle: `Song ${id}`, submissionType: type, youtubeUrl: type === "youtube" ? `https://youtu.be/video${id}` : null,
  fileUrl: type === "file" ? `/manus-storage/song${id}.mp3` : null,
  skipPaymentConfirmed: priority, fireCount: 3, trashCount: 1, createdAt: new Date(id * 1000) });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "memory://isolated-regression-only");
  for (const key of Object.keys(memory.tables)) delete memory.tables[key];
  Object.assign(memory.tables, { queue_state: [{ id: 1, currentPlayingId: null, isLive: true,
    livePlaybackState: "stopped", livePlaybackRevision: 0, livePlaybackPositionMs: 0, livePlaybackStartedAt: null }],
    review_submissions: [song(1), song(2, "file"), song(3)], song_reactions: [] });
  memory.writes = 0; memory.failAt = 0;
  setReviewTransportPublisher(async () => {});
});

describe("production live-review queue transitions", () => {
  it("manual skip commits history and broadcasts the next track without any client follow-up load", async () => {
    const received: any[] = [];
    setReviewTransportPublisher(async () => { received.push(await getReviewQueueSnapshot()); });
    await executeReviewTransport({ action: "start", submissionId: 1 });
    const result = await executeReviewTransport({ action: "complete", submissionId: 1 });
    expect(result.next?.id).toBe(2);
    expect(received.at(-1).currentPlaying.id).toBe(2);
    expect(received.at(-1).submissions.find((row: any) => row.id === 1)).toMatchObject({ status: "reviewed", totalVoteCount: 4 });
    expect(received.at(-1).submissions.filter((row: any) => row.status === "pending")).toMatchObject([{ id: 3, position: 1 }]);
  });

  it("natural endings advance YouTube -> file -> YouTube in order and end with a clean stopped queue", async () => {
    await startReviewQueueTrack(1);
    for (const [completedId, nextId] of [[1, 2], [2, 3], [3, null]]) {
      const result = await executeReviewTransport({ action: "complete", submissionId: completedId! });
      expect(result.next?.id ?? null).toBe(nextId);
    }
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying).toBeNull();
    expect(snapshot.state?.livePlaybackState).toBe("stopped");
    expect(snapshot.submissions.every((row) => row.status === "reviewed")).toBe(true);
  });

  it("simultaneous skip/ended/cutoff for the old song promotes exactly one next track", async () => {
    await startReviewQueueTrack(1);
    const results = await Promise.all([1, 2, 3].map(() => executeReviewTransport({ action: "complete", submissionId: 1 })));
    expect(results.filter((result) => !result.stale)).toHaveLength(1);
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying?.id).toBe(2);
    expect(snapshot.submissions.find((row) => row.id === 2)?.status).toBe("playing");
  });

  it("rolls back a failed promotion so retry still has the original active song", async () => {
    await startReviewQueueTrack(1);
    const original = structuredClone(memory.tables);
    memory.failAt = memory.writes + 4;
    await expect(completeAndAdvanceReviewQueue(1)).rejects.toThrow("Injected database failure");
    expect(memory.tables).toEqual(original);
    memory.failAt = 0;
    expect((await completeAndAdvanceReviewQueue(1)).next?.id).toBe(2);
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
    await withReviewTransportLock(() => updateLiveReviewClock({ submissionId: 1, playbackState: "playing", startedAt: 100, positionMs: 88000 }));
    expect(memory.tables.queue_state[0]).toEqual(before);
    await updateLiveReviewClock({ submissionId: 2, playbackState: "paused", startedAt: before.livePlaybackStartedAt, positionMs: 12000 });
    expect(memory.tables.queue_state[0]).toMatchObject({ currentPlayingId: 2, livePlaybackPositionMs: 12000, livePlaybackState: "paused" });
  });

  it("keeps paid priority ordering and renumbers the normal waiting line from one", async () => {
    memory.tables.review_submissions.push(song(4));
    await startReviewQueueTrack(1);
    await confirmSkipPayment(4);
    const result = await completeAndAdvanceReviewQueue(1);
    expect(result.next?.id).toBe(4);
    const waiting = (await getReviewQueueSnapshot()).submissions.filter((row) => row.status === "pending");
    expect(waiting.map((row) => [row.id, row.position])).toEqual([[2, 1], [3, 2]]);
  });

  it("rejects loading a reviewed song and stopping returns only playing songs to pending", async () => {
    await startReviewQueueTrack(1);
    await completeAndAdvanceReviewQueue(1);
    await expect(startReviewQueueTrack(1)).rejects.toThrow("Requeue");
    await stopReviewQueuePlayback();
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying).toBeNull();
    expect(snapshot.submissions.find((row) => row.id === 1)?.status).toBe("reviewed");
    expect(snapshot.submissions.find((row) => row.id === 2)?.status).toBe("pending");
  });

  it("manually selecting another queued track finishes the old track instead of putting it back at number one", async () => {
    await executeReviewTransport({ action: "start", submissionId: 1 });
    await executeReviewTransport({ action: "start", submissionId: 3 });
    const snapshot = await getReviewQueueSnapshot();
    expect(snapshot.currentPlaying?.id).toBe(3);
    expect(snapshot.submissions.find((row) => row.id === 1)?.status).toBe("reviewed");
    expect(snapshot.submissions.filter((row) => row.status === "pending")).toMatchObject([{ id: 2, position: 1 }]);
  });

  it("holds an unpaid entry out of automatic playback until the administrator approves it", async () => {
    Object.assign(memory.tables.review_submissions[1], { isPaidSubmission: true, paidSubmissionConfirmed: false, paidSubmissionType: "reentry5" });
    await startReviewQueueTrack(1);
    await expect(startReviewQueueTrack(2)).rejects.toThrow("no longer in the active queue");
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
    expect(memory.tables.review_submissions.find((row) => row.id === 1).paidSubmissionConfirmed).toBe(true);
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
    await expect(reorderQueueSubmissions([1, 2, 3])).rejects.toThrow("queue has changed");
    expect((await getReviewQueueSnapshot()).currentPlaying?.id).toBe(1);
    await expect(reorderQueueSubmissions([2, 2])).rejects.toThrow("unique");
  });
});
