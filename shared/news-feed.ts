export const NEWS_FALLBACK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function selectNewsPosts<T extends { timestamp: string }>(
  livePosts: T[] | null | undefined,
  fallbackPosts: T[],
  now = Date.now(),
  maxFallbackAgeMs = NEWS_FALLBACK_MAX_AGE_MS,
): T[] {
  if (livePosts && livePosts.length > 0) return livePosts;

  return fallbackPosts.filter((post) => {
    const timestamp = new Date(post.timestamp).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= maxFallbackAgeMs;
  });
}
