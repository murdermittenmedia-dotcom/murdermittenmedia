import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Flame, Trash2, ListMusic, History, Radio, Music2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useReviewQueue } from "@/hooks/useReviewQueue";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import {
  selectReviewOverlayState,
  type OverlayTrack,
  type ReviewOverlayState,
} from "@shared/review-overlay";
import {
  REVIEW_SOURCE_PATHS,
  reviewActivityText,
  type ReviewLiveEvent,
} from "@shared/review-studio";
import "./review-overlay.css?studio=v1";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
export const REVIEW_OVERLAY_ACTIVITY_MS = 5_000;
export type ReviewOverlaySource =
  | "now"
  | "queue"
  | "previous"
  | "header"
  | "submissions";
export type ReviewOverlayLayout = "horizontal" | "vertical";

export function getReviewOverlayLayout(search: string): ReviewOverlayLayout {
  return new URLSearchParams(search).get("layout") === "horizontal"
    ? "horizontal"
    : "vertical";
}

export function getReviewOverlaySource(
  path: string
): ReviewOverlaySource | null {
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, "");
  return (
    (["now", "queue", "previous", "header", "submissions"] as const).find(
      source => REVIEW_SOURCE_PATHS[source] === pathname
    ) ?? null
  );
}

/** No joins, likes, chat, gifts, or synthetic activity can enter a visual queue. */
export function isReviewOverlayActivity(
  event: ReviewLiveEvent,
  source: ReviewOverlaySource | null
) {
  if (source !== "header" && source !== "submissions") return false;
  if (source === "submissions" && event.type !== "submission_accepted")
    return false;
  return reviewActivityText(event) !== null;
}

function useOverlayActivity(source: ReviewOverlaySource | null) {
  const [pending, setPending] = useState<ReviewLiveEvent[]>([]);
  const seen = useRef(new Set<string>());
  const alertsEnabled = useRef(true);
  const utils = trpc.useUtils();
  // Consume each delivery directly, rather than mapping a bounded event-history
  // array: even a large simultaneous burst gets its own full five-second slot.
  const live = useReviewLiveEvents(event => {
    if (seen.current.has(event.id)) return;
    seen.current.add(event.id);
    if (source === "previous" && event.type === "song_completed")
      void utils.reviewStudio.previous.invalidate();
    if (!isReviewOverlayActivity(event, source)) return;
    if (source === "submissions" && !alertsEnabled.current) return;
    setPending(queue => [...queue, event]);
  });
  alertsEnabled.current = live.settings.submissionAlertsEnabled;
  const enabled =
    source !== "submissions" || live.settings.submissionAlertsEnabled;
  const activity = enabled ? pending[0] : undefined;

  useEffect(() => {
    if (!activity) return;
    const timer = window.setTimeout(
      () => setPending(queue => queue.slice(1)),
      REVIEW_OVERLAY_ACTIVITY_MS
    );
    return () => window.clearTimeout(timer);
  }, [activity?.id]);

  useEffect(() => {
    setPending([]);
  }, [source, enabled]);

  return { ...live, activity };
}

function ArtistName({ track }: { track: OverlayTrack }) {
  return track.userId ? (
    <a
      href={`/profile/${track.userId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="review-overlay-artist"
    >
      {track.artistName}
    </a>
  ) : (
    <span className="review-overlay-artist">{track.artistName}</span>
  );
}

type DisplayProps = {
  state: ReviewOverlayState;
  votes?: { fire: number; trash: number };
  loading?: boolean;
  reconnecting?: boolean;
  layout?: ReviewOverlayLayout;
  source?: ReviewOverlaySource | null;
  activity?: ReviewLiveEvent;
  submissionAlertsEnabled?: boolean;
};

function NowPlaying({ state, votes, loading, reconnecting }: DisplayProps) {
  const { current, isLive } = state;
  const fire = current ? (votes?.fire ?? current.fireCount ?? 0) : 0;
  const trash = current ? (votes?.trash ?? current.trashCount ?? 0) : 0;
  const liveLabel = reconnecting
    ? "Reconnecting"
    : loading
      ? "Connecting"
      : isLive
        ? "Live review"
        : "Offline";
  return (
    <section
      className="review-overlay-panel review-overlay-now"
      aria-label="Current song and votes"
    >
      <div className="review-overlay-brand">
        <img src={LOGO} alt="Murder Mitten Media" width="36" height="36" />
        <span>
          Murder Mitten <strong>Media</strong>
        </span>
        <span className={`review-overlay-status ${isLive ? "is-live" : ""}`}>
          <i />
          {liveLabel}
        </span>
      </div>
      <div className="review-overlay-label">
        <Radio aria-hidden="true" /> Now playing
      </div>
      <h1 className="review-overlay-title" title={current?.songTitle}>
        {current?.songTitle ??
          (loading
            ? "Connecting to the review…"
            : isLive
              ? "Waiting for the next track"
              : "Review is offline")}
      </h1>
      <p className="review-overlay-byline">
        {current ? (
          <ArtistName track={current} />
        ) : (
          <span>Music Review · Murder Mitten Media</span>
        )}
      </p>
      <div className="review-overlay-votes" aria-label="Current song votes">
        <div className="review-overlay-vote is-fire">
          <Flame aria-hidden="true" />
          <span>Fire</span>
          <strong data-testid="overlay-fire">{fire.toLocaleString()}</strong>
        </div>
        <div className="review-overlay-vote is-trash">
          <Trash2 aria-hidden="true" />
          <span>Trash</span>
          <strong data-testid="overlay-trash">{trash.toLocaleString()}</strong>
        </div>
      </div>
    </section>
  );
}

function NextQueue({ state, loading }: DisplayProps) {
  return (
    <section
      className="review-overlay-panel review-overlay-queue"
      aria-label="Next three tracks"
    >
      <header className="review-overlay-section-header">
        <div className="review-overlay-label">
          <ListMusic aria-hidden="true" /> Next up · 3 tracks
        </div>
        <span className="review-overlay-count">{state.inLine} in line</span>
      </header>
      <ol className="review-overlay-track-list">
        {state.next.map((track, index) => (
          <li key={track.id}>
            <span className="review-overlay-position">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="review-overlay-track-copy">
              <p title={track.songTitle}>{track.songTitle}</p>
              <ArtistName track={track} />
            </div>
          </li>
        ))}
        {state.next.length === 0 && (
          <li className="review-overlay-empty">
            {loading ? "Loading the waiting line…" : "Queue is clear"}
          </li>
        )}
      </ol>
    </section>
  );
}

function PreviousSong({
  state,
  loading,
  legacy = false,
}: DisplayProps & { legacy?: boolean }) {
  const { previous } = state;
  return (
    <section
      className="review-overlay-panel review-overlay-previous"
      aria-label="Previously played track"
    >
      <div className="review-overlay-label">
        <History aria-hidden="true" />{" "}
        {legacy ? "Previously queued" : "PREVIOUSLY PLAYED"}
      </div>
      {previous ? (
        <>
          <h2 title={previous.songTitle}>{previous.songTitle}</h2>
          <p className="review-overlay-byline">
            <ArtistName track={previous} />
          </p>
        </>
      ) : (
        <p className="review-overlay-empty">
          {loading ? "Loading recent track…" : "No tracks played yet"}
        </p>
      )}
    </section>
  );
}

function InteractiveHeader({ activity }: { activity?: ReviewLiveEvent }) {
  const text = activity ? reviewActivityText(activity) : null;
  return (
    <section
      className="review-overlay-panel review-overlay-now review-overlay-header"
      aria-label="Live music review show header"
    >
      <div className="review-overlay-header-main">
        <img src={LOGO} alt="Murder Mitten Media" width="60" height="60" />
        <div className="review-overlay-header-copy">
          <h1>LIVE MUSIC REVIEWS</h1>
          <p>HOSTED BY YLG TWON</p>
        </div>
      </div>
      <p className="review-overlay-header-cta">
        SUBMIT YOUR SONG — LINK IN BIO
      </p>
      <div
        className="review-overlay-activity"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          key={activity?.id ?? "idle"}
          className={text ? "review-overlay-activity-message" : ""}
          title={text ?? undefined}
        >
          {text ?? "🔥 FIRE OR 🗑️ TRASH? CAST YOUR VOTE!"}
        </span>
      </div>
    </section>
  );
}

function SubmissionAlert({
  activity,
  enabled,
}: {
  activity?: ReviewLiveEvent;
  enabled: boolean;
}) {
  if (
    !enabled ||
    !activity ||
    activity.type !== "submission_accepted" ||
    !reviewActivityText(activity)
  )
    return null;
  return (
    <section
      key={activity.id}
      className="review-overlay-panel review-overlay-now review-overlay-submission-alert"
      aria-label="Accepted song submission"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="review-overlay-label">
        <Music2 aria-hidden="true" /> New song submitted
      </div>
      <h2 title={activity.songTitle}>
        {activity.songTitle ?? "Song submitted"}
      </h2>
      <p className="review-overlay-byline" title={activity.actor}>
        {activity.actor}
        {activity.artistName && activity.artistName !== activity.actor
          ? ` · ${activity.artistName}`
          : ""}
      </p>
    </section>
  );
}

/** Every source is display-only. No player, audio, or administrative actions. */
export function ReviewOverlayDisplay({
  layout = "vertical",
  source = null,
  submissionAlertsEnabled = true,
  ...props
}: DisplayProps) {
  const classes = source
    ? `review-overlay-source review-overlay-source-${source}`
    : `review-overlay-layout-${layout}`;
  return (
    <main
      className={`review-overlay-canvas ${classes}`}
      aria-label="Murder Mitten Media transparent review overlay"
    >
      <div className="review-overlay-strip">
        {(!source || source === "now") && <NowPlaying {...props} />}
        {(!source || source === "queue") && <NextQueue {...props} />}
        {(!source || source === "previous") && (
          <PreviousSong {...props} legacy={!source} />
        )}
        {source === "header" && <InteractiveHeader activity={props.activity} />}
        {source === "submissions" && (
          <SubmissionAlert
            activity={props.activity}
            enabled={submissionAlertsEnabled}
          />
        )}
      </div>
    </main>
  );
}

export default function ReviewOverlay() {
  const [path] = useLocation();
  const source = getReviewOverlaySource(path);
  const layout = getReviewOverlayLayout(useSearch());
  const utils = trpc.useUtils();
  const live = useOverlayActivity(source);
  const queue = useReviewQueue();
  const history = trpc.queue.getReviewed.useQuery(undefined, {
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const previous = trpc.reviewStudio.previous.useQuery(undefined, {
    enabled: source === "previous",
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
  });
  const selected = selectReviewOverlayState(queue.data, history.data);
  const state =
    source === "previous"
      ? {
          ...selected,
          previous: previous.data
            ? { ...previous.data, status: "reviewed" }
            : null,
        }
      : selected;
  const votes = trpc.queue.getReactions.useQuery(
    { submissionId: state.current?.id ?? 0 },
    {
      enabled: !!state.current,
      refetchInterval: 1_000,
      refetchIntervalInBackground: true,
      refetchOnReconnect: true,
    }
  );

  useEffect(() => {
    const oldTitle = document.title;
    document.title = `${source ? `${source === "submissions" ? "Submission alerts" : source} overlay` : "Review Overlay"} | Murder Mitten Media`;
    return () => {
      document.title = oldTitle;
    };
  }, [source]);

  useEffect(() => {
    // A requeued track can have the same submission ID but a new occurrence.
    // Refresh its server-owned counters on either identity change.
    if (state.current)
      void utils.queue.getReactions.invalidate({
        submissionId: state.current.id,
      });
  }, [
    state.current?.id,
    queue.data?.currentPlaying?.reviewOccurrenceId,
    live.occurrenceId,
    utils,
  ]);

  return (
    <ReviewOverlayDisplay
      state={state}
      votes={
        votes.dataUpdatedAt >= queue.dataUpdatedAt ? votes.data : undefined
      }
      loading={source === "previous" ? previous.isLoading : queue.isLoading}
      reconnecting={queue.isError || history.isError}
      layout={layout}
      source={source}
      activity={live.activity}
      submissionAlertsEnabled={live.settings.submissionAlertsEnabled}
    />
  );
}
