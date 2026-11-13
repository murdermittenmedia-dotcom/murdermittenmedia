import { completeAndAdvanceReviewQueue, startReviewQueueTrack, stopReviewQueuePlayback } from "./db";

export type ReviewTransportCommand =
  | { action: "start"; submissionId: number }
  | { action: "complete"; submissionId: number; skippedByVote?: boolean }
  | { action: "stop" };

type Publisher = () => Promise<void>;
let publisher: Publisher | undefined;
let pending: Promise<unknown> = Promise.resolve();

/** Commands and YouTube clock writes use the same lock. An old tick must never
 * write its old submission ID back over a completed/newly-promoted track. */
export function withReviewTransportLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

export function setReviewTransportPublisher(next: Publisher) {
  publisher = next;
}

/** Database commit, clock adoption, and broadcast are one server-owned operation.
 * Clients must not issue a separate stop/load after this operation. */
export function executeReviewTransport(command: ReviewTransportCommand) {
  return withReviewTransportLock(async () => {
    let result: Awaited<ReturnType<typeof completeAndAdvanceReviewQueue>>;
    if (command.action === "complete") {
      result = await completeAndAdvanceReviewQueue(command.submissionId, { skippedByVote: command.skippedByVote });
    } else if (command.action === "start") {
      const next = await startReviewQueueTrack(command.submissionId);
      result = { stale: false, next };
    } else {
      await stopReviewQueuePlayback();
      result = { stale: false, next: null };
    }
    // Even a stale duplicate refreshes all windows from the committed cursor.
    await publisher?.();
    return result;
  });
}

/** Live queue metadata updates publish after commit without reloading the song. */
export function mutateReviewQueue<T>(operation: () => Promise<T>) {
  return withReviewTransportLock(async () => {
    const result = await operation();
    await publisher?.();
    return result;
  });
}
