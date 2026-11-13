/**
 * useLivePlayer — Global live-radio sync hook.
 *
 * Connects a socket to the server and listens for radio:* and live:now_playing events.
 * When the admin loads a track in Music Review, every visitor's FloatingPlayer
 * automatically starts playing that track with a LIVE badge, synced to the admin's position.
 *
 * Mount this hook ONCE in App.tsx (outside any route) so it runs on every page.
 *
 * Key behaviors:
 * - Late joiners: on connect, emits radio:get_state → server replies with current track + position
 * - Admin loads track: live:now_playing → auto-plays for all viewers
 * - Admin pause/resume/seek/stop: synced to all viewers
 * - Viewers cannot independently control live stream playback (FloatingPlayer hides controls)
 * - Only affects the player when current track is from "Music Review" (avoids Music Wars interference)
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { trpc } from "@/lib/trpc";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export interface LiveNowPlayingEvent {
  submissionId: number;
  artistName: string;
  songTitle: string;
  audioUrl: string | null;
  youtubeUrl: string | null;
  submissionType: string;
  startedAt?: number | null;
  userId?: number | null;
}

function buildTrack(data: LiveNowPlayingEvent) {
  return {
    // For YouTube tracks, url is empty string — FloatingPlayer uses youtubeUrl instead
    url: data.audioUrl ?? "",
    title: data.songTitle,
    artist: data.artistName,
    artworkUrl: LOGO,
    isStream: true, // shows LIVE badge in FloatingPlayer, disables viewer controls
    submissionId: data.submissionId,
    artistUserId: data.userId ?? undefined,
    sourcePage: "Music Review",
    sourceUrl: "/review",
    youtubeUrl: data.youtubeUrl ?? null,
    submissionType: data.submissionType,
  };
}

/** Check if the currently loaded track belongs to Music Review live radio */
function isOurStream(track: { isStream?: boolean; sourcePage?: string } | null): boolean {
  return !!track?.isStream && track?.sourcePage === "Music Review";
}

export function useLivePlayer({ isAdmin = false, suspended = false }: { isAdmin?: boolean; suspended?: boolean } = {}) {
  const { play, playWithSeek, pause, resume, stop, seek, track, getAudioElement, onEnded } = useAudioPlayer();
  const { data: queue } = trpc.queue.getAll.useQuery(undefined, { enabled: isAdmin && !suspended, refetchInterval: 2000, refetchIntervalInBackground: true });
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const endingIdRef = useRef<number | null>(null);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  // Keep refs so socket callbacks always see latest values without re-subscribing
  const playRef = useRef(play);
  const playWithSeekRef = useRef(playWithSeek);
  const pauseRef = useRef(pause);
  const resumeRef = useRef(resume);
  const stopRef = useRef(stop);
  const seekRef = useRef(seek);
  const trackRef = useRef(track);
  const getAudioElementRef = useRef(getAudioElement);
  const socketRef = useRef<Socket | null>(null);
  playRef.current = play;
  playWithSeekRef.current = playWithSeek;
  pauseRef.current = pause;
  resumeRef.current = resume;
  stopRef.current = stop;
  seekRef.current = seek;
  trackRef.current = track;
  getAudioElementRef.current = getAudioElement;

  useEffect(() => {
    if (suspended) return;
    // Connect without joining a room — we only need the global events
    const socket: Socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room: "global" },
    });
    socketRef.current = socket;
    const complete = (submissionId: number) => {
      if (endingIdRef.current === submissionId || !socket.connected || !isAdminRef.current) return;
      endingIdRef.current = submissionId;
      socket.emit("radio:track_ended", { submissionId });
    };
    const unsubscribeEnded = onEnded((finished) => {
      if (isOurStream(finished) && finished.submissionId) complete(finished.submissionId);
    });
    const cutoffTimer = window.setInterval(() => {
      const current = queueRef.current?.currentPlaying;
      const audio = getAudioElementRef.current();
      if (!current || queueRef.current?.state?.playbackMode !== "90sec" || current.isPaidSubmission || current.paidSubmissionType) return;
      if (current.submissionType !== "file" || !isOurStream(trackRef.current) || trackRef.current?.submissionId !== current.id) return;
      if (audio && !audio.paused && audio.currentTime >= 90) { audio.pause(); complete(current.id); }
    }, 500);

    const synchronizeAuthoritativeState = (data: (LiveNowPlayingEvent & { currentTime: number; pausedAt: number | null }) | null) => {
      if (!data || (!data.audioUrl && !data.youtubeUrl) || data.submissionType === "youtube") return;
      if (endingIdRef.current === data.submissionId) return;
      endingIdRef.current = null;
      const liveTrack = buildTrack(data);
      const expectedPosition = Math.max(0, data.currentTime);
      const currentTrack = trackRef.current;
      const currentAudio = getAudioElementRef.current();
      const isSameAuthoritativeTrack = isOurStream(currentTrack) && currentTrack?.submissionId === data.submissionId;

      if (!isSameAuthoritativeTrack) {
        if (expectedPosition > 0.15) playWithSeekRef.current(liveTrack, expectedPosition);
        else playRef.current(liveTrack);
        if (data.pausedAt !== null) setTimeout(() => pauseRef.current(), 250);
        return;
      }

      if (data.pausedAt !== null) {
        if (currentAudio && !currentAudio.paused) pauseRef.current();
        return;
      }

      if (currentAudio?.paused) resumeRef.current();
      // Correct meaningful server-clock drift without repeatedly restarting audio.
      if (currentAudio && Math.abs(currentAudio.currentTime - expectedPosition) > 1.25) {
        seekRef.current(expectedPosition);
      }
    };

    // Refresh the server-authoritative transport state after reconnects and at
    // a low frequency so a transient browser hiccup never creates a new clock.
    const requestAuthoritativeState = () => socket.emit("radio:get_state");
    socket.on("connect", requestAuthoritativeState);
    const driftCorrectionTimer = window.setInterval(requestAuthoritativeState, 4_000);

    // Server sends the authoritative state to late joiners and drift checks.
    socket.on("radio:state", synchronizeAuthoritativeState);

    // Admin loaded a new track — play it on all clients
    socket.on("live:now_playing", (data: LiveNowPlayingEvent | null) => {
      if (!data) {
        // Admin cleared the deck — stop if we're playing a Music Review live track
        const current = trackRef.current;
        if (isOurStream(current)) {
          stopRef.current();
        }
        return;
      }
      if (endingIdRef.current === data.submissionId) return;
      endingIdRef.current = null;
      // Keep YouTube playback inside SyncedYouTubePlayer on /review. Passing
      // an empty URL into the global audio element cannot produce usable audio
      // and can compete with the synchronized player when the page is open.
      if (data.submissionType === "youtube") {
        if (isOurStream(trackRef.current)) stopRef.current();
        return;
      }
      // Support both file and YouTube submissions
      if (data.audioUrl || data.youtubeUrl) {
        const t = buildTrack(data);
        // For file tracks, sync to current position reliably via playWithSeek
        if (data.submissionType !== "youtube" && data.startedAt) {
          const elapsed = (Date.now() - data.startedAt) / 1000;
          if (elapsed > 1) {
            playWithSeekRef.current(t, elapsed);
          } else {
            playRef.current(t);
          }
        } else {
          playRef.current(t);
        }
      }
    });

    // Admin paused — pause all clients (only if playing our stream)
    socket.on("radio:paused", (_data: { pausedAt: number }) => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        pauseRef.current();
      }
    });

    // Admin resumed — resume all clients (only if playing our stream)
    socket.on("radio:resumed", (data: { startedAt: number }) => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        resumeRef.current();
        // Sync position
        const elapsed = (Date.now() - data.startedAt) / 1000;
        if (elapsed > 0.5) {
          setTimeout(() => seekRef.current(elapsed), 300);
        }
      }
    });

    // Admin seeked — seek all clients (only if playing our stream)
    socket.on("radio:seeked", (data: { currentTime: number }) => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        seekRef.current(data.currentTime);
      }
    });

    // Admin stopped — stop all clients (only if playing our stream)
    socket.on("radio:stopped", () => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        stopRef.current();
      }
    });

    return () => {
      socketRef.current = null;
      unsubscribeEnded();
      window.clearInterval(cutoffTimer);
      window.clearInterval(driftCorrectionTimer);
      socket.disconnect();
    };
  }, [suspended, onEnded]);
}
