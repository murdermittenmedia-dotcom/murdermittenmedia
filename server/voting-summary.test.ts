import { describe, expect, it } from "vitest";
import { summarizeVotes } from "@shared/voting";

describe("Music Wars vote summary", () => {
  it("keeps judge votes public while counting judge and audience votes equally", () => {
    const result = summarizeVotes([
      { candidate: "contestant1", voterRole: "judge", voterName: "Judge One" },
      { candidate: "contestant1", voterRole: "user", voterName: "Fan One" },
      { candidate: "contestant2", voterRole: "admin", voterName: "Murder Mitten" },
      { candidate: "contestant2", voterRole: "user", voterName: "Fan Two" },
    ]);

    expect(result).toMatchObject({
      contestant1: 2,
      contestant2: 2,
      total: 4,
      audienceContestant1: 1,
      audienceContestant2: 1,
    });
    expect(result.judgeVotes).toEqual([
      { name: "Judge One", role: "judge", candidate: "contestant1" },
      { name: "Murder Mitten", role: "admin", candidate: "contestant2" },
    ]);
  });
});
