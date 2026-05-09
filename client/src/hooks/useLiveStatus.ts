/**
 * useLiveStatus — shared hook that exposes live status for Music Review and Music Wars.
 * Polls both endpoints every 30s so the nav badges and banners stay up to date.
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

  const reviewIsLive = queueData?.state?.isLive ?? false;
  const reviewStreamUrl = queueData?.state?.streamUrl ?? null;
  const warsIsLive = eventData?.isLive ?? false;
  const warsStreamUrl = eventData?.streamUrl ?? null;

  const anyLive = reviewIsLive || warsIsLive;

  return {
    reviewIsLive,
    reviewStreamUrl,
    warsIsLive,
    warsStreamUrl,
    anyLive,
  };
}
