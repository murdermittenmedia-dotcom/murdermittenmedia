export type ReviewPaymentAccess = {
  isPaidSubmission?: boolean;
  paidSubmissionConfirmed?: boolean;
};

/** Paid entries wait for verification. Free tracks do not need payment approval. */
export function isReviewSubmissionEligible(song: ReviewPaymentAccess) {
  return !song.isPaidSubmission || song.paidSubmissionConfirmed === true;
}

/** The same existing approval flag grants a paid/free track a full-song review. */
export function hasApprovedFullSongAccess(song: ReviewPaymentAccess | null | undefined) {
  return song?.paidSubmissionConfirmed === true;
}
