import { describe, expect, it } from "vitest";
import { selectNewsPosts } from "@shared/news-feed";

type TestPost = { id: string; timestamp: string };

describe("Latest News post selection", () => {
  const now = Date.parse("2026-08-28T00:00:00Z");

  it("always prefers non-empty live posts", () => {
    const live: TestPost[] = [{ id: "live-1", timestamp: "2026-08-27T12:00:00Z" }];
    const fallback: TestPost[] = [{ id: "fallback-1", timestamp: "2026-08-27T12:00:00Z" }];

    expect(selectNewsPosts(live, fallback, now)).toEqual(live);
  });

  it("removes fallback posts older than the freshness window", () => {
    const fallback: TestPost[] = [
      { id: "recent", timestamp: "2026-08-10T12:00:00Z" },
      { id: "stale", timestamp: "2026-06-20T12:00:00Z" },
    ];

    expect(selectNewsPosts([], fallback, now).map((post) => post.id)).toEqual(["recent"]);
  });

  it("drops invalid fallback timestamps instead of presenting them", () => {
    const fallback: TestPost[] = [{ id: "invalid", timestamp: "not-a-date" }];

    expect(selectNewsPosts(undefined, fallback, now)).toEqual([]);
  });
});
