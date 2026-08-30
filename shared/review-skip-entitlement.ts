export const STANDARD_DAILY_SKIP_VOTE_LIMIT = 5;

export function getUtcCalendarDayWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function hasUnlimitedReviewSkipAccess(role: string | null | undefined, reviewPlusActive: boolean) {
  return reviewPlusActive || role === "admin" || role === "judge";
}

export function getDailySkipVotesRemaining(votesUsed: number, unlimited: boolean) {
  return unlimited ? null : Math.max(0, STANDARD_DAILY_SKIP_VOTE_LIMIT - votesUsed);
}
