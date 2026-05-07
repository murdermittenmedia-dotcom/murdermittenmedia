/**
 * FloatingPlayer — Persistent mini-player that appears at the bottom of every page
 * when audio is playing. Stays alive across navigation.
 * Features:
 *   - Fire/trash rating for reviewed submissions
 *   - Clickable artist name → ArtistStatModal
 *   - Personal Queue panel (expandable, shows playlist, remove tracks)
 *   - Live Radio mode (polls radio.getState, shows live queue)
 *   - Volume control, seek bar, prev/next
 */

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import {
  Pause, Play, Square, Volume2, VolumeX, Radio, Flame, Trash2, User,
  ChevronUp, ChevronDown, List, X, SkipBack, SkipForward, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ArtistStatModal } from "@/components/ArtistStatModal";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds === 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FloatingPlayer() {
  const {
    track, playlist, playlistIndex, isPlaying, isLoading,
    volume, currentTime, duration,
    pause, resume, stop, setVolume, seek, next, prev, playPlaylist
  } = useAudioPlayer();

  const { user } = useAuth();
  const [showVolume, setShowVolume] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [radioMode, setRadioMode] = useState(false);
  const [myReaction, setMyReaction] = useState<"fire" | "trash" | null>(null);

  // Fire/trash rating
  const reactMutation = trpc.queue.react.useMutation({
    onSuccess: (_data, variables) => {
      setMyReaction(variables.reaction);
      toast.success(variables.reaction === "fire" ? "🔥 Fire!" : "🗑️ Trash!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleReact = (reaction: "fire" | "trash") => {
    if (!user) { toast.error("Login to rate tracks"); return; }
    if (!track?.submissionId) { toast.error("No submission ID for this track"); return; }
    if (myReaction === reaction) return;
    reactMutation.mutate({ submissionId: track.submissionId, reaction });
  };

  // Reset reaction when track changes
  const trackId = track?.submissionId;
  const [lastTrackId, setLastTrackId] = useState<number | undefined>(undefined);
  if (trackId !== lastTrackId) {
    setLastTrackId(trackId);
    setMyReaction(null);
  }

  // Live Radio state polling (every 10s when radio mode is on)
  const { data: radioData } = trpc.radio.getState.useQuery(undefined, {
    enabled: radioMode,
    refetchInterval: radioMode ? 10000 : false,
  });

  // When radio mode turns on and there's a live track, auto-play it
  useEffect(() => {
    if (!radioMode || !radioData?.state?.isActive) return;
    const currentTrack = radioData.queue.find(q => q.id === radioData.state?.currentTrackId);
    if (!currentTrack) return;
    const url = currentTrack.fileKey
      ? `/manus-storage/${currentTrack.fileKey}`
      : currentTrack.externalUrl ?? "";
    if (url && track?.url !== url) {
      // Use playPlaylist to load the radio queue
      const tracks = radioData.queue.map(q => ({
        url: q.fileKey ? `/manus-storage/${q.fileKey}` : q.externalUrl ?? "",
        title: q.title,
        artist: q.artistName,
        isStream: false,
      })).filter(t => t.url);
      const startIdx = tracks.findIndex(t =>
        t.url === url
      );
      if (tracks.length > 0) {
        playPlaylist(tracks, startIdx >= 0 ? startIdx : 0);
      }
    }
  }, [radioMode, radioData]);

  if (!track && !radioMode) return null;
  if (!track && radioMode && !radioData?.state?.isActive) {
    // Radio mode on but nothing playing — show a minimal indicator
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0d0d0d] border-t border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white/50 text-sm">Live Radio</div>
            <div className="text-white/30 text-xs">Offline — no broadcast active</div>
          </div>
          <button
            onClick={() => setRadioMode(false)}
            className="text-white/30 hover:text-white/70 p-1"
            title="Exit radio mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!track) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canRate = !!track.submissionId && !!user && !track.isStream;
  const hasPlaylist = playlist.length > 1;

  return (
    <>
      {/* Queue panel (slides up from player) */}
      {showQueue && (
        <div className="fixed bottom-[72px] left-0 right-0 z-[99] bg-[#111] border-t border-white/10 shadow-2xl max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 sticky top-0 bg-[#111]">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
              {radioMode ? "Live Radio Queue" : "Personal Queue"}
            </span>
            <button onClick={() => setShowQueue(false)} className="text-white/40 hover:text-white p-1">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Radio queue */}
          {radioMode && radioData?.queue && (
            <div className="divide-y divide-white/5">
              {radioData.queue.length === 0 && (
                <div className="px-4 py-6 text-center text-white/30 text-sm">Queue is empty</div>
              )}
              {radioData.queue.map((item, idx) => {
                const isCurrent = item.id === radioData.state?.currentTrackId;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${isCurrent ? "bg-red-950/30" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className={`text-xs w-5 text-center ${isCurrent ? "text-red-500" : "text-white/30"}`}>
                      {isCurrent ? "▶" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isCurrent ? "text-white font-semibold" : "text-white/70"}`}>
                        {item.title}
                      </div>
                      <div className="text-xs text-white/40 truncate">{item.artistName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Personal playlist queue */}
          {!radioMode && (
            <div className="divide-y divide-white/5">
              {playlist.length === 0 && (
                <div className="px-4 py-6 text-center text-white/30 text-sm">Queue is empty</div>
              )}
              {playlist.map((item, idx) => {
                const isCurrent = idx === playlistIndex;
                return (
                  <div
                    key={`${item.url}-${idx}`}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                      isCurrent ? "bg-red-950/30" : "hover:bg-white/[0.03]"
                    }`}
                    onClick={() => !isCurrent && playPlaylist(playlist, idx)}
                  >
                    <span className={`text-xs w-5 text-center ${isCurrent ? "text-red-500" : "text-white/30"}`}>
                      {isCurrent ? "▶" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isCurrent ? "text-white font-semibold" : "text-white/70"}`}>
                        {item.title}
                      </div>
                      {item.artist && (
                        <div className="text-xs text-white/40 truncate">{item.artist}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main player bar */}
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

        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Artwork / icon */}
          <div className="relative flex-shrink-0">
            {track.artworkUrl ? (
              <img
                src={track.artworkUrl}
                alt={track.title}
                className="w-9 h-9 rounded object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded bg-red-600/20 border border-red-600/40 flex items-center justify-center">
                <Radio className="w-4 h-4 text-red-500" />
              </div>
            )}
            {(track.isStream || radioMode) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 border border-[#0d0d0d] animate-pulse" />
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="text-white text-sm font-semibold truncate leading-tight">{track.title}</div>
              {track.sourcePage && track.sourceUrl && (
                <Link href={track.sourceUrl}>
                  <span className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 text-[10px] uppercase tracking-widest border border-white/10 px-1 py-0.5 rounded hidden sm:inline-flex items-center gap-0.5">
                    <ExternalLink className="w-2.5 h-2.5" />
                    {track.sourcePage}
                  </span>
                </Link>
              )}
            </div>
            <div className="text-white/40 text-xs truncate flex items-center gap-1.5">
              {track.isStream ? (
                <span className="text-red-500 font-medium">● LIVE</span>
              ) : track.artist ? (
                <ArtistStatModal artistName={track.artist} userId={track.artistUserId ?? null}>
                  <button
                    className="hover:text-red-400 transition-colors flex items-center gap-1"
                    title="View artist profile"
                  >
                    <User className="w-3 h-3" />
                    {track.artist}
                  </button>
                </ArtistStatModal>
              ) : (
                <span>Murder Mitten Media</span>
              )}
              {track.uploaderName && track.uploaderName !== track.artist && (
                <span className="text-white/20 hidden sm:inline">· uploaded by {track.uploaderName}</span>
              )}
              {track.queuePosition != null && track.queueTotal != null && (
                <span className="text-white/20 hidden sm:inline">· #{track.queuePosition}/{track.queueTotal} in queue</span>
              )}
            </div>
          </div>

          {/* Time display, hidden on mobile */}
          {!track.isStream && duration > 0 && (
            <div className="text-white/30 text-xs hidden md:block flex-shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}

          {/* Fire / Trash rating */}
          {canRate && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleReact("fire")}
                disabled={reactMutation.isPending}
                className={`flex items-center gap-1 px-1.5 py-1 text-xs font-bold transition-all ${
                  myReaction === "fire"
                    ? "text-orange-400 bg-orange-400/20 border border-orange-400/40"
                    : "text-white/30 hover:text-orange-400 hover:bg-orange-400/10 border border-transparent"
                }`}
                title="Fire 🔥"
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fire</span>
              </button>
              <button
                onClick={() => handleReact("trash")}
                disabled={reactMutation.isPending}
                className={`flex items-center gap-1 px-1.5 py-1 text-xs font-bold transition-all ${
                  myReaction === "trash"
                    ? "text-gray-400 bg-gray-400/20 border border-gray-400/40"
                    : "text-white/30 hover:text-gray-400 hover:bg-gray-400/10 border border-transparent"
                }`}
                title="Trash 🗑️"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trash</span>
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Volume toggle */}
            <button
              onClick={() => setShowVolume(v => !v)}
              className="text-white/40 hover:text-white transition-colors p-1 hidden sm:block"
              aria-label="Volume"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Prev (only when playlist has multiple tracks) */}
            {hasPlaylist && (
              <button
                onClick={prev}
                className="text-white/40 hover:text-white transition-colors p-1"
                aria-label="Previous"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            {/* Play/Pause */}
            <button
              onClick={isPlaying ? pause : resume}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <div className="w-3 h-3 border border-white/60 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              )}
            </button>

            {/* Next (only when playlist has multiple tracks) */}
            {hasPlaylist && (
              <button
                onClick={next}
                className="text-white/40 hover:text-white transition-colors p-1"
                aria-label="Next"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Stop */}
            <button
              onClick={stop}
              className="text-white/40 hover:text-red-500 transition-colors p-1"
              aria-label="Stop"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            {/* Queue toggle */}
            <button
              onClick={() => setShowQueue(v => !v)}
              className={`transition-colors p-1 ${showQueue ? "text-red-500" : "text-white/40 hover:text-white"}`}
              aria-label="Queue"
              title="Queue"
            >
              <List className="w-4 h-4" />
            </button>

            {/* Live Radio mode toggle */}
            <button
              onClick={() => setRadioMode(v => !v)}
              className={`transition-colors p-1 hidden sm:block ${radioMode ? "text-red-500" : "text-white/30 hover:text-red-400"}`}
              aria-label="Live Radio"
              title="Live Radio mode"
            >
              <Radio className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Volume slider */}
        {showVolume && (
          <div className="px-4 pb-2.5 flex items-center gap-3">
            <VolumeX className="w-3 h-3 text-white/30 flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-red-600 cursor-pointer"
            />
            <Volume2 className="w-3 h-3 text-white/30 flex-shrink-0" />
          </div>
        )}
      </div>
    </>
  );
}
