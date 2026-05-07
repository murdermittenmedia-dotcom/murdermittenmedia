/**
 * BattlePlayer — Admin-controlled dual-song playback for Music Wars battles.
 *
 * Admin sees full controls (play/pause, seek, volume, skip).
 * Viewers see a read-only display (song name, artist, progress bar — no interaction).
 *
 * The active battle's two songs play back to back in the order the contestants
 * were picked from the wheel.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface BattlePlayerProps {
  isAdmin: boolean;
  activeBattle: {
    id: number;
    contestant1Name: string;
    contestant1SongTitle?: string | null;
    contestant1SongUrl?: string | null;
    contestant2Name: string;
    contestant2SongTitle?: string | null;
    contestant2SongUrl?: string | null;
  } | null | undefined;
}

type TrackInfo = {
  artistName: string;
  songTitle: string;
  songUrl: string;
  contestant: "contestant1" | "contestant2";
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BattlePlayer({ isAdmin, activeBattle }: BattlePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the track queue from the active battle
  const tracks: TrackInfo[] = [];
  if (activeBattle) {
    if (activeBattle.contestant1SongUrl) {
      tracks.push({
        artistName: activeBattle.contestant1Name,
        songTitle: activeBattle.contestant1SongTitle ?? "Submitted Song",
        songUrl: activeBattle.contestant1SongUrl,
        contestant: "contestant1",
      });
    }
    if (activeBattle.contestant2SongUrl) {
      tracks.push({
        artistName: activeBattle.contestant2Name,
        songTitle: activeBattle.contestant2SongTitle ?? "Submitted Song",
        songUrl: activeBattle.contestant2SongUrl,
        contestant: "contestant2",
      });
    }
  }

  const currentTrack = tracks[currentTrackIdx] ?? null;
  const hasNextTrack = currentTrackIdx < tracks.length - 1;

  // Reset player when battle changes
  useEffect(() => {
    setCurrentTrackIdx(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, [activeBattle?.id]);

  // Sync audio element with current track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.songUrl;
    audio.volume = isMuted ? 0 : volume;
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsLoading(true);
    if (isPlaying) {
      audio.play().catch(e => {
        console.error("Playback error:", e);
        setError("Could not play this track. Check the URL.");
        setIsPlaying(false);
      });
    }
  }, [currentTrackIdx, currentTrack?.songUrl]);

  // Volume sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    if (hasNextTrack) {
      setCurrentTrackIdx(prev => prev + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [hasNextTrack]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setError("Could not load audio. The file may be unavailable.");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded, handleCanPlay, handleError]);

  // Admin controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(e => {
        setError("Playback blocked. Click play again.");
        console.error(e);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
    setIsMuted(false);
  };

  const skipToNext = () => {
    if (hasNextTrack) {
      setCurrentTrackIdx(prev => prev + 1);
      setIsPlaying(true);
    }
  };

  const skipToPrev = () => {
    if (currentTrackIdx > 0) {
      setCurrentTrackIdx(prev => prev - 1);
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!activeBattle) return null;
  if (tracks.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-white/10 p-5">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Battle Player</p>
        <p className="text-white/30 text-sm text-center py-4">
          No songs submitted yet. Contestants need to upload their tracks.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/40 uppercase tracking-widest">Battle Player</p>
        {isAdmin && (
          <span className="text-[10px] text-red-500 border border-red-600/40 px-2 py-0.5 uppercase tracking-wider">
            Admin Controls
          </span>
        )}
        {!isAdmin && (
          <span className="text-[10px] text-white/30 border border-white/10 px-2 py-0.5 uppercase tracking-wider">
            View Only
          </span>
        )}
      </div>

      {/* Track list */}
      <div className="flex gap-2 mb-4">
        {tracks.map((t, i) => (
          <button
            key={i}
            disabled={!isAdmin}
            onClick={() => isAdmin && (setCurrentTrackIdx(i), setIsPlaying(true))}
            className={`flex-1 p-2 border text-left transition-all ${
              i === currentTrackIdx
                ? "border-red-600 bg-red-600/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            } ${!isAdmin ? "cursor-default" : "cursor-pointer"}`}
          >
            <div className={`text-[10px] uppercase tracking-widest mb-0.5 ${i === currentTrackIdx ? "text-red-500" : "text-white/30"}`}>
              {i === 0 ? "Contestant 1" : "Contestant 2"}
            </div>
            <div className="text-white text-xs font-semibold truncate">{t.artistName}</div>
            <div className="text-white/50 text-[10px] truncate">{t.songTitle}</div>
          </button>
        ))}
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            {isPlaying && (
              <div className="flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "8px", animationDelay: "0ms" }} />
                <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "12px", animationDelay: "150ms" }} />
                <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "6px", animationDelay: "300ms" }} />
              </div>
            )}
            <span className="text-white text-sm font-semibold truncate">{currentTrack.artistName}</span>
            <span className="text-white/40 text-xs">—</span>
            <span className="text-white/60 text-xs truncate">{currentTrack.songTitle}</span>
          </div>

          {/* Progress bar */}
          <div className="relative mb-1">
            {isAdmin ? (
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #dc2626 ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
                }}
              />
            ) : (
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="space-y-3">
          {/* Playback buttons */}
          <div className="flex items-center justify-center gap-4">
            {/* Prev */}
            <button
              onClick={skipToPrev}
              className="text-white/40 hover:text-white transition-colors"
              title="Previous / Restart"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={!currentTrack || isLoading}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-white/10 flex items-center justify-center transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next */}
            <button
              onClick={skipToNext}
              disabled={!hasNextTrack}
              className="text-white/40 hover:text-white disabled:opacity-20 transition-colors"
              title="Next track"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8l-5.5 4zM16 6h2v12h-2z" />
              </svg>
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(m => !m)}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 appearance-none bg-white/10 rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.6) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
            />
            <span className="text-[10px] text-white/30 w-7 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Viewer-only: just show who's playing */}
      {!isAdmin && isPlaying && currentTrack && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="flex gap-0.5 items-end h-3">
            <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "8px", animationDelay: "0ms" }} />
            <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "12px", animationDelay: "150ms" }} />
            <div className="w-0.5 bg-red-500 animate-bounce" style={{ height: "6px", animationDelay: "300ms" }} />
          </div>
          <span className="text-white/50 text-xs">Now playing</span>
        </div>
      )}

      {/* Track navigation indicator */}
      <div className="flex justify-center gap-1.5 mt-3">
        {tracks.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === currentTrackIdx ? "w-6 bg-red-600" : "w-1.5 bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
