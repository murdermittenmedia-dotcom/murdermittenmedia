/**
 * useWarsRadio — Live radio feed for Music Wars battles.
 *
 * Admin loads contestant tracks (auto-queued when battle is set).
 * All users hear the same stream synced to the admin's playback.
 * Admin has pause/resume/skip/rewind/fast-forward controls.
 * Supports 1v1 and Triple Threat (1v1v1) modes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAudioPlayer, type AudioTrack } from "@/contexts/AudioPlayerContext";

export type WarsRadioTrack = {
  contestantName: string;
  songTitle: string;
  songUrl: string;
  contestantNumber: number;
  youtubeUrl?: string | null;
  submissionType?: string;
};

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function buildWarsAudioTrack(track: WarsRadioTrack): AudioTrack {
  const isYt = track.submissionType === "youtube" || isYouTubeUrl(track.songUrl);
  return {
    url: isYt ? "" : track.songUrl,
    title: track.songTitle,
    artist: track.contestantName,
    artworkUrl: LOGO,
    isStream: true,
    sourcePage: "Music Wars",
    sourceUrl: "/music-wars",
    youtubeUrl: track.youtubeUrl ?? (isYt ? track.songUrl : null),
    submissionType: isYt ? "youtube" : (track.submissionType ?? "file"),
  };
}

export type WarsRadioState = {
  tracks: WarsRadioTrack[];
  currentIndex: number;
  startedAt: number | null;
  pausedAt: number | null;
  isPlaying: boolean;
  tripleTheatMode: boolean;
  currentTime?: number;
};

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export function useWarsRadio({ enabled = true }: { enabled?: boolean } = {}) {
  const { play, pause, resume, stop, seek, track, onEnded } = useAudioPlayer();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WarsRadioState | null>(null);
  const [tripleTheatMode, setTripleTheatMode] = useState(false);

  const playRef = useRef(play);
  const pauseRef = useRef(pause);
  const resumeRef = useRef(resume);
  const stopRef = useRef(stop);
  const seekRef = useRef(seek);
  const trackRef = useRef(track);
  playRef.current = play;
  pauseRef.current = pause;
  resumeRef.current = resume;
  stopRef.current = stop;
  seekRef.current = seek;
  trackRef.current = track;

  // Play the current track from wars radio state
  const playCurrentTrack = useCallback((warsState: WarsRadioState) => {
    const currentTrack = warsState.tracks[warsState.currentIndex];
    if (!currentTrack) return;
    playRef.current(buildWarsAudioTrack(currentTrack));
  }, []);

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
    if (!enabled) return;

    const socket: Socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room: "music_wars" },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("wars_radio:get_state");
    });

    // Late-joiner state sync
    socket.on("wars_radio:state", (data: WarsRadioState | null) => {
      if (!data || data.tracks.length === 0) {
        setState(null);
        return;
      }
      setState(data);
      setTripleTheatMode(data.tripleTheatMode);
      const currentTrack = data.tracks[data.currentIndex];
      if (currentTrack && data.isPlaying) {
        const audioTrack = buildWarsAudioTrack(currentTrack);
        playRef.current(audioTrack);
        // Only seek for non-YouTube tracks
        if (audioTrack.submissionType !== "youtube" && data.currentTime && data.currentTime > 1) {
          setTimeout(() => seekRef.current(data.currentTime!), 800);
        }
      }
    });

    // New track playing
    socket.on("wars_radio:playing", (data: WarsRadioState) => {
      setState(data);
      setTripleTheatMode(data.tripleTheatMode);
      const currentTrack = data.tracks[data.currentIndex];
      if (currentTrack) {
        const audioTrack = buildWarsAudioTrack(currentTrack);
        playRef.current(audioTrack);
        // Only seek for non-YouTube tracks
        if (audioTrack.submissionType !== "youtube" && data.startedAt) {
          const elapsed = (Date.now() - data.startedAt) / 1000;
          if (elapsed > 1) {
            setTimeout(() => seekRef.current(elapsed), 800);
          }
        }
      }
    });

    socket.on("wars_radio:paused", (_data: { pausedAt: number }) => {
      setState(prev => prev ? { ...prev, pausedAt: _data.pausedAt, isPlaying: false } : prev);
      const current = trackRef.current;
      if (current?.isStream && current?.sourcePage === "Music Wars") {
        pauseRef.current();
      }
    });

    socket.on("wars_radio:resumed", (data: { startedAt: number }) => {
      setState(prev => prev ? { ...prev, startedAt: data.startedAt, pausedAt: null, isPlaying: true } : prev);
      const current = trackRef.current;
      if (current?.isStream && current?.sourcePage === "Music Wars") {
        resumeRef.current();
        const elapsed = (Date.now() - data.startedAt) / 1000;
        if (elapsed > 0.5) {
          setTimeout(() => seekRef.current(elapsed), 300);
        }
      }
    });

    socket.on("wars_radio:seeked", (data: { currentTime: number }) => {
      const current = trackRef.current;
      if (current?.isStream && current?.sourcePage === "Music Wars") {
        seekRef.current(data.currentTime);
      }
    });

    socket.on("wars_radio:stopped", () => {
      setState(null);
      const current = trackRef.current;
      if (current?.isStream && current?.sourcePage === "Music Wars") {
        stopRef.current();
      }
    });

    socket.on("wars_radio:ended", () => {
      setState(prev => prev ? { ...prev, isPlaying: false } : prev);
    });

    socket.on("wars_radio:triple_threat", (data: { enabled: boolean }) => {
      setTripleTheatMode(data.enabled);
      setState(prev => prev ? { ...prev, tripleTheatMode: data.enabled } : prev);
    });

    // Admin: last song restored acknowledgment
    socket.on("wars_radio:last_song_restored", () => {
      // State update handled via wars_radio:playing event already emitted by server
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [enabled, playCurrentTrack]);

  // Admin controls
  const loadTracks = useCallback((tracks: WarsRadioTrack[]) => {
    socketRef.current?.emit("wars_radio:load", { tracks });
  }, []);

  const adminPause = useCallback((currentTime: number) => {
    socketRef.current?.emit("wars_radio:pause", { currentTime });
  }, []);

  const adminResume = useCallback((currentTime: number) => {
    socketRef.current?.emit("wars_radio:resume", { currentTime });
  }, []);

  const adminSeek = useCallback((currentTime: number) => {
    socketRef.current?.emit("wars_radio:seek", { currentTime });
  }, []);

  const adminSkip = useCallback(() => {
    socketRef.current?.emit("wars_radio:skip");
  }, []);

  const adminStop = useCallback(() => {
    socketRef.current?.emit("wars_radio:stop");
  }, []);

  const setTripleTheat = useCallback((enabled: boolean) => {
    socketRef.current?.emit("wars_radio:set_triple_threat", { enabled });
  }, []);

  const adminLastSong = useCallback(() => {
    socketRef.current?.emit("wars_radio:last_song");
  }, []);

  return {
    state,
    tripleTheatMode,
    loadTracks,
    adminPause,
    adminResume,
    adminSeek,
    adminSkip,
    adminStop,
    adminLastSong,
    setTripleTheat,
    socket: socketRef.current,
  };
}
