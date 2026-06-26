/**
 * useLiveStatus — shared hook that exposes live status for Music Review, Music Wars, and Cook Up streams.
 * Polls all endpoints every 30s so the nav badges and banners stay up to date.
 */
import { trpc } from "@/lib/trpc";

export function useLiveStatus() {
  const { data: queueData } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: eventData } = trpc.events.getNext.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: cookUpStreams } = trpc.live.list.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const reviewIsLive = queueData?.state?.isLive ?? false;
  const reviewStreamUrl = queueData?.state?.streamUrl ?? null;
  const warsIsLive = eventData?.isLive ?? false;
  const warsStreamUrl = eventData?.streamUrl ?? null;
  const activeCookUpStreams = cookUpStreams ?? [];
  const cookUpIsLive = activeCookUpStreams.length > 0;
  const anyLive = reviewIsLive || warsIsLive || cookUpIsLive;

  return {
    reviewIsLive,
    reviewStreamUrl,
    warsIsLive,
    warsStreamUrl,
    cookUpIsLive,
    activeCookUpStreams,
    anyLive,
  };
}
