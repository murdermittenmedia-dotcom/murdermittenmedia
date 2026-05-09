/**
 * useWarsLivePlayer — Global live-radio sync hook for Music Wars.
 *
 * Connects a socket to the server and listens for wars:* events (site-wide broadcasts).
 * When the admin loads contestant tracks in Music Wars, every visitor's FloatingPlayer
 * automatically starts playing that track with a LIVE badge, synced to the admin's position.
 *
 * Mount this hook ONCE in App.tsx (outside any route) so it runs on every page.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export interface WarsNowPlayingEvent {
  url: string;
  title: string;
  artist: string;
  startedAt?: number | null;
  youtubeUrl?: string | null;
  submissionType?: string;
}

function buildTrack(data: WarsNowPlayingEvent) {
  const isYoutube = data.submissionType === "youtube" || isYouTubeUrl(data.url);
  return {
    // For YouTube tracks, url is empty string — FloatingPlayer uses youtubeUrl instead
    url: isYoutube ? "" : data.url,
    title: data.title,
    artist: data.artist,
    artworkUrl: LOGO,
    isStream: true, // shows LIVE badge in FloatingPlayer, disables viewer controls
    sourcePage: "Music Wars",
    sourceUrl: "/music-wars",
    youtubeUrl: data.youtubeUrl ?? (isYoutube ? data.url : null),
    submissionType: isYoutube ? "youtube" : (data.submissionType ?? "file"),
  };
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

/** Check if the currently loaded track belongs to Music Wars live radio */
function isOurStream(track: { isStream?: boolean; sourcePage?: string } | null): boolean {
  return !!track?.isStream && track?.sourcePage === "Music Wars";
}

export function useWarsLivePlayer() {
  const { play, pause, resume, stop, seek, track, onEnded } = useAudioPlayer();
  // Keep refs so socket callbacks always see latest values without re-subscribing
  const playRef = useRef(play);
  const pauseRef = useRef(pause);
  const resumeRef = useRef(resume);
  const stopRef = useRef(stop);
  const seekRef = useRef(seek);
  const trackRef = useRef(track);
  const socketRef = useRef<Socket | null>(null);
  playRef.current = play;
  pauseRef.current = pause;
  resumeRef.current = resume;
  stopRef.current = stop;
  seekRef.current = seek;
  trackRef.current = track;

  // When a live track ends, tell the server to auto-advance
  useEffect(() => {
    const unsub = onEnded((finishedTrack) => {
      if (finishedTrack.isStream && finishedTrack.sourcePage === "Music Wars" && socketRef.current?.connected) {
        socketRef.current.emit("wars_radio:track_ended");
      }
    });
    return unsub;
  }, [onEnded]);

  useEffect(() => {
    // Connect without joining a room — we only need the global events
    const socket: Socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room: "global" },
    });
    socketRef.current = socket;

    // Request current wars radio state when we connect (for late joiners)
    socket.on("connect", () => {
      socket.emit("wars_radio:get_state");
    });

    // Server sends current state to late joiners
    socket.on("wars_radio:state", (data: (WarsNowPlayingEvent & { currentTime: number; pausedAt: number | null }) | null) => {
      if (!data || (!data.url && !data.youtubeUrl)) return;
      const t = buildTrack(data);
      playRef.current(t);
      // For file tracks, sync to current position after a short delay
      const isYt = t.submissionType === "youtube";
      if (!isYt && data.currentTime > 1) {
        setTimeout(() => {
          seekRef.current(data.currentTime);
          if (data.pausedAt !== null) {
            pauseRef.current();
          }
        }, 800);
      }
    });

    // Admin loaded new contestant tracks — play them on all clients
    socket.on("wars:now_playing", (data: WarsNowPlayingEvent | null) => {
      if (!data) {
        // Admin stopped the battle — stop if we're playing a Music Wars stream
        const current = trackRef.current;
        if (isOurStream(current)) {
          stopRef.current();
        }
        return;
      }
      if (data.url || data.youtubeUrl) {
        const t = buildTrack(data);
        playRef.current(t);
        // For file tracks, sync to current position if track already started
        const isYt = t.submissionType === "youtube";
        if (!isYt && data.startedAt) {
          const elapsed = (Date.now() - data.startedAt) / 1000;
          if (elapsed > 1) {
            setTimeout(() => seekRef.current(elapsed), 800);
          }
        }
      }
    });

    // Admin paused — pause all clients (only if playing our stream)
    socket.on("wars:paused", (_data: { pausedAt: number }) => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        pauseRef.current();
      }
    });

    // Admin resumed — resume all clients (only if playing our stream)
    socket.on("wars:resumed", (data: { startedAt: number }) => {
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
    socket.on("wars:seeked", (data: { currentTime: number; startedAt: number }) => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        seekRef.current(data.currentTime);
      }
    });

    // Admin stopped — stop all clients (only if playing our stream)
    socket.on("wars:stopped", () => {
      const current = trackRef.current;
      if (isOurStream(current)) {
        stopRef.current();
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []); // mount once
}
