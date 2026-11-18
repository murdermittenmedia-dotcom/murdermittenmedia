import { useEffect, useRef, useState } from "react";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import {
  ReviewSoundboardAudioEngine,
  type ReviewSoundboardAudioState,
} from "@/lib/review-soundboard-audio";
import { trpc } from "@/lib/trpc";
import {
  REVIEW_SOURCE_PATHS,
  type ReviewLiveEvent,
} from "@shared/review-studio";

export const REVIEW_SOUNDBOARD_AUDIO_PATH = REVIEW_SOURCE_PATHS.soundboard;

/** Public audio-only OBS/LIVE Studio source. Do not embed this in the admin preview
 * or in visual overlay sources: one loaded source equals one independent output.
 */
export default function ReviewSoundboardAudio() {
  const engine = useRef<ReviewSoundboardAudioEngine | null>(null);
  const earlyEvents = useRef<ReviewLiveEvent[]>([]);
  const [sourceId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ReviewSoundboardAudioState>({
    ready: false,
    active: 0,
    queued: 0,
    error: null,
  });
  const [heartbeatError, setHeartbeatError] = useState(false);
  const [audioSources, setAudioSources] = useState(0);
  const { settings } = useReviewLiveEvents(event => {
    if (engine.current) engine.current.handleEvent(event);
    else earlyEvents.current.push(event);
  });
  const heartbeat = trpc.reviewStudio.sourceHeartbeat.useMutation();
  const sendHeartbeat = useRef(heartbeat.mutateAsync);
  sendHeartbeat.current = heartbeat.mutateAsync;

  useEffect(() => {
    const audio = new ReviewSoundboardAudioEngine({ onStateChange: setState });
    engine.current = audio;
    for (const event of earlyEvents.current.splice(0)) audio.handleEvent(event);
    void audio.enable(); // Genuine context resume; rejected/blocked autoplay keeps the affordance visible.
    return () => {
      engine.current = null;
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    engine.current?.setVolume(settings.soundboardVolume);
  }, [settings.soundboardVolume]);
  useEffect(() => {
    const urls = settings.sounds.flatMap(sound =>
      sound.url ? [sound.url] : []
    );
    void engine.current?.preload(urls);
  }, [settings.sounds]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const report = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await sendHeartbeat.current({ sourceId });
        if (alive) {
          setAudioSources(result.audioSources);
          setHeartbeatError(false);
        }
      } catch {
        if (alive) setHeartbeatError(true);
      } finally {
        inFlight = false;
      }
    };
    void report();
    const interval = setInterval(() => {
      void report();
    }, 3_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [sourceId]);

  useEffect(() => {
    // Override only source-local background/margin properties, then restore on navigation.
    const elements = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
    ].filter((element): element is HTMLElement => !!element);
    const previous = elements.map(element => ({
      element,
      background: element.style.getPropertyValue("background"),
      backgroundPriority: element.style.getPropertyPriority("background"),
      margin: element.style.getPropertyValue("margin"),
      marginPriority: element.style.getPropertyPriority("margin"),
    }));
    for (const element of elements) {
      element.style.setProperty("background", "transparent", "important");
      element.style.setProperty("margin", "0", "important");
    }
    return () => {
      for (const item of previous) {
        if (item.background)
          item.element.style.setProperty(
            "background",
            item.background,
            item.backgroundPriority
          );
        else item.element.style.removeProperty("background");
        if (item.margin)
          item.element.style.setProperty(
            "margin",
            item.margin,
            item.marginPriority
          );
        else item.element.style.removeProperty("margin");
      }
    };
  }, []);

  const multipleSources = audioSources > 1;
  const needsAttention = !state.ready || !!state.error;
  return (
    <main
      aria-label="Soundboard audio source"
      data-source-id={sourceId}
      data-audio-ready={state.ready}
      data-active-voices={state.active}
      data-queued-units={state.queued}
      style={{ background: "transparent", margin: 0, padding: 0 }}
    >
      {needsAttention && (
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            gap: 6,
            maxWidth: 310,
            padding: 8,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <button
            type="button"
            onClick={() => {
              void engine.current?.enable();
            }}
            style={{
              background: "#151515",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: 6,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {state.ready ? "Retry soundboard audio" : "Enable soundboard audio"}
          </button>
          {state.error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: 5,
                fontSize: 11,
                color: "#fff",
                background: "#5b1919",
                borderRadius: 4,
              }}
            >
              {state.error}
            </p>
          )}
        </div>
      )}
      {multipleSources && (
        <p
          role="alert"
          style={{
            display: "inline-block",
            margin: 0,
            padding: 6,
            maxWidth: 310,
            fontSize: 11,
            color: "#fff",
            background: "#5d4214",
            borderRadius: 4,
          }}
        >
          Multiple soundboard sources are active. Remove extras to prevent echo.
          Genuine gift events are not discarded.
        </p>
      )}
      {heartbeatError && (
        <p
          role="status"
          style={{
            display: "inline-block",
            margin: 0,
            padding: 6,
            fontSize: 11,
            color: "#fff",
            background: "#5d4214",
            borderRadius: 4,
          }}
        >
          Audio-source heartbeat unavailable; reconnecting.
        </p>
      )}
    </main>
  );
}
