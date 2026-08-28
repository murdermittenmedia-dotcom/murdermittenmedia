export type VoteForSummary = {
  candidate: "contestant1" | "contestant2" | "contestant3";
  voterRole: string;
  voterName?: string | null;
};

export function summarizeVotes(votes: VoteForSummary[]) {
  let contestant1 = 0;
  let contestant2 = 0;
  let contestant3 = 0;
  let audienceContestant1 = 0;
  let audienceContestant2 = 0;
  let audienceContestant3 = 0;
  const judgeVotes: Array<{ name: string; role: string; candidate: string }> = [];

  for (const vote of votes) {
    const isJudge = vote.voterRole === "judge" || vote.voterRole === "admin";
    if (vote.candidate === "contestant1") { contestant1++; if (!isJudge) audienceContestant1++; }
    else if (vote.candidate === "contestant2") { contestant2++; if (!isJudge) audienceContestant2++; }
    else { contestant3++; if (!isJudge) audienceContestant3++; }
    if (isJudge) judgeVotes.push({ name: vote.voterName ?? "Judge", role: vote.voterRole, candidate: vote.candidate });
  }

  return {
    contestant1,
    contestant2,
    contestant3,
    total: votes.length,
    judgeVotes,
    audienceContestant1,
    audienceContestant2,
    audienceContestant3,
  };
}
