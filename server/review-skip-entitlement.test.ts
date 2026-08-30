import { describe, expect, it } from "vitest";
import { STANDARD_DAILY_SKIP_VOTE_LIMIT, getDailySkipVotesRemaining, getUtcCalendarDayWindow, hasUnlimitedReviewSkipAccess } from "../shared/review-skip-entitlement";

describe("Review Vote To Skip entitlement", () => {
  it("enforces five standard votes per calendar day", () => {
    expect(STANDARD_DAILY_SKIP_VOTE_LIMIT).toBe(5);
    expect(getDailySkipVotesRemaining(0, false)).toBe(5);
    expect(getDailySkipVotesRemaining(4, false)).toBe(1);
    expect(getDailySkipVotesRemaining(5, false)).toBe(0);
  });

  it("gives judges, admins, and active Review+ members unlimited access", () => {
    expect(hasUnlimitedReviewSkipAccess("judge", false)).toBe(true);
    expect(hasUnlimitedReviewSkipAccess("admin", false)).toBe(true);
    expect(hasUnlimitedReviewSkipAccess("user", true)).toBe(true);
    expect(hasUnlimitedReviewSkipAccess("user", false)).toBe(false);
    expect(getDailySkipVotesRemaining(999, true)).toBeNull();
  });

  it("uses one deterministic UTC calendar-day window", () => {
    const { start, end } = getUtcCalendarDayWindow(new Date("2026-08-30T15:12:00.000Z"));
    expect(start.toISOString()).toBe("2026-08-30T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
});

