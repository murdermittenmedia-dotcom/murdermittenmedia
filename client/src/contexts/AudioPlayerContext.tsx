/**
 * AudioPlayerContext — Global persistent audio/stream player
 *
 * Features:
 * - Persists across page navigation (mounted in App.tsx)
 * - Media Session API for lock screen controls on iOS/Android
 * - Playlist/queue support with prev/next track navigation
 * - Auto-advances to next track when current ends
 * - Supports both radio streams (HLS/MP3 streams) and regular audio files
 * - iOS-safe: unlockAndPlay starts playback synchronously within user gesture
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
  // YouTube support: when set, FloatingPlayer shows an iframe embed instead of audio controls
  youtubeUrl?: string | null;
  submissionType?: "youtube" | "file" | string;
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
  /** For live streams: true when the user has locally muted (audio.muted=true) without pausing the stream */
  isLocallyMuted: boolean;
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
  /** iOS-safe play: call synchronously in a user gesture. Sets src and plays immediately. */
  unlockAndPlay: (track: AudioTrack) => void;
  /**
   * iOS-safe deferred play: call synchronously in a user gesture.
   * Immediately unlocks audio with a silent data URI, then swaps to the real URL
   * once it's resolved. Use this when you need to await URL resolution.
   */
  unlockThenSwap: (trackMeta: Omit<AudioTrack, "url">) => (resolvedUrl: string) => void;
  /** For live streams: mute local audio without stopping the stream (keeps buffering) */
  localMuteStream: () => void;
  /** For live streams: unmute local audio */
  localUnmuteStream: () => void;
  /** Get the underlying HTMLAudioElement for Web Audio API integration (e.g. mic mixing) */
  getAudioElement: () => HTMLAudioElement | null;
};

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

// Registry of onEnded callbacks
type EndedCallback = (track: AudioTrack) => void;
const endedCallbacks = new Set<EndedCallback>();

// Tiny silent MP3 data URI (~100 bytes) — used to unlock iOS audio context
const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYlMUXIAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYlMUXIAAAAAAAAAAAAAAAAAAAA";

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
    isLocallyMuted: false,
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
    const onError = () => {
      // Ignore errors from the silent placeholder
      if (audio.src === SILENT_MP3 || audio.src.startsWith("data:")) return;
      setState(s => ({ ...s, isLoading: false, isPlaying: false, error: "Failed to load audio" }));
    };
    const onTimeUpdate = () => {
      // Don't update time for silent placeholder
      if (audio.src === SILENT_MP3 || audio.src.startsWith("data:")) return;
      setState(s => ({ ...s, currentTime: audio.currentTime }));
    };
    const onDurationChange = () => {
      if (audio.src === SILENT_MP3 || audio.src.startsWith("data:")) return;
      setState(s => ({ ...s, duration: isFinite(audio.duration) ? audio.duration : 0 }));
    };
    const onEnded = () => {
      // Ignore ended event from silent placeholder
      if (audio.src === SILENT_MP3 || audio.src.startsWith("data:")) return;
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
      const audio = audioRef.current;
      if (!audio) return;
      if (stateRef.current.track?.isStream && stateRef.current.isLocallyMuted) {
        // For live streams: unmute instead of play
        audio.muted = false;
        setState(s => ({ ...s, isLocallyMuted: false }));
      } else {
        audio.play().catch(console.error);
      }
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (stateRef.current.track?.isStream) {
        // For live streams: mute locally WITHOUT pausing the stream
        // Pausing a live stream causes it to stop buffering and fall behind
        audio.muted = true;
        setState(s => ({ ...s, isLocallyMuted: true }));
      } else {
        audio.pause();
      }
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
    // For YouTube tracks, just update state — FloatingPlayer renders the iframe embed
    if (track.submissionType === "youtube" || (!track.url && track.youtubeUrl)) {
      setState(s => ({ ...s, track, playlist: [track], playlistIndex: 0, isLoading: false, isPlaying: true, error: null, currentTime: 0, duration: 0 }));
      audio.pause();
      return;
    }
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

  /**
   * iOS-safe deferred play: call synchronously in a user gesture handler.
   * 
   * This immediately plays a silent audio clip to "unlock" the audio context on iOS,
   * then returns a callback. When you call that callback with the resolved URL,
   * it swaps the src and continues playing seamlessly.
   * 
   * Usage:
   *   const swap = unlockThenSwap({ title, artist, ... });
   *   const resolvedUrl = await fetchPresignedUrl();
   *   swap(resolvedUrl);
   */
  const unlockThenSwap = useCallback((trackMeta: Omit<AudioTrack, "url">) => {
    const audio = audioRef.current;
    if (!audio) return (_url: string) => {};

    // Set state to loading with placeholder track
    setState(s => ({
      ...s,
      track: { url: "", ...trackMeta },
      playlist: [{ url: "", ...trackMeta }],
      playlistIndex: 0,
      isLoading: true,
      error: null,
      currentTime: 0,
      duration: 0,
    }));

    // Play silent audio to unlock the audio context on iOS
    audio.pause();
    audio.src = SILENT_MP3;
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Ignore errors on the silent clip
      });
    }

    // Return the swap function — caller invokes this once URL is resolved
    return (resolvedUrl: string) => {
      const fullTrack: AudioTrack = { url: resolvedUrl, ...trackMeta };
      setState(s => ({
        ...s,
        track: fullTrack,
        playlist: [fullTrack],
        playlistIndex: 0,
        isLoading: true,
        error: null,
      }));
      audio.pause();
      audio.src = resolvedUrl;
      audio.load();

      // Wait for the browser to validate the source before calling play().
      // Calling play() immediately after load() can throw NotSupportedError
      // because the audio element hasn't fetched enough data yet.
      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onLoadError);
        audio.play().catch(err => {
          if (err?.name !== 'AbortError') {
            console.error("[AudioPlayer] unlockThenSwap play error:", err);
            setState(s => ({ ...s, isLoading: false, error: "Playback failed" }));
          }
        });
      };
      const onLoadError = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onLoadError);
        // Only report error if this is still the active src
        if (audio.src.includes(resolvedUrl.split('?')[0].split('/').pop() ?? '')) {
          console.error("[AudioPlayer] unlockThenSwap load error for:", resolvedUrl.substring(0, 80));
          setState(s => ({ ...s, isLoading: false, error: "Failed to load audio" }));
        }
      };
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onLoadError);
    };
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
  /** Mute local audio for live streams without pausing (stream keeps buffering) */
  const localMuteStream = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    setState(s => ({ ...s, isLocallyMuted: true }));
  }, []);
  /** Unmute local audio for live streams */
  const localUnmuteStream = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = false;
    setState(s => ({ ...s, isLocallyMuted: false }));
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
    <AudioPlayerContext.Provider value={{ ...state, play, playPlaylist, pause, resume, stop, next, prev, setVolume, seek, onEnded, unlockAndPlay, unlockThenSwap, localMuteStream, localUnmuteStream, getAudioElement: () => audioRef.current }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
