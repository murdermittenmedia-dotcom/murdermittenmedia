import { useEffect } from "react";
import { useSearch } from "wouter";
import { Flame, Trash2, ListMusic, History, Radio } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { selectReviewOverlayState, type OverlayTrack, type ReviewOverlayState } from "@shared/review-overlay";
import "./review-overlay.css";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export type ReviewOverlayLayout = "horizontal" | "vertical";
export function getReviewOverlayLayout(search: string): ReviewOverlayLayout {
  return new URLSearchParams(search).get("layout") === "horizontal" ? "horizontal" : "vertical";
}

function ArtistName({ track }: { track: OverlayTrack }) {
  return track.userId ? <a href={`/profile/${track.userId}`} target="_blank" rel="noopener noreferrer" className="review-overlay-artist">{track.artistName}</a> : <span className="review-overlay-artist">{track.artistName}</span>;
}

/** Exported display has no playback or administrative actions, even for admins. */
export function ReviewOverlayDisplay({ state, votes, loading = false, reconnecting = false, layout = "vertical" }: {
  state: ReviewOverlayState;
  votes?: { fire: number; trash: number };
  loading?: boolean;
  reconnecting?: boolean;
  layout?: ReviewOverlayLayout;
}) {
  const { current, next, previous, inLine, isLive } = state;
  const fire = current ? (votes?.fire ?? current.fireCount ?? 0) : 0;
  const trash = current ? (votes?.trash ?? current.trashCount ?? 0) : 0;
  const liveLabel = reconnecting ? "Reconnecting" : loading ? "Connecting" : isLive ? "Live review" : "Offline";
  return (
    <main className={`review-overlay-canvas review-overlay-layout-${layout}`} aria-label="Murder Mitten Media transparent review overlay">
      <div className="review-overlay-strip">
        <section className="review-overlay-panel review-overlay-now" aria-label="Current song and votes">
          <div className="review-overlay-brand">
            <img src={LOGO} alt="Murder Mitten Media" width="36" height="36" />
            <span>Murder Mitten <strong>Media</strong></span>
            <span className={`review-overlay-status ${isLive ? "is-live" : ""}`}><i />{liveLabel}</span>
          </div>
          <div className="review-overlay-label"><Radio aria-hidden="true" /> Now playing</div>
          <h1 className="review-overlay-title" title={current?.songTitle}>{current?.songTitle ?? (loading ? "Connecting to the review…" : isLive ? "Waiting for the next track" : "Review is offline")}</h1>
          <p className="review-overlay-byline">{current ? <ArtistName track={current} /> : <span>Music Review · Murder Mitten Media</span>}</p>
          <div className="review-overlay-votes" aria-label="Current song votes">
            <div className="review-overlay-vote is-fire"><Flame aria-hidden="true" /><span>Fire</span><strong data-testid="overlay-fire">{fire.toLocaleString()}</strong></div>
            <div className="review-overlay-vote is-trash"><Trash2 aria-hidden="true" /><span>Trash</span><strong data-testid="overlay-trash">{trash.toLocaleString()}</strong></div>
          </div>
        </section>

        <section className="review-overlay-panel review-overlay-queue" aria-label="Next three tracks">
          <header className="review-overlay-section-header"><div className="review-overlay-label"><ListMusic aria-hidden="true" /> Next up · 3 tracks</div><span className="review-overlay-count">{inLine} in line</span></header>
          <ol className="review-overlay-track-list">
            {next.map((track, index) => <li key={track.id}>
              <span className="review-overlay-position">{String(index + 1).padStart(2, "0")}</span>
              <div className="review-overlay-track-copy"><p title={track.songTitle}>{track.songTitle}</p><ArtistName track={track} /></div>
            </li>)}
            {next.length === 0 && <li className="review-overlay-empty">{loading ? "Loading the waiting line…" : "Queue is clear"}</li>}
          </ol>
        </section>

        <section className="review-overlay-panel review-overlay-previous" aria-label="Previously played track">
          <div className="review-overlay-label"><History aria-hidden="true" /> Previously queued</div>
          {previous ? <>
            <h2 title={previous.songTitle}>{previous.songTitle}</h2>
            <p className="review-overlay-byline"><ArtistName track={previous} /></p>
            <div className="review-overlay-final-votes"><span><Flame aria-hidden="true" />{(previous.fireCount ?? 0).toLocaleString()} fire</span><span><Trash2 aria-hidden="true" />{(previous.trashCount ?? 0).toLocaleString()} trash</span></div>
          </> : <p className="review-overlay-empty">{loading ? "Loading recent track…" : "No tracks played yet"}</p>}
        </section>
      </div>
    </main>
  );
}

export default function ReviewOverlay() {
  const layout = getReviewOverlayLayout(useSearch());
  const utils = trpc.useUtils();
  const queue = useReviewQueue();
  const history = trpc.queue.getReviewed.useQuery(undefined, {
    refetchInterval: 2_000, refetchIntervalInBackground: true, refetchOnReconnect: true, refetchOnWindowFocus: true,
  });
  const state = selectReviewOverlayState(queue.data, history.data);
  const votes = trpc.queue.getReactions.useQuery({ submissionId: state.current?.id ?? 0 }, {
    enabled: !!state.current, refetchInterval: 1_000, refetchIntervalInBackground: true, refetchOnReconnect: true,
  });

  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Review Overlay | Murder Mitten Media";
    return () => { document.title = oldTitle; };
  }, []);

  useEffect(() => {
    // Queue socket events invalidate history immediately. Keep votes fresh on a
    // new track too, never carrying the previous submission's counters forward.
    if (state.current) void utils.queue.getReactions.invalidate({ submissionId: state.current.id });
  }, [state.current?.id, utils]);

  return <ReviewOverlayDisplay state={state} votes={votes.data} loading={queue.isLoading} reconnecting={queue.isError || history.isError} layout={layout} />;
}
