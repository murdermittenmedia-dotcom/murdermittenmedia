/**
 * Guards the server's single authoritative review-track transition.
 * A completion signal must name the active submission so an old player event
 * cannot accidentally complete the next track after the queue has advanced.
 */
export function shouldProcessReviewTrackEnd(
  currentSubmissionId: number | null,
  eventSubmissionId: number | undefined,
  inFlightSubmissionId: number | null,
): boolean {
  return currentSubmissionId !== null
    && eventSubmissionId === currentSubmissionId
    && inFlightSubmissionId !== currentSubmissionId;
}
