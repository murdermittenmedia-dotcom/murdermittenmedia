/**
 * AudioPlayerContext — Global persistent audio/stream player
 *
 * Features:
 * - Persists across page navigation (mounted in App.tsx)
 * - Media Session API for lock screen controls on iOS/Android
 * - Playlist/queue support with prev/next track navigation
 * - Auto-advances to next track when current ends
 * - Supports both radio streams (HLS/MP3 streams) and regular audio files
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type AudioTrack = {
  url: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  isStream?: boolean; // true for live radio/stream URLs
  submissionId?: number; // for fire/trash rating
  artistUserId?: number; // for clicking through to artist profile
  sourcePage?: string; // e.g. "Music Review", "Forum", "Radio"
  sourceUrl?: string; // URL to navigate back to the source page
  uploaderName?: string; // username of who uploaded/posted the track
  queuePosition?: number; // position in the review queue (1-based)
  queueTotal?: number; // total items in the review queue
};

type AudioPlayerState = {
  track: AudioTrack | null;
  playlist: AudioTrack[];
  playlistIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  error: string | null;
};

type AudioPlayerContextType = AudioPlayerState & {
  play: (track: AudioTrack) => void;
  playPlaylist: (tracks: AudioTrack[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  seek: (time: number) => void;
  onEnded: (cb: (track: AudioTrack) => void) => () => void;
  /** Unlock iOS autoplay: call synchronously in a user gesture, then swap src once URL is resolved */
  unlockAndPlay: (track: AudioTrack) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

// Registry of onEnded callbacks
type EndedCallback = (track: AudioTrack) => void;
const endedCallbacks = new Set<EndedCallback>();

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    track: null,
    playlist: [],
    playlistIndex: -1,
    isPlaying: false,
    isLoading: false,
    volume: 0.8,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  // Keep a ref to state for use in callbacks without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Create the audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = 0.8;
    audioRef.current = audio;

    const onPlay = () => setState(s => ({ ...s, isPlaying: true, isLoading: false }));
    const onPause = () => setState(s => ({ ...s, isPlaying: false }));
    const onWaiting = () => setState(s => ({ ...s, isLoading: true }));
    const onCanPlay = () => setState(s => ({ ...s, isLoading: false }));
    const onError = () => setState(s => ({ ...s, isLoading: false, isPlaying: false, error: "Failed to load audio" }));
    const onTimeUpdate = () => setState(s => ({ ...s, currentTime: audio.currentTime }));
    const onDurationChange = () => setState(s => ({ ...s, duration: isFinite(audio.duration) ? audio.duration : 0 }));
    const onEnded = () => {
      // Fire registered onEnded callbacks
      const { track: currentTrack, playlist, playlistIndex } = stateRef.current;
      if (currentTrack) {
        endedCallbacks.forEach(cb => { try { cb(currentTrack); } catch {} });
      }
      // Auto-advance to next track in playlist
      if (playlist.length > 0 && playlistIndex < playlist.length - 1) {
        const nextIndex = playlistIndex + 1;
        const nextTrack = playlist[nextIndex];
        setState(s => ({ ...s, track: nextTrack, playlistIndex: nextIndex, isLoading: true, error: null, currentTime: 0, duration: 0 }));
        audio.src = nextTrack.url;
        audio.load();
        audio.play().catch(console.error);
      } else {
        setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
    };
  }, []);

  // Update Media Session API whenever track or playlist changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const { track, playlist, playlistIndex } = state;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist ?? "Murder Mitten Media",
      album: track.isStream ? "🔴 LIVE" : "Murder Mitten Media",
      artwork: track.artworkUrl
        ? [{ src: track.artworkUrl, sizes: "512x512", type: "image/jpeg" }]
        : [{ src: "/logo.png", sizes: "192x192", type: "image/png" }],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });

    if (!track.isStream) {
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10);
      });
    } else {
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    }

    // Prev/next for lock screen controls
    if (playlist.length > 1) {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        const { playlist: pl, playlistIndex: idx } = stateRef.current;
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }
        if (idx <= 0) return;
        const prevTrack = pl[idx - 1];
        setState(s => ({ ...s, track: prevTrack, playlistIndex: idx - 1, isLoading: true, error: null, currentTime: 0, duration: 0 }));
        audio.pause();
        audio.src = prevTrack.url;
        audio.load();
        audio.play().catch(console.error);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        const { playlist: pl, playlistIndex: idx } = stateRef.current;
        const audio = audioRef.current;
        if (!audio || idx >= pl.length - 1) return;
        const nextTrack = pl[idx + 1];
        setState(s => ({ ...s, track: nextTrack, playlistIndex: idx + 1, isLoading: true, error: null, currentTime: 0, duration: 0 }));
        audio.pause();
        audio.src = nextTrack.url;
        audio.load();
        audio.play().catch(console.error);
      });
    } else {
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    }
  }, [state.track, state.playlist, state.playlistIndex]);

  const play = useCallback((track: AudioTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    setState(s => ({ ...s, track, playlist: [track], playlistIndex: 0, isLoading: true, error: null, currentTime: 0, duration: 0 }));
    audio.pause();
    audio.src = track.url;
    audio.load();
    audio.play().catch(err => {
      console.error("[AudioPlayer] Play error:", err);
      setState(s => ({ ...s, isLoading: false, error: "Playback failed" }));
    });
  }, []);

  /**
   * iOS-safe play: call this synchronously in a user gesture handler.
   * It immediately sets the src and calls play() (unlocking autoplay),
   * then the audio element will load and play once the URL is ready.
   */
  const unlockAndPlay = useCallback((track: AudioTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    setState(s => ({ ...s, track, playlist: [track], playlistIndex: 0, isLoading: true, error: null, currentTime: 0, duration: 0 }));
    audio.pause();
    audio.src = track.url;
    audio.load();
    // Call play() synchronously within the user gesture to unlock iOS autoplay
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // NotSupportedError can happen if src isn't set yet — ignore, audio will play once src loads
        if (err?.name !== 'NotSupportedError' && err?.name !== 'AbortError') {
          console.error("[AudioPlayer] unlockAndPlay error:", err);
          setState(s => ({ ...s, isLoading: false, error: "Playback failed" }));
        }
      });
    }
  }, []);

  const playPlaylist = useCallback((tracks: AudioTrack[], startIndex = 0) => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;
    const track = tracks[Math.min(startIndex, tracks.length - 1)];
    const idx = Math.min(startIndex, tracks.length - 1);
    setState(s => ({ ...s, track, playlist: tracks, playlistIndex: idx, isLoading: true, error: null, currentTime: 0, duration: 0 }));
    audio.pause();
    audio.src = track.url;
    audio.load();
    audio.play().catch(err => {
      console.error("[AudioPlayer] Play error:", err);
      setState(s => ({ ...s, isLoading: false, error: "Playback failed" }));
    });
  }, []);

  const next = useCallback(() => {
    const { playlist, playlistIndex } = stateRef.current;
    const audio = audioRef.current;
    if (!audio || playlistIndex >= playlist.length - 1) return;
    const nextIndex = playlistIndex + 1;
    const nextTrack = playlist[nextIndex];
    setState(s => ({ ...s, track: nextTrack, playlistIndex: nextIndex, isLoading: true, error: null, currentTime: 0, duration: 0 }));
    audio.pause();
    audio.src = nextTrack.url;
    audio.load();
    audio.play().catch(console.error);
  }, []);

  const prev = useCallback(() => {
    const { playlist, playlistIndex } = stateRef.current;
    const audio = audioRef.current;
    if (!audio) return;
    // If more than 3 seconds in, restart current track
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (playlistIndex <= 0) return;
    const prevIndex = playlistIndex - 1;
    const prevTrack = playlist[prevIndex];
    setState(s => ({ ...s, track: prevTrack, playlistIndex: prevIndex, isLoading: true, error: null, currentTime: 0, duration: 0 }));
    audio.pause();
    audio.src = prevTrack.url;
    audio.load();
    audio.play().catch(console.error);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(console.error);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    setState(s => ({ ...s, track: null, playlist: [], playlistIndex: -1, isPlaying: false, currentTime: 0, duration: 0 }));
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (audioRef.current) audioRef.current.volume = clamped;
    setState(s => ({ ...s, volume: clamped }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      audioRef.current.currentTime = time;
    }
  }, []);

  // Register a callback to fire when any track ends
  const onEnded = useCallback((cb: (track: AudioTrack) => void) => {
    endedCallbacks.add(cb);
    return () => endedCallbacks.delete(cb);
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ ...state, play, playPlaylist, pause, resume, stop, next, prev, setVolume, seek, onEnded, unlockAndPlay }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
