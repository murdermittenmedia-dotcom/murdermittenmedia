import { describe, expect, it } from "vitest";
import { calculateReviewVerdict } from "../shared/review-verdict";

describe("Murder Mitten review verdict", () => {
  it("marks strong crowd approval as Certified Fire and keeps judge counts separate", () => {
    expect(calculateReviewVerdict({ crowdFire: 8, crowdTrash: 2, judgeFire: 2, judgeTrash: 0 })).toEqual({
      verdict: "Certified Fire", crowdFirePct: 80, crowdTrashPct: 20, totalVoteCount: 10,
    });
  });

  it("marks majority trash and an audience skip deterministically", () => {
    expect(calculateReviewVerdict({ crowdFire: 2, crowdTrash: 5, judgeFire: 0, judgeTrash: 1 })).toMatchObject({ verdict: "Trash", crowdFirePct: 29 });
    expect(calculateReviewVerdict({ crowdFire: 1, crowdTrash: 3, judgeFire: 0, judgeTrash: 1, skippedByVote: true })).toMatchObject({ verdict: "Skipped by audience", totalVoteCount: 4 });
  });
});

