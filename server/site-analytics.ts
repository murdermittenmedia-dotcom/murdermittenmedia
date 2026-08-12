export type SiteAnalyticsView = {
  id: number;
  path: string;
  sessionId: string;
  userId: number | null;
  createdAt: Date;
};

export type SiteAnalyticsAggregates = {
  topPages: Array<{ path: string; views: number }>;
  hourlyToday: Array<{ hour: number; views: number }>;
  dailyMonth: Array<{ day: string; views: number }>;
  uniqueSessionsToday: number;
  totalUniqueSessions: number;
  loggedInViews: number;
};

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function aggregateSiteAnalytics(
  rows: SiteAnalyticsView[],
  now = new Date(),
): SiteAnalyticsAggregates {
  const validRows = rows
    .map((row) => ({ ...row, parsedCreatedAt: toDate(row.createdAt) }))
    .filter((row): row is typeof row & { parsedCreatedAt: Date } => Boolean(row.parsedCreatedAt));

  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const topPageCounts = new Map<string, number>();
  const hourlyCounts = new Map<number, number>();
  const dailyCounts = new Map<string, number>();
  const totalSessions = new Set<string>();
  const todaySessions = new Set<string>();
  let loggedInViews = 0;

  for (const row of validRows) {
    const createdAt = row.parsedCreatedAt;
    totalSessions.add(row.sessionId);
    if (row.userId !== null && row.userId !== undefined) loggedInViews += 1;

    if (createdAt >= todayStart) {
      todaySessions.add(row.sessionId);
      const hour = createdAt.getUTCHours();
      hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
    }

    if (createdAt >= monthStart) {
      const day = utcDayKey(createdAt);
      dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
    }

    if (createdAt >= weekStart) {
      topPageCounts.set(row.path, (topPageCounts.get(row.path) ?? 0) + 1);
    }
  }

  const topPages = Array.from(topPageCounts.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, 10);

  const hourlyToday = Array.from(hourlyCounts.entries())
    .map(([hour, views]) => ({ hour, views }))
    .sort((a, b) => a.hour - b.hour);

  const dailyMonth = Array.from(dailyCounts.entries())
    .map(([day, views]) => ({ day, views }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    topPages,
    hourlyToday,
    dailyMonth,
    uniqueSessionsToday: todaySessions.size,
    totalUniqueSessions: totalSessions.size,
    loggedInViews,
  };
}
