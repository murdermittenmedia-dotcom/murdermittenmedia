import { useEffect } from "react";
import { io } from "socket.io-client";
import { trpc } from "@/lib/trpc";

/** All review surfaces consume the same committed HTTP snapshot. Socket events
 * invalidate that snapshot; they never maintain a second, competing queue. */
export function useReviewQueue() {
  const utils = trpc.useUtils();
  const query = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });
  useEffect(() => {
    const socket = io(window.location.origin, { path: "/api/socket.io", query: { room: "music_review" } });
    const refresh = async () => {
      // Discard a poll started before a transition instead of accepting its old
      // track after the server has already promoted the next submission.
      await utils.queue.getAll.cancel();
      await utils.queue.getReviewed.cancel();
      void utils.queue.getAll.invalidate();
      void utils.queue.getReviewed.invalidate();
    };
    socket.on("connect", refresh);
    socket.on("review:queue_updated", refresh);
    socket.on("radio:playing", refresh);
    socket.on("radio:stopped", refresh);
    return () => { socket.disconnect(); };
  }, [utils]);
  return query;
}
