/** A fresh public review visit prompts once per mount; display-only OBS and
 * the controls-only admin window must never mount a submission popup. */
export function shouldOpenReviewSubmissionPrompt(pathname: string, search = "") {
  return pathname === "/review" && new URLSearchParams(search).get("mode") !== "broadcast";
}
