export type LinkAnalyticsDailyEvent = {
  eventType: "view" | "click" | "presence";
  createdAt: Date | string | number;
};

export type LinkAnalyticsDailyTotal = {
  date: string;
  views: number;
  clicks: number;
};

/**
 * Groups link analytics events by UTC calendar day without relying on database
 * date functions, which vary across MySQL-compatible deployments.
 */
export function aggregateLinkAnalyticsDaily(events: LinkAnalyticsDailyEvent[]): LinkAnalyticsDailyTotal[] {
  const dailyTotals = new Map<string, { views: number; clicks: number }>();

  for (const event of events) {
    const timestamp = event.createdAt instanceof Date
      ? event.createdAt
      : new Date(event.createdAt);

    if (Number.isNaN(timestamp.getTime())) continue;

    const date = timestamp.toISOString().slice(0, 10);
    const totals = dailyTotals.get(date) ?? { views: 0, clicks: 0 };

    if (event.eventType === "view") totals.views += 1;
    if (event.eventType === "click") totals.clicks += 1;

    dailyTotals.set(date, totals);
  }

  return Array.from(dailyTotals, ([date, totals]) => ({
    date,
    views: totals.views,
    clicks: totals.clicks,
  }));
}
