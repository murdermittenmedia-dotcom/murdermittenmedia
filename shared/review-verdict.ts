export type ReviewVerdictInput = {
  crowdFire: number;
  crowdTrash: number;
  judgeFire: number;
  judgeTrash: number;
  skippedByVote?: boolean;
};

export function calculateReviewVerdict(input: ReviewVerdictInput) {
  const totalVoteCount = input.crowdFire + input.crowdTrash;
  const crowdFirePct = totalVoteCount === 0 ? 0 : Math.round((input.crowdFire / totalVoteCount) * 100);
  const crowdTrashPct = totalVoteCount === 0 ? 0 : 100 - crowdFirePct;
  const verdict = input.skippedByVote
    ? "Skipped by audience"
    : totalVoteCount === 0
      ? "No crowd verdict"
      : crowdFirePct >= 80
        ? "Certified Fire"
        : input.crowdFire > input.crowdTrash
          ? "Fire"
          : "Trash";
  return { verdict, crowdFirePct, crowdTrashPct, totalVoteCount };
}
