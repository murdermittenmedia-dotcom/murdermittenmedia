import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import { REVIEW_TRACKING_POLL_MS, REVIEW_TRACKING_FRESH_MS, REVIEW_TRACKING_LABELS, isReviewTrackingSnapshotLive, type PrivateReviewTrackingItem, type PublicReviewTrackingItem, type ReviewTrackingMetadata } from "@shared/review-tracking";
import "./review-queue-v2.css";

export type ReviewTrackingItem = PrivateReviewTrackingItem;
const tracking = trpc.reviewTracking;
const refreshEvents = new Set(["song_started", "song_completed", "queue_changed", "submission_accepted", "studio_settings_changed"]);

export function useTrackingFreshness(updatedAt: number, failed: boolean, metadata?: ReviewTrackingMetadata | null) {
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    const change = () => { setOnline(navigator.onLine); setNow(Date.now()); };
    window.addEventListener("online", change); window.addEventListener("offline", change);
    return () => { window.clearInterval(tick); window.removeEventListener("online", change); window.removeEventListener("offline", change); };
  }, []);
  const fresh = online && !failed && updatedAt > 0 && now - updatedAt < REVIEW_TRACKING_FRESH_MS && (!metadata || (metadata.availability !== "unavailable" && now < metadata.expiresAtMs));
  return { online, fresh, liveFacts: isReviewTrackingSnapshotLive(metadata, now, fresh) };
}

function UpdateStatus({ loading, fresh, online, isLive, retry }: { loading: boolean; fresh: boolean; online: boolean; isLive?: boolean; retry: () => void }) {
  return <div className="review-v2-update" role="status" aria-live="polite">
    <span className={`review-v2-dot ${fresh && isLive ? "is-live" : ""}`} />
    <span>{loading ? "Connecting to the queue…" : !online ? "Offline — positions hidden" : !fresh ? "Reconnecting — positions hidden" : isLive === false ? "Session offline — positions paused" : "Auto-updating"}</span>
    {!fresh && !loading && <button type="button" onClick={retry} className="review-v2-icon-button" aria-label="Refresh queue"><RefreshCw size={15} /></button>}
  </div>;
}

function PublicQueueRow({ item, label, liveFacts }: { item: PublicReviewTrackingItem; label?: string; liveFacts: boolean }) {
  return <li className={`review-v2-row ${item.status === "now_reviewing" ? "is-current" : ""}`}>
    <div className="review-v2-position" aria-label={liveFacts && item.position != null ? item.positionLabel : undefined}>{liveFacts && item.position != null && item.position > 0 ? `#${item.position}` : <Clock3 size={18} aria-hidden="true" />}</div>
    <div className="review-v2-track"><p>{item.songTitle || "Private track"}</p><span>{item.artistName || "Artist"}</span></div>
    <span className="review-v2-state">{label ?? REVIEW_TRACKING_LABELS[item.status]}</span>
  </li>;
}

/** Public-safe HTTP snapshots are the only source of public order/positions. */
export function ReviewPublicQueue({ className = "" }: { className?: string }) {
  const utils = trpc.useUtils();
  const query = tracking.publicQueue.useQuery(undefined, { refetchInterval: REVIEW_TRACKING_POLL_MS, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 1 });
  const snapshot = query.data;
  const { fresh, online, liveFacts } = useTrackingFreshness(query.dataUpdatedAt, query.isError, snapshot);
  const refresh = useCallback(() => {
    const api = utils.reviewTracking;
    void api.publicQueue.cancel().then(() => api.publicQueue.invalidate());
  }, [utils]);
  useReviewLiveEvents((event) => { if (refreshEvents.has(event.type)) refresh(); });
  return <section id="public-review-queue" className={`review-v2-panel ${className}`} aria-labelledby="public-review-queue-title">
    <div className="review-v2-heading"><div><p className="review-v2-eyebrow">No sign-in needed</p><h3 id="public-review-queue-title">Live Review Queue</h3></div><UpdateStatus loading={query.isLoading} fresh={fresh} online={online} isLive={snapshot?.isLive} retry={() => void query.refetch()} /></div>
    <p className="review-v2-help">Order is set by the live review desk. Changes appear here automatically.</p>
    {query.isError && <p className="review-v2-notice" role="alert">Queue updates are unavailable. Any tracks below are the last received snapshot, not a live position.</p>}
    {snapshot && <>
      <ul className="review-v2-list">
        {snapshot.current && <PublicQueueRow item={snapshot.current} label={fresh ? "Now Reviewing" : "Last current track"} liveFacts={liveFacts} />}
        {snapshot.upNext && <PublicQueueRow item={snapshot.upNext} label={fresh ? "Up Next" : "Last next track"} liveFacts={liveFacts} />}
        {snapshot.waiting.map((item) => <PublicQueueRow key={item.key} item={item} label={fresh ? undefined : "Last known entry"} liveFacts={liveFacts} />)}
      </ul>
      {!snapshot.current && !snapshot.upNext && snapshot.waiting.length === 0 && <p className="review-v2-empty">{fresh ? "The queue is clear. Submit your music to join the next review." : "Waiting for a fresh queue update."}</p>}
      {!!snapshot.recent.length && <details className="review-v2-recent"><summary>Recently finished</summary><ul className="review-v2-list">{snapshot.recent.map((item) => <PublicQueueRow key={item.key} item={item} label={!fresh ? `Last known: ${item.label}` : undefined} liveFacts={false} />)}</ul></details>}
    </>}
    {!snapshot && !query.isLoading && <p className="review-v2-empty">Queue unavailable. Please retry when your connection returns.</p>}
  </section>;
}

export function ReviewTrackingCard({ item, liveFacts, stale = false, children }: { item: ReviewTrackingItem; liveFacts: boolean; stale?: boolean; children?: ReactNode }) {
  const terminal = ["completed", "skipped", "removed"].includes(item.status);
  const awaitingApproval = !terminal && item.queueEligibilityReason === "awaiting_payment_confirmation";
  return <article className="review-v2-personal-card">
    <div className="review-v2-heading"><div className="review-v2-track"><p>{item.songTitle}</p><span>{item.artistName}</span></div><span className="review-v2-state">{stale ? "Last known: " : ""}{awaitingApproval ? "Awaiting approval" : REVIEW_TRACKING_LABELS[item.status]}</span></div>
    {!terminal && <div className="review-v2-facts" aria-live="polite">
      <div><span>Queue position</span><strong>{liveFacts && item.position != null ? item.position === 0 ? "Now" : `#${item.position}` : "—"}</strong></div>
      <div><span>Songs in front of you</span><strong>{liveFacts && item.numberAhead != null ? item.numberAhead : "—"}</strong></div>
    </div>}
    {terminal && <p className="review-v2-help">{item.status === "removed" ? "This submission is no longer in the review queue." : item.status === "skipped" ? "This review was skipped. It has no active queue position." : "This review is complete. It has no active queue position."}</p>}
    {!terminal && !item.queueEligible && <p className="review-v2-notice">{item.queueEligibilityReason === "awaiting_payment_confirmation" ? "Awaiting payment confirmation. This track has no active queue position yet." : "This track is not currently eligible for the active queue. Paid-only or review desk controls may apply."}</p>}
    {!terminal && item.queueEligible && !liveFacts && <p className="review-v2-help">Position will appear when fresh live queue information is available.</p>}
    {children}
  </article>;
}

/** Browser/account ownership is checked by the server, never by a public ID. */
export function ReviewQueueTracker({ submissionId, className = "", showEmpty = true, renderSubmissionAction }: { submissionId?: number | null; className?: string; showEmpty?: boolean; renderSubmissionAction?: (item: ReviewTrackingItem) => ReactNode }) {
  const utils = trpc.useUtils();
  const query = tracking.mine.useQuery(undefined, { refetchInterval: REVIEW_TRACKING_POLL_MS, refetchOnMount: "always", refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 1 });
  const snapshot = query.data;
  const { fresh, online, liveFacts } = useTrackingFreshness(query.dataUpdatedAt, query.isError, snapshot);
  const refresh = useCallback(() => {
    const api = utils.reviewTracking;
    void api.mine.cancel().then(() => api.mine.invalidate());
  }, [utils]);
  useReviewLiveEvents((event) => { if (refreshEvents.has(event.type)) refresh(); });
  useEffect(() => { if (submissionId) refresh(); }, [submissionId, refresh]);
  const active = snapshot?.submissions.filter(item => !["completed", "skipped", "removed"].includes(item.status)) ?? [];
  const recent = snapshot?.submissions.filter(item => ["completed", "skipped", "removed"].includes(item.status)).slice(0, 3) ?? [];
  if (!showEmpty && !query.isError && !query.isLoading && !active.length && !recent.length) return null;
  return <section id="my-review-submissions" className={`review-v2-panel ${className}`} aria-labelledby="my-review-submissions-title">
    <div className="review-v2-heading"><div><p className="review-v2-eyebrow"><ShieldCheck size={13} /> Private to you</p><h3 id="my-review-submissions-title">My Submission{(snapshot?.submissions.length ?? 0) > 1 ? "s" : ""}</h3></div><UpdateStatus loading={query.isLoading} fresh={fresh} online={online} isLive={snapshot?.isLive} retry={() => void query.refetch()} /></div>
    <p className="review-v2-help">Your songs and place in line appear here automatically whenever you return to this review page. No tracking link or extra setup is needed.</p>
    {query.isError && <p className="review-v2-notice" role="alert">Private tracking is temporarily unavailable. Positions are hidden until updates reconnect.</p>}
    <div className="review-v2-personal-list">{active.map((item) => <ReviewTrackingCard key={item.key} item={item} stale={!fresh} liveFacts={liveFacts}>{renderSubmissionAction?.(item)}</ReviewTrackingCard>)}</div>
    {!!recent.length && <details className="review-v2-recent"><summary>Your recent results</summary><div className="review-v2-personal-list">{recent.map(item => <ReviewTrackingCard key={item.key} item={item} stale={!fresh} liveFacts={false} />)}</div></details>}
    {fresh && !snapshot?.submissions.length && <p className="review-v2-empty">{submissionId ? "Your new submission is being added to tracking. This panel will update automatically." : "Submit a track and your position will appear here automatically. Return in this browser, or sign in to the same account on another device."}</p>}
  </section>;
}
