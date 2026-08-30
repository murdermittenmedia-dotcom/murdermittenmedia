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
  ChevronDown, ChevronUp, List, X, SkipBack, SkipForward, ExternalLink, Music2, Mic, MessageCircle,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { ArtistLink } from "@/components/ArtistLink";
import { useAdminMicBroadcast } from "@/hooks/useAdminMicBroadcast";
import { emitSeekBroadcast, emitPauseBroadcast, emitResumeBroadcast } from "@/contexts/RadioSeekBroadcastContext";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function FloatingPlayer() {
  const {
    track, playlist, playlistIndex, isPlaying, isLoading,
    volume, currentTime, duration, isLocallyMuted,
    pause, resume, stop, setVolume, seek, next, prev, playPlaylist,
    localMuteStream, localUnmuteStream, getAudioElement,
  } = useAudioPlayer();

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // Whether the current track is a live stream (admin-controlled)
  const isLiveStream = !!track?.isStream;
  // Listen for admin mic broadcast (listener side — non-admin users hear the admin's mic)
  const adminMicBroadcast = useAdminMicBroadcast({
    room: "music_review",
    isAdmin,
    enabled: !!track?.isStream, // only connect when a live stream is active
    username: user?.artistName || user?.name || "Listener",
    userId: user?.id,
    getAudioElement,
  });
  const [showVolume, setShowVolume] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [myReaction, setMyReaction] = useState<"fire" | "trash" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const { data: chatHistory } = trpc.chat.getHistory.useQuery(
    { room: "music_review" },
    { enabled: showExpanded, refetchInterval: showExpanded ? 10_000 : false }
  );
  const progressRef = useRef<HTMLDivElement>(null);

  // Whether the current live track is a YouTube submission
  const isYouTubeTrack = isLiveStream && !!track?.youtubeUrl;
  const [showYouTubeEmbed, setShowYouTubeEmbed] = useState(false);
  // Whether the viewer has tapped to unlock YouTube audio (bypasses browser autoplay block)
  const [ytUnlocked, setYtUnlocked] = useState(false);
  // Auto-show YouTube embed when a YouTube live track is loaded
  useEffect(() => {
    if (isYouTubeTrack) {
      setShowYouTubeEmbed(true);
      setYtUnlocked(false); // reset unlock state for each new track
    } else {
      setShowYouTubeEmbed(false);
      setYtUnlocked(false);
    }
  }, [isYouTubeTrack, track?.youtubeUrl]);

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

  // Admin can scrub live streams; regular viewers cannot
  const canScrub = !isLiveStream || isAdmin;

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    if (!canScrub || duration <= 0) return;
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
    const time = pct * duration;
    seek(time);
    emitSeekBroadcast(time);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!canScrub || duration <= 0) return;
    const pct = getProgressFromEvent(e);
    const time = pct * duration;
    seek(time);
    emitSeekBroadcast(time);
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!track) return null;

  const displayProgress = isDragging ? dragProgress * 100 : duration > 0 ? (currentTime / duration) * 100 : 0;
  const canRate = !!track.submissionId && !!user;
  const hasPlaylist = playlist.length > 1 && !isLiveStream;

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
      return u.searchParams.get("v");
    } catch { return null; }
  };

  return (
    <>
      {/* ── YouTube embed panel (for live YouTube tracks) ──────────────── */}
      {isYouTubeTrack && showYouTubeEmbed && track.youtubeUrl && (() => {
        const videoId = getYouTubeVideoId(track.youtubeUrl);
        if (!videoId) return null;
        return (
          <div className="fixed bottom-[72px] right-4 z-[99] w-72 sm:w-80 shadow-2xl border border-red-600/40 rounded-lg overflow-hidden bg-black">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0f0f0f] border-b border-white/10">
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-widest">
                <Radio className="w-3 h-3" />
                LIVE · YouTube
              </span>
              <button
                onClick={() => setShowYouTubeEmbed(false)}
                className="text-white/40 hover:text-white p-0.5 rounded transition-colors"
                aria-label="Close YouTube embed"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              {ytUnlocked ? (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={track.title}
                />
              ) : (
                /* Tap-to-watch overlay — required for browser autoplay with audio */
                <button
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black/90 hover:bg-black/70 transition-colors group cursor-pointer"
                  onClick={() => setYtUnlocked(true)}
                  aria-label="Tap to watch and listen"
                >
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg">
                    <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-white text-xs font-bold uppercase tracking-widest">Tap to Watch &amp; Listen</span>
                  <span className="text-white/40 text-[10px] mt-1">YouTube · Live Review</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {showExpanded && (
        <div className="fixed bottom-[72px] left-2 right-2 z-[101] max-h-[58vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0d0d0d]/95 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[420px] sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Expanded player</p><p className="mt-1 text-sm font-semibold text-white">{isLiveStream ? "Live room" : "Now playing"}</p></div>
            <button type="button" onClick={() => setShowExpanded(false)} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Close expanded player"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="truncate text-sm font-semibold text-white">{track.title}</p><p className="mt-1 truncate text-xs text-white/45">{track.artist ? <ArtistLink artistName={track.artist} userId={track.artistUserId ?? null} /> : "Murder Mitten Media"}</p><div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => handleReact("fire")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${myReaction === "fire" ? "border-orange-400/60 bg-orange-400/15 text-orange-300" : "border-white/10 text-white/55 hover:border-orange-400/40 hover:text-orange-300"}`}><Flame className="mr-1 inline h-3.5 w-3.5" /> Fire</button><button type="button" onClick={() => handleReact("trash")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${myReaction === "trash" ? "border-red-400/60 bg-red-400/15 text-red-300" : "border-white/10 text-white/55 hover:border-red-400/40 hover:text-red-300"}`}><Trash2 className="mr-1 inline h-3.5 w-3.5" /> Trash</button></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Queue</p><span className="text-[10px] text-white/30">{playlist.length}</span></div><div className="mt-2 max-h-32 space-y-2 overflow-y-auto">{playlist.length ? playlist.slice(0, 5).map((item, idx) => <button type="button" key={`${item.url}-${idx}`} onClick={() => !isLiveStream && playPlaylist(playlist, idx)} className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-xs ${idx === playlistIndex ? "bg-red-500/15 text-red-300" : "text-white/55 hover:bg-white/5 hover:text-white"}`}>{item.title}</button>) : <p className="text-xs text-white/30">Queue is empty</p>}</div></div><div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45"><MessageCircle className="h-3.5 w-3.5 text-red-400" /> Chat preview</p><div className="mt-2 max-h-32 space-y-2 overflow-y-auto">{Array.isArray(chatHistory) && chatHistory.length ? chatHistory.slice(-3).map((message: { id?: number | string; username?: string | null; userName?: string | null; content?: string | null; message?: string | null }, idx: number) => <div key={message.id ?? idx} className="text-xs"><span className="font-semibold text-white/65">{message.username ?? message.userName ?? "Listener"}</span><span className="ml-1 text-white/40">{message.content ?? message.message ?? ""}</span></div>) : <p className="text-xs text-white/30">No recent messages</p>}</div></div></div>
        </div>
      )}
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
        {/* ── Progress bar ──────────────────────────────────────────────────────── */}
        {isLiveStream && !isAdmin ? (
          /* Live stream (viewer): pulsing red bar, no scrubbing */
          <div className="w-full h-1.5 bg-red-600/60 animate-pulse" />
        ) : (
          /* Admin or non-stream: full scrubable progress bar */
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
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-red-500 text-xs font-bold flex items-center gap-1 flex-shrink-0">
                    <Radio className="w-3 h-3" />
                    LIVE
                  </span>
                  {adminMicBroadcast.isAdminMicLive && (
                    <span className="flex items-center gap-0.5 text-[10px] text-orange-400 font-bold flex-shrink-0 animate-pulse" title="Admin is speaking live">
                      <Mic className="w-2.5 h-2.5" />
                      MIC
                    </span>
                  )}
                  {track.artist && (
                    <ArtistStatModal artistName={track.artist} userId={track.artistUserId ?? null}>
                      <button className="text-white/50 hover:text-red-400 text-xs transition-colors flex items-center gap-1 min-w-0 truncate">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{track.artist}</span>
                      </button>
                    </ArtistStatModal>
                  )}
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

          {/* Playback controls */}
          {isLiveStream ? (
            /* Live stream controls */
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* YouTube toggle — shown only for YouTube live tracks */}
              {isYouTubeTrack && (
                <button
                  onClick={() => setShowYouTubeEmbed(v => !v)}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs font-bold ${
                    showYouTubeEmbed
                      ? "text-red-400 bg-red-500/20 border border-red-500/40"
                      : "text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent"
                  }`}
                  aria-label="Toggle YouTube embed"
                  title={showYouTubeEmbed ? "Hide video" : "Watch video"}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </button>
              )}

              {isAdmin ? (
                /* Admin: real pause/play that broadcasts to all listeners */
                <button
                  onClick={() => {
                    if (isPlaying) {
                      pause();
                      emitPauseBroadcast(currentTime);
                    } else {
                      resume();
                      emitResumeBroadcast(currentTime);
                    }
                  }}
                  disabled={isLoading}
                  className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg shadow-red-900/30 mx-0.5"
                  aria-label={isPlaying ? "Pause (broadcasts to all)" : "Play (broadcasts to all)"}
                  title={isPlaying ? "Pause for all listeners" : "Resume for all listeners"}
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
              ) : (
                /* Viewer: mute/unmute local only (disguised as Play/Stop) */
                <button
                  onClick={isLocallyMuted ? localUnmuteStream : localMuteStream}
                  disabled={isLoading}
                  className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg shadow-red-900/30 mx-0.5"
                  aria-label={isLocallyMuted ? "Play" : "Stop"}
                  title={isLocallyMuted ? "Play stream" : "Stop stream"}
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : isLocallyMuted ? (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              )}

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
                onClick={() => setShowExpanded((value) => !value)}
                className={`p-1.5 rounded-lg transition-colors ${showExpanded ? "text-red-500 bg-red-500/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                title="Expand player"
                aria-label="Expand player"
              >
                {showExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowQueue(!showQueue)}
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
