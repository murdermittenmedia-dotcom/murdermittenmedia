import { describe, expect, it } from "vitest";
import { aggregateSiteAnalytics } from "./site-analytics";

const NOW = new Date("2026-08-12T15:30:00.000Z");

function row(id: number, path: string, sessionId: string, createdAt: string, userId: number | null = null) {
  return { id, path, sessionId, userId, createdAt: new Date(createdAt) };
}

describe("aggregateSiteAnalytics", () => {
  it("aggregates current-day views by UTC hour and unique session", () => {
    const result = aggregateSiteAnalytics([
      row(1, "/", "a", "2026-08-12T01:05:00.000Z"),
      row(2, "/promo", "a", "2026-08-12T01:25:00.000Z"),
      row(3, "/", "b", "2026-08-12T14:00:00.000Z", 7),
    ], NOW);

    expect(result.uniqueSessionsToday).toBe(2);
    expect(result.hourlyToday).toEqual([
      { hour: 1, views: 2 },
      { hour: 14, views: 1 },
    ]);
  });

  it("aggregates 30-day daily views and seven-day top pages without SQL date functions", () => {
    const result = aggregateSiteAnalytics([
      row(1, "/", "a", "2026-08-11T12:00:00.000Z"),
      row(2, "/", "b", "2026-08-11T13:00:00.000Z"),
      row(3, "/promo", "c", "2026-08-10T13:00:00.000Z"),
      row(4, "/old", "d", "2026-07-01T13:00:00.000Z"),
    ], NOW);

    expect(result.topPages).toEqual([
      { path: "/", views: 2 },
      { path: "/promo", views: 1 },
    ]);
    expect(result.dailyMonth).toEqual([
      { day: "2026-08-10", views: 1 },
      { day: "2026-08-11", views: 2 },
    ]);
  });

  it("ignores malformed timestamps instead of breaking the dashboard", () => {
    const result = aggregateSiteAnalytics([
      row(1, "/", "a", "not-a-date"),
      row(2, "/", "b", "2026-08-12T10:00:00.000Z"),
    ], NOW);

    expect(result.uniqueSessionsToday).toBe(1);
    expect(result.hourlyToday).toEqual([{ hour: 10, views: 1 }]);
    expect(result.loggedInViews).toBe(0);
  });
});
