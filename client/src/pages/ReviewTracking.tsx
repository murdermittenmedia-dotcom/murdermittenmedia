import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { ReviewQueueTracker, ReviewTrackingCard, useTrackingFreshness } from "@/components/ReviewQueueTracker";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import { trpc } from "@/lib/trpc";
import { REVIEW_TRACKING_POLL_MS, type ResolvedReviewTrackingSnapshot } from "@shared/review-tracking";

type PrivateSnapshot = ResolvedReviewTrackingSnapshot;

function takeFragment() {
  if (typeof window === "undefined") return "";
  const privateWindow = window as Window & { __reviewTrackingToken?: string };
  const fragment = privateWindow.__reviewTrackingToken ?? window.location.hash.slice(1);
  delete privateWindow.__reviewTrackingToken;
  // Strip before any child mounts or request is made. A token never becomes a
  // query, rendered link, analytics label, browser storage value, or GET input.
  if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  try {
    const token = decodeURIComponent(fragment);
    return /^rt1_[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
  } catch { return ""; }
}

export default function ReviewTracking() {
  const [token] = useState(takeFragment);
  const utils = trpc.useUtils();
  const [snapshot, setSnapshot] = useState<PrivateSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const { fresh, online, liveFacts } = useTrackingFreshness(updatedAt, failed, snapshot);
  const refresh = useCallback(async () => {
    if (!token || inFlight.current || !navigator.onLine) return;
    inFlight.current = true;
    try {
      // The imperative POST mutation deliberately bypasses query/mutation
      // caches and their global error log subscribers for bearer credentials.
      const result = await utils.client.reviewTracking.resolve.mutate({ token });
      if (mounted.current) { setSnapshot(result); setUpdatedAt(Date.now()); setFailed(false); }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [token, utils]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), REVIEW_TRACKING_POLL_MS);
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener("online", reconnect); window.removeEventListener("focus", reconnect); };
  }, [refresh]);
  useReviewLiveEvents((event) => { if (["song_started", "song_completed", "queue_changed", "submission_accepted"].includes(event.type)) void refresh(); });
  return <div className="review-v2-private-page min-h-screen bg-[#080808] text-white">
    <SiteNav />
    <main className="review-v2-private-main">
      <div className="review-v2-heading"><div><p className="review-v2-eyebrow"><LockKeyhole size={14} /> Private tracking</p><h1>My Submission</h1></div><a href="/review" className="review-v2-button">Back to review</a></div>
      <p className="review-v2-help">Your tracking credential is removed from the address bar and used only for secure tracking requests. Do not share your private link publicly.</p>
      {!token ? <>
        <ReviewQueueTracker />
        <p className="review-v2-notice">Your submissions also appear automatically on the main review page in this browser or when signed into your account.</p>
      </> : <section className="review-v2-panel">
        <div className="review-v2-update" role="status" aria-live="polite"><span className={`review-v2-dot ${fresh && snapshot?.isLive !== false ? "is-live" : ""}`} /><span>{loading ? "Opening your private submission…" : !online ? "Offline — positions hidden" : !fresh ? "Reconnecting — positions hidden" : snapshot?.isLive === false ? "Session offline — positions paused" : "Auto-updating"}</span>{!fresh && !loading && <button type="button" className="review-v2-icon-button" onClick={() => void refresh()} aria-label="Retry private tracking"><RefreshCw size={16} /></button>}</div>
        {failed && <p className="review-v2-notice" role="alert">Unable to refresh this private submission. Check your connection and retry. Return to the main review page in your original browser or account to see your submissions automatically.</p>}
        {snapshot && <ReviewTrackingCard item={snapshot.submission} stale={!fresh} liveFacts={liveFacts} />}
        {!snapshot && !loading && !failed && <p className="review-v2-empty">Waiting for a secure tracking update.</p>}
      </section>}
    </main>
  </div>;
}
