import { describe, expect, it } from "vitest";
import { aggregateLinkAnalyticsDaily } from "./link-analytics";

describe("link analytics daily aggregation", () => {
  it("groups views and clicks by UTC calendar day", () => {
    expect(aggregateLinkAnalyticsDaily([
      { eventType: "view", createdAt: "2026-07-13T23:59:00.000Z" },
      { eventType: "click", createdAt: "2026-07-14T00:01:00.000Z" },
      { eventType: "view", createdAt: "2026-07-14T04:00:00.000Z" },
      { eventType: "presence", createdAt: "2026-07-14T05:00:00.000Z" },
    ])).toEqual([
      { date: "2026-07-13", views: 1, clicks: 0 },
      { date: "2026-07-14", views: 1, clicks: 1 },
    ]);
  });

  it("skips invalid timestamps without breaking the analytics response", () => {
    expect(aggregateLinkAnalyticsDaily([
      { eventType: "view", createdAt: "not-a-date" },
      { eventType: "click", createdAt: new Date("2026-07-14T12:00:00.000Z") },
    ])).toEqual([
      { date: "2026-07-14", views: 0, clicks: 1 },
    ]);
  });
});
