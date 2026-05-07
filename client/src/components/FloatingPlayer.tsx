/**
 * FloatingPlayer — Persistent mini-player that appears at the bottom of every page
 * when audio is playing. Stays alive across navigation.
 */

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { Pause, Play, Square, Volume2, VolumeX, Radio } from "lucide-react";
import { useState } from "react";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds === 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FloatingPlayer() {
  const { track, isPlaying, isLoading, volume, currentTime, duration, pause, resume, stop, setVolume, seek } = useAudioPlayer();
  const [showVolume, setShowVolume] = useState(false);

  if (!track) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0d0d0d] border-t border-white/10 shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Progress bar (only for non-streams) */}
      {!track.isStream && duration > 0 && (
        <div
          className="w-full h-1 bg-white/10 cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * duration);
          }}
        >
          <div
            className="h-full bg-red-600 group-hover:bg-red-500 transition-colors"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {/* Live stream indicator */}
      {track.isStream && (
        <div className="w-full h-1 bg-red-600 animate-pulse" />
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Artwork / icon */}
        <div className="relative flex-shrink-0">
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt={track.title}
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <Radio className="w-4 h-4 text-red-500" />
            </div>
          )}
          {track.isStream && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-600 border border-[#0d0d0d] animate-pulse" />
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">{track.title}</div>
          <div className="text-white/40 text-xs truncate">
            {track.isStream ? (
              <span className="text-red-500 font-medium">● LIVE</span>
            ) : (
              <span>{track.artist ?? "Murder Mitten Media"}</span>
            )}
          </div>
        </div>

        {/* Time (non-streams only) */}
        {!track.isStream && duration > 0 && (
          <div className="text-white/30 text-xs hidden sm:block">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(v => !v)}
            className="text-white/40 hover:text-white transition-colors p-1"
            aria-label="Volume"
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            disabled={isLoading}
            className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="w-3 h-3 border border-white/60 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            className="text-white/40 hover:text-red-500 transition-colors p-1"
            aria-label="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Volume slider (shown on tap) */}
      {showVolume && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <VolumeX className="w-3 h-3 text-white/30" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-red-600 cursor-pointer"
          />
          <Volume2 className="w-3 h-3 text-white/30" />
        </div>
      )}
    </div>
  );
}
