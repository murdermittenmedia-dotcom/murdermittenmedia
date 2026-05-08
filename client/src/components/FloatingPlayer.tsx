/**
 * FloatingPlayer — Persistent mini-player fixed at the bottom of every page.
 * Appears when any audio is loaded. Stays alive across navigation.
 *
 * Features:
 *   - Clickable progress scrubber with time display
 *   - Volume slider (toggle)
 *   - Prev / Play-Pause / Next controls
 *   - Queue panel (expandable, click-to-jump)
 *   - Fire / Trash rating for review submissions
 *   - Clickable artist name → ArtistStatModal
 *   - Source page badge (links back to origin page)
 *   - LIVE mode: when track.isStream is true, viewer controls are disabled
 *     (no pause/seek/stop/prev/next — only volume). Admin controls playback for everyone.
 */

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import {
  Pause, Play, Square, Volume2, VolumeX, Radio, Flame, Trash2, User,
  ChevronDown, List, X, SkipBack, SkipForward, ExternalLink, Music2,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { ArtistLink } from "@/components/ArtistLink";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FloatingPlayer() {
  const {
    track, playlist, playlistIndex, isPlaying, isLoading,
    volume, currentTime, duration,
    pause, resume, stop, setVolume, seek, next, prev, playPlaylist,
  } = useAudioPlayer();

  const { user } = useAuth();
  const [showVolume, setShowVolume] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [myReaction, setMyReaction] = useState<"fire" | "trash" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Whether the current track is a live stream (admin-controlled)
  const isLiveStream = !!track?.isStream;

  // ── Fire/Trash rating ──────────────────────────────────────────────────────
  const reactMutation = trpc.queue.react.useMutation({
    onSuccess: (_data, variables) => {
      setMyReaction(variables.reaction);
      toast.success(variables.reaction === "fire" ? "🔥 Fire!" : "🗑️ Trash!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleReact = (reaction: "fire" | "trash") => {
    if (!user) { toast.error("Login to rate tracks"); return; }
    if (!track?.submissionId) return;
    if (myReaction === reaction) return;
    reactMutation.mutate({ submissionId: track.submissionId, reaction });
  };

  // Reset reaction when track changes
  const trackId = track?.submissionId;
  const prevTrackIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = trackId;
      setMyReaction(null);
    }
  }, [trackId]);

  // ── Progress scrubber drag ─────────────────────────────────────────────────
  const getProgressFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
    const el = progressRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    if (isLiveStream || duration <= 0) return;
    setIsDragging(true);
    setDragProgress(getProgressFromEvent(e));
  };

  const handleProgressMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragProgress(getProgressFromEvent(e));
  };

  const handleProgressMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const pct = getProgressFromEvent(e);
    seek(pct * duration);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (isLiveStream || duration <= 0) return;
    const pct = getProgressFromEvent(e);
    seek(pct * duration);
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!track) return null;

  const displayProgress = isDragging ? dragProgress * 100 : duration > 0 ? (currentTime / duration) * 100 : 0;
  const canRate = !!track.submissionId && !!user;
  const hasPlaylist = playlist.length > 1 && !isLiveStream;

  return (
    <>
      {/* ── Queue panel (only for personal playlist, not live stream) ──── */}
      {showQueue && !isLiveStream && (
        <div className="fixed bottom-[72px] left-0 right-0 z-[99] bg-[#0f0f0f] border border-white/10 border-b-0 shadow-2xl max-h-[45vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 sticky top-0 bg-[#0f0f0f] z-10">
            <div className="flex items-center gap-2">
              <List className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
                Queue · {playlist.length} track{playlist.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button onClick={() => setShowQueue(false)} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {playlist.length === 0 && (
              <div className="px-4 py-8 text-center text-white/30 text-sm">Queue is empty</div>
            )}
            {playlist.map((item, idx) => {
              const isCurrent = idx === playlistIndex;
              return (
                <div
                  key={`${item.url}-${idx}`}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isCurrent ? "bg-red-950/40" : "hover:bg-white/[0.03]"}`}
                  onClick={() => !isCurrent && playPlaylist(playlist, idx)}
                >
                  <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? "text-red-500" : "text-white/30"}`}>
                    {isCurrent ? <Play className="w-3 h-3 inline" /> : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${isCurrent ? "text-white font-semibold" : "text-white/70"}`}>{item.title}</div>
                    {item.artist && <div className="text-xs text-white/40 truncate"><ArtistLink artistName={item.artist} userId={item.artistUserId ?? null} /></div>}
                  </div>
                  {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main player bar ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0a0a0a] border-t border-white/10 shadow-2xl select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onMouseMove={handleProgressMouseMove}
        onMouseUp={handleProgressMouseUp}
        onMouseLeave={() => { if (isDragging) { setIsDragging(false); } }}
      >
        {/* ── Progress bar ─────────────────────────────────────────────── */}
        {isLiveStream ? (
          /* Live stream: pulsing red bar, no scrubbing */
          <div className="w-full h-1.5 bg-red-600/60 animate-pulse" />
        ) : (
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-white/10 cursor-pointer group relative"
            onMouseDown={handleProgressMouseDown}
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-red-600 group-hover:bg-red-500 transition-colors relative"
              style={{ width: `${displayProgress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* ── Controls row ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2">

          {/* Artwork */}
          <div className="relative flex-shrink-0">
            {track.artworkUrl ? (
              <img src={track.artworkUrl} alt={track.title} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-900/60 to-red-600/20 border border-red-600/30 flex items-center justify-center">
                <Music2 className="w-4 h-4 text-red-400" />
              </div>
            )}
            {isLiveStream && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-[#0a0a0a] animate-pulse" />
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 mr-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-white text-sm font-semibold truncate leading-tight">{track.title}</span>
              {track.sourcePage && track.sourceUrl && (
                <Link href={track.sourceUrl}>
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-white/30 hover:text-red-400 border border-white/10 hover:border-red-500/40 px-1.5 py-0.5 rounded transition-colors flex-shrink-0">
                    <ExternalLink className="w-2.5 h-2.5" />
                    {track.sourcePage}
                  </span>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
              {isLiveStream ? (
                <span className="text-red-500 text-xs font-bold flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  LIVE — Admin Controlled
                </span>
              ) : track.artist ? (
                <ArtistStatModal artistName={track.artist} userId={track.artistUserId ?? null}>
                  <button className="text-white/50 hover:text-red-400 text-xs transition-colors flex items-center gap-1 min-w-0 truncate">
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{track.artist}</span>
                  </button>
                </ArtistStatModal>
              ) : (
                <span className="text-white/40 text-xs">Murder Mitten Media</span>
              )}
              {!isLiveStream && duration > 0 && (
                <span className="text-white/25 text-xs flex-shrink-0 hidden sm:inline">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
              {track.queuePosition != null && track.queueTotal != null && (
                <span className="text-white/25 text-xs flex-shrink-0 hidden md:inline">
                  · #{track.queuePosition}/{track.queueTotal}
                </span>
              )}
            </div>
          </div>

          {/* Fire / Trash — available for live stream tracks too */}
          {canRate && (
            <div className="hidden sm:flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleReact("fire")}
                disabled={reactMutation.isPending}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${
                  myReaction === "fire"
                    ? "text-orange-400 bg-orange-400/20 border border-orange-400/40"
                    : "text-white/30 hover:text-orange-400 hover:bg-orange-400/10 border border-transparent"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Fire</span>
              </button>
              <button
                onClick={() => handleReact("trash")}
                disabled={reactMutation.isPending}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ${
                  myReaction === "trash"
                    ? "text-gray-400 bg-gray-400/20 border border-gray-400/40"
                    : "text-white/30 hover:text-gray-400 hover:bg-gray-400/10 border border-transparent"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Trash</span>
              </button>
            </div>
          )}

          {/* Playback controls — HIDDEN for live stream (admin controls for everyone) */}
          {isLiveStream ? (
            /* Live stream: play/pause (mute/unmute) + volume control */
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Play / Pause — acts as mute/unmute for live stream */}
              <button
                onClick={isPlaying ? pause : resume}
                disabled={isLoading}
                className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg shadow-red-900/30 mx-0.5"
                aria-label={isPlaying ? "Pause" : "Play"}
                title="Pause/Resume live stream"
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 text-white" />
                ) : (
                  <Play className="w-4 h-4 text-white ml-0.5" />
                )}
              </button>

              {/* Volume */}
              <button
                onClick={() => setShowVolume(v => !v)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${showVolume ? "text-white bg-white/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                aria-label="Volume"
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            /* Personal playback: full controls */
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Volume */}
              <button
                onClick={() => setShowVolume(v => !v)}
                className={`p-1.5 rounded-lg transition-colors hidden sm:flex items-center justify-center ${showVolume ? "text-white bg-white/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                aria-label="Volume"
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Prev */}
              {hasPlaylist && (
                <button
                  onClick={prev}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Previous"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
              )}

              {/* Play / Pause */}
              <button
                onClick={isPlaying ? pause : resume}
                disabled={isLoading}
                className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg shadow-red-900/30 mx-0.5"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 text-white" />
                ) : (
                  <Play className="w-4 h-4 text-white ml-0.5" />
                )}
              </button>

              {/* Next */}
              {hasPlaylist && (
                <button
                  onClick={next}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Next"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              )}

              {/* Stop */}
              <button
                onClick={stop}
                className="p-1.5 rounded-lg text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="Stop"
              >
                <Square className="w-3.5 h-3.5" />
              </button>

              {/* Queue */}
              <button
                onClick={() => setShowQueue(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showQueue ? "text-red-500 bg-red-500/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                aria-label="Queue"
                title={`Queue (${playlist.length})`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Volume slider */}
        {showVolume && (
          <div className="px-4 pb-3 flex items-center gap-3 border-t border-white/5">
            <VolumeX className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-red-600 cursor-pointer"
            />
            <Volume2 className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <span className="text-white/30 text-xs w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>
        )}
      </div>
    </>
  );
}
