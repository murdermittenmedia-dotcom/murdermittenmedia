import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { REVIEW_STUDIO_DEFAULTS, type ReviewLiveEvent } from "@shared/review-studio";

let sharedSocket: Socket | undefined;
let consumers = 0;
function acquireSocket() {
  if (!sharedSocket) sharedSocket = io(window.location.origin, { path: "/api/socket.io", query: { room: "music_review" } });
  consumers++;
  return sharedSocket;
}
function releaseSocket() { if (--consumers === 0) { sharedSocket?.disconnect(); sharedSocket = undefined; } }

/** Socket delivery is fast; a durable sequence feed repairs reconnect gaps.
 * Stable event IDs suppress only repeat delivery, not separate votes or gifts. */
export function useReviewLiveEvents(onEvent?: (event: ReviewLiveEvent) => void) {
  const utils = trpc.useUtils();
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [events, setEvents] = useState<ReviewLiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const callback = useRef(onEvent); callback.current = onEvent;
  const seen = useRef(new Set<string>());
  const receive = useRef((event: ReviewLiveEvent) => {
    if (seen.current.has(event.id)) return;
    seen.current.add(event.id);
    if (seen.current.size > 5000) seen.current.delete(seen.current.values().next().value!);
    setEvents((items) => [...items.slice(-199), event]);
    callback.current?.(event);
    if (event.type === "admin_votes_added") {
      void utils.queue.getAll.invalidate();
      void utils.queue.getReviewed.invalidate();
      if (event.submissionId) void utils.queue.getReactions.invalidate({ submissionId: event.submissionId });
    }
    if (event.type === "studio_settings_changed") void utils.reviewStudio.settings.invalidate();
    if (["song_started", "song_completed", "queue_changed", "submission_accepted"].includes(event.type)) {
      void utils.queue.getAll.invalidate(); void utils.queue.getReviewed.invalidate();
    }
    if (["valid_vote_recorded", "vote_changed", "song_started"].includes(event.type) && event.submissionId) {
      void utils.queue.getReactions.invalidate({ submissionId: event.submissionId });
      void utils.queue.getMyReaction.invalidate({ submissionId: event.submissionId });
    }
  });
  const settings = trpc.reviewStudio.settings.useQuery(undefined, { refetchInterval: 15_000, refetchIntervalInBackground: true, refetchOnReconnect: true });
  const feed = trpc.reviewStudio.events.useQuery({ after: cursor }, { refetchInterval: 1000, refetchIntervalInBackground: true, refetchOnReconnect: true });
  useEffect(() => {
    if (!feed.data) return;
    if (cursor === undefined) { setCursor(feed.data.latestSequence); return; }
    for (const event of feed.data.events) receive.current(event);
    const last = feed.data.events[feed.data.events.length - 1];
    if (last && last.sequence > cursor) setCursor(last.sequence);
  }, [feed.data, cursor]);
  useEffect(() => {
    const socket = acquireSocket();
    const connect = () => { setConnected(true); void utils.reviewStudio.events.invalidate(); void utils.reviewStudio.settings.invalidate(); };
    const disconnect = () => setConnected(false);
    const live = (event: ReviewLiveEvent) => { receive.current(event); void utils.reviewStudio.events.invalidate(); };
    socket.on("connect", connect); socket.on("disconnect", disconnect); socket.on("review:live_event", live);
    setConnected(socket.connected);
    return () => { socket.off("connect", connect); socket.off("disconnect", disconnect); socket.off("review:live_event", live); releaseSocket(); };
  }, [utils]);
  return { events, connected, settings: settings.data ?? REVIEW_STUDIO_DEFAULTS, occurrenceId: feed.data?.occurrenceId ?? null, isLoading: feed.isLoading, isError: feed.isError };
}
