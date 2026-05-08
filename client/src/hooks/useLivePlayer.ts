/**
 * useLivePlayer — Global live-radio sync hook.
 *
 * Connects a socket to the server and listens for radio:* and live:now_playing events.
 * When the admin loads a track in Music Review, every visitor's FloatingPlayer
 * automatically starts playing that track with a LIVE badge, synced to the admin's position.
 *
 * Mount this hook ONCE in App.tsx (outside any route) so it runs on every page.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export interface LiveNowPlayingEvent {
  submissionId: number;
  artistName: string;
  songTitle: string;
  audioUrl: string | null;
  youtubeUrl: string | null;
  submissionType: string;
  startedAt?: number | null;
}

function buildTrack(data: LiveNowPlayingEvent) {
  return {
    url: data.audioUrl!,
    title: data.songTitle,
    artist: data.artistName,
    artworkUrl: LOGO,
    isStream: true, // shows LIVE badge in FloatingPlayer
    submissionId: data.submissionId,
    sourcePage: "Music Review",
    sourceUrl: "/review",
  };
}

export function useLivePlayer() {
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
      if (finishedTrack.isStream && socketRef.current?.connected) {
        socketRef.current.emit("radio:track_ended");
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

    // Request current radio state when we connect (for late joiners)
    socket.on("connect", () => {
      socket.emit("radio:get_state");
    });

    // Server sends current state to late joiners
    socket.on("radio:state", (data: (LiveNowPlayingEvent & { currentTime: number; pausedAt: number | null }) | null) => {
      if (!data || !data.audioUrl || data.submissionType === "youtube") return;
      const t = buildTrack(data);
      playRef.current(t);
      // Sync to current position after a short delay to let audio load
      if (data.currentTime > 1) {
        setTimeout(() => {
          seekRef.current(data.currentTime);
          if (data.pausedAt !== null) {
            pauseRef.current();
          }
        }, 800);
      }
    });

    // Admin loaded a new track — play it on all clients
    socket.on("live:now_playing", (data: LiveNowPlayingEvent | null) => {
      if (!data) {
        // Admin cleared the deck — stop if we're playing a live track
        const current = trackRef.current;
        if (current?.isStream) {
          stopRef.current();
        }
        return;
      }
      // Only auto-play file submissions (not YouTube — those embed inline on /review)
      if (data.submissionType !== "youtube" && data.audioUrl) {
        const t = buildTrack(data);
        playRef.current(t);
        // Sync to current position if track already started
        if (data.startedAt) {
          const elapsed = (Date.now() - data.startedAt) / 1000;
          if (elapsed > 1) {
            setTimeout(() => seekRef.current(elapsed), 800);
          }
        }
      }
    });

    // Admin paused — pause all clients
    socket.on("radio:paused", (_data: { pausedAt: number }) => {
      const current = trackRef.current;
      if (current?.isStream) {
        pauseRef.current();
      }
    });

    // Admin resumed — resume all clients
    socket.on("radio:resumed", (data: { startedAt: number }) => {
      const current = trackRef.current;
      if (current?.isStream) {
        resumeRef.current();
        // Sync position
        const elapsed = (Date.now() - data.startedAt) / 1000;
        if (elapsed > 0.5) {
          setTimeout(() => seekRef.current(elapsed), 300);
        }
      }
    });

    // Admin seeked — seek all clients
    socket.on("radio:seeked", (data: { currentTime: number }) => {
      const current = trackRef.current;
      if (current?.isStream) {
        seekRef.current(data.currentTime);
      }
    });

    // Admin stopped — stop all clients
    socket.on("radio:stopped", () => {
      const current = trackRef.current;
      if (current?.isStream) {
        stopRef.current();
      }
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []); // mount once
}
