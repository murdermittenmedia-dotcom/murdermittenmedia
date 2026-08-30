import { FloatingWindow } from "@/components/FloatingWindow";
/* ============================================================
   MURDER MITTEN MEDIA — Music Review (V2 Major Redesign)
   Premium "Studio Control Room" aesthetic
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { LiveRadioBanner } from "@/components/LiveRadioBanner";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { ArtistLink } from "@/components/ArtistLink";
import { useChat, type LiveReviewActiveItem, type LiveReviewPlayback } from "@/hooks/useChat";
import { useAudioRoom } from "@/hooks/useAudioRoom";
import { useVideoRoom } from "@/hooks/useVideoRoom";
import { useAdminMicBroadcast } from "@/hooks/useAdminMicBroadcast";
import { shouldShowViewerCount } from "@/lib/musicReviewLive";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { SyncedYouTubePlayer } from "@/components/SyncedYouTubePlayer";
import { registerSeekBroadcast, registerPauseBroadcast, registerResumeBroadcast } from "@/contexts/RadioSeekBroadcastContext";
import { useFakeLiveChat } from "@/hooks/useFakeLiveChat";
import { MUSIC_REVIEW_FREE_SUBMISSION_LIMIT } from "@shared/music-review-paywall";

// Types inferred from tRPC query
type ReviewSubmission = { id: number; userId?: number | null; artistName: string; songTitle: string; submissionType: "youtube" | "file"; youtubeUrl: string | null; fileKey: string | null; fileUrl: string | null; contactInfo: string | null; status: "pending" | "playing" | "reviewed" | "removed"; skippedLine: boolean; skipPaymentConfirmed: boolean; position: number; notes: string | null; fireCount: number; trashCount: number; createdAt: Date; updatedAt: Date; cashappPaymentReceiptUrl?: string | null; paidSubmissionType?: "reentry5" | "reentry10" | "skip" | null };
type QueueState = {
  id: number;
  isLive: boolean;
  liveMessage: string | null;
  streamUrl: string | null;
  currentPlayingId: number | null;
  playbackMode?: "90sec" | "full" | "paid_only" | null;
  submitPriceCents?: number | null;
  skipPriceCents?: number | null;
  fullSongPriceCents?: number | null;
  autoSkipThreshold?: number | null;
  updatedAt: Date;
};
type QueueAllData = { submissions: ReviewSubmission[]; state: QueueState | null; currentPlaying: ReviewSubmission | null };

import {
  Mic, MicOff, Video, VideoOff, Radio, Play, Pause, SkipForward,
  Trash2, CheckCircle, ChevronDown, ChevronUp, Settings, Users,
  ExternalLink, Flame, ThumbsDown, Crown, AlertCircle, RotateCcw, Music,
  GripVertical, X, Send, LogIn, Headphones, Zap, Eye,
} from "lucide-react";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const CASHAPP = "$MittenMedia";
const PAYPAL = "MurderMittenPromo";
const APPLEPAY = "313-420-9004";

type SubmitTab = "queue" | "history" | "submit" | "skip-info";

// ── Helpers ───────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)(\w[\w-]{10})/)?.[1] ?? null;
}

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "In Queue", cls: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40" },
    playing: { label: "Playing", cls: "bg-red-600/30 text-red-400 border-red-600/60 animate-pulse" },
    reviewed: { label: "Reviewed", cls: "bg-green-600/20 text-green-400 border-green-600/40" },
    removed: { label: "Removed", cls: "bg-white/10 text-white/30 border-white/20" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-[10px] border px-1.5 py-0.5 uppercase tracking-wider font-semibold rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Admin Panel ───────────────────────────────────────────────
function AdminPanel({
  data, refetch, audioRoom, videoRoom, broadcastReviewActive, broadcastRadioPause, broadcastRadioResume, broadcastRadioSeek, broadcastReviewPlayback, broadcastReviewQueueUpdated, broadcastLastSong, adminMicBroadcast, playTrack, setSelectedYouTube, reviewedTracks, triggerReaction,
  commentIntervalMs, setCommentIntervalMs, viewerMin, setViewerMin, viewerMax, setViewerMax,
  ghostFireCount, setGhostFireCount, ghostTrashCount, setGhostTrashCount,
  ghostFireIntervalSec, setGhostFireIntervalSec, ghostTrashIntervalSec, setGhostTrashIntervalSec,
  sentimentBias, setSentimentBias, viewerCountVisible, setViewerCountVisible,
}: {
  data: QueueAllData | undefined;
  refetch: () => void;
  audioRoom: ReturnType<typeof useAudioRoom>;
  videoRoom: ReturnType<typeof useVideoRoom>;
  broadcastReviewActive: (item: { submissionId: number | null; userId?: number | null; artistName?: string; songTitle?: string; audioUrl?: string | null; youtubeUrl?: string | null; submissionType?: string; fileKey?: string | null; fileUrl?: string | null }) => void;
  broadcastRadioPause: (currentTime: number) => void;
  broadcastRadioResume: (currentTime: number) => void;
  broadcastRadioSeek: (currentTime: number) => void;
  broadcastReviewPlayback: (data: { action: "play" | "pause" | "replay" | "skip" | "next"; currentTime?: number }) => void;
  broadcastReviewQueueUpdated: () => void;
  broadcastLastSong: () => void;
  adminMicBroadcast: ReturnType<typeof import("@/hooks/useAdminMicBroadcast").useAdminMicBroadcast>;
  playTrack: (sub: ReviewSubmission) => void;
  setSelectedYouTube: (val: { url: string; title: string; artist: string } | null) => void;
  reviewedTracks?: ReviewSubmission[];
  triggerReaction: (reaction: "hype" | "trash" | "knife" | "bars" | "weak" | "next", duration?: number) => void;
  commentIntervalMs: number;
  setCommentIntervalMs: (v: number) => void;
  viewerMin: number;
  setViewerMin: (v: number) => void;
  viewerMax: number;
  setViewerMax: (v: number) => void;
  ghostFireCount: number;
  setGhostFireCount: (v: number) => void;
  ghostTrashCount: number;
  setGhostTrashCount: (v: number) => void;
  ghostFireIntervalSec: number;
  setGhostFireIntervalSec: (v: number) => void;
  ghostTrashIntervalSec: number;
  setGhostTrashIntervalSec: (v: number) => void;
  sentimentBias: number;
  setSentimentBias: (v: number) => void;
  viewerCountVisible: boolean;
  setViewerCountVisible: (v: boolean) => void;
}) {
  const [streamUrlInput, setStreamUrlInput] = useState(data?.state?.streamUrl ?? "");
  const [liveMsg, setLiveMsg] = useState(data?.state?.liveMessage ?? "");
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);
  const audioPlayer = useAudioPlayer();
  const { user: currentUser } = useAuth();
  const isJudge = currentUser?.role === "judge" || currentUser?.role === "admin";

  const setLive = trpc.queue.setLive.useMutation({ onSuccess: () => refetch() });
  const setPlaying = trpc.queue.setPlaying.useMutation({ onSuccess: () => refetch() });
  const updateStatus = trpc.queue.updateStatus.useMutation({ onSuccess: () => refetch() });
  const confirmSkip = trpc.queue.confirmSkip.useMutation({ onSuccess: () => refetch() });
  const setPlaybackMode = trpc.queue.setPlaybackMode.useMutation({
    onSuccess: () => { refetch(); toast.success("Playback mode updated"); },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });
  const [submitPriceDollars, setSubmitPriceDollars] = useState(String((data?.state?.submitPriceCents ?? 0) / 100));
  const [skipPriceDollars, setSkipPriceDollars] = useState(String((data?.state?.skipPriceCents ?? 1500) / 100));
  const [fullSongPriceDollars, setFullSongPriceDollars] = useState(String((data?.state?.fullSongPriceCents ?? 500) / 100));
  const [autoSkipThreshold, setAutoSkipThreshold] = useState(String(data?.state?.autoSkipThreshold ?? 0));
  const requeueMutation = trpc.queue.requeue.useMutation({
    onSuccess: () => { refetch(); broadcastReviewQueueUpdated(); toast.success("Song re-queued"); },
    onError: () => toast.error("Failed to re-queue song"),
  });

  const isLive = data?.state?.isLive ?? false;
  const currentPlaying = data?.currentPlaying;
   const queue: ReviewSubmission[] = data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? [];
  const queueKey = JSON.stringify(queue.map(s => s.id + ':' + s.status + ':' + s.position));
  // Drag-to-reorder state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [localQueue, setLocalQueue] = useState<ReviewSubmission[]>([]);
  const localQueueRef = useRef<ReviewSubmission[]>([]);
  localQueueRef.current = localQueue;
  useEffect(() => {
    if (draggedId === null) setLocalQueue(queue);
  }, [queueKey, draggedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reorderMutation = trpc.queue.reorder.useMutation({
    onSuccess: () => { refetch(); broadcastReviewQueueUpdated(); },
    onError: () => { toast.error("Failed to reorder queue"); setLocalQueue(queue); },
  });

  const handleDragStart = (id: number) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;
    const newQueue = [...localQueue];
    const fromIdx = newQueue.findIndex(s => s.id === draggedId);
    const toIdx = newQueue.findIndex(s => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = newQueue.splice(fromIdx, 1);
    newQueue.splice(toIdx, 0, moved);
    setLocalQueue(newQueue);
  };
  const handleDrop = () => {
    setDraggedId(null);
    reorderMutation.mutate({ orderedIds: localQueue.map(s => s.id) });
  };

  const pendingSkips: ReviewSubmission[] = data?.submissions?.filter((s: ReviewSubmission) => s.skippedLine && !s.skipPaymentConfirmed && s.status === "pending") ?? [];

  const handleGoLive = () => {
    setLive.mutate({ isLive: !isLive, message: liveMsg || undefined, streamUrl: streamUrlInput || undefined });
    toast.success(isLive ? "Stream ended" : "You're now live!");
  };

  const currentIsYouTube = currentPlaying?.submissionType === "youtube";

  const handleSetPlaying = async (id: number) => {
    const sub = localQueue.find(s => s.id === id) ?? queue.find(s => s.id === id);
    if (!sub) return;
    setSelectedYouTube(null);
    setPlaying.mutate({ submissionId: id }, {
      onSuccess: () => {
        playTrack(sub);
        broadcastReviewActive({
          submissionId: sub.id,
          userId: sub.userId ?? null,
          artistName: sub.artistName,
          songTitle: sub.songTitle,
          audioUrl: null,
          youtubeUrl: sub.youtubeUrl ?? null,
          submissionType: sub.submissionType,
          fileKey: sub.fileKey ?? null,
          fileUrl: sub.fileUrl ?? null,
        });
        broadcastReviewQueueUpdated();
        toast.success(`Now playing: ${sub.songTitle}`);
      },
      onError: (err) => toast.error("Failed to set playing: " + err.message),
    });
  };

  const advanceToNext = (skipId: number) => {
    const pendingInOrder = localQueue.filter(s => s.status === "pending" && s.id !== skipId);
    const next = pendingInOrder[0] ?? null;
    setSelectedYouTube(null);
    if (next) {
      setTimeout(() => {
        setPlaying.mutate({ submissionId: next.id }, {
          onSuccess: () => {
            playTrack(next);
            broadcastReviewActive({
              submissionId: next.id,
              userId: next.userId ?? null,
              artistName: next.artistName,
              songTitle: next.songTitle,
              audioUrl: null,
              youtubeUrl: next.youtubeUrl ?? null,
              submissionType: next.submissionType,
              fileKey: next.fileKey ?? null,
              fileUrl: next.fileUrl ?? null,
            });
            broadcastReviewQueueUpdated();
            toast.success(`▶ Auto-advancing to: ${next.songTitle}`);
          }
        });
      }, 400);
    } else {
      setPlaying.mutate({ submissionId: null }, {
        onSuccess: () => {
          broadcastReviewActive({ submissionId: null });
          broadcastReviewQueueUpdated();
          toast("Queue finished — all tracks reviewed!");
        }
      });
    }
  };

  const handleSkip = async () => {
    if (!currentPlaying) return;
    updateStatus.mutate({ id: currentPlaying.id, status: "reviewed" });
    advanceToNext(currentPlaying.id);
    broadcastReviewPlayback({ action: "skip" });
    toast.success("Skipped to next track");
  };

  const handleRemove = (id: number) => {
    updateStatus.mutate({ id, status: "removed" });
    toast.success("Removed from queue");
  };

  const updateStatusRef = useRef(updateStatus);
  updateStatusRef.current = updateStatus;
  const advanceToNextRef = useRef(advanceToNext);
  advanceToNextRef.current = advanceToNext;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  // ── 90-second cap: auto-advance when mode is "90sec" and track is not paid ──
  const playbackMode = data?.state?.playbackMode ?? "90sec";
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    if (playbackMode !== "90sec") return;
    const cp = dataRef.current?.currentPlaying;
    if (!cp) return;
    // If the submission is a paid full-song submission, skip the cap
    const isPaid = !!(cp as any).isPaidSubmission || (cp as any).paidSubmissionType === "reentry5" || (cp as any).paidSubmissionType === "reentry10";
    if (isPaid) return;
    // Only cap audio file tracks (YouTube is capped by the player itself)
    if (cp.submissionType !== "file") return;
    const audioEl = audioPlayer.getAudioElement?.();
    if (!audioEl) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const checkTime = () => {
      if (audioEl.currentTime >= 90) {
        // Auto-advance
        updateStatusRef.current.mutate({ id: cp.id, status: "reviewed" }, {
          onSuccess: () => {
            refetchRef.current();
            advanceToNextRef.current(cp.id);
          }
        });
      } else {
        const remaining = 90 - audioEl.currentTime;
        timer = setTimeout(checkTime, remaining * 1000);
      }
    };
    const onPlay = () => {
      if (timer) clearTimeout(timer);
      if (audioEl.currentTime < 90) {
        const remaining = 90 - audioEl.currentTime;
        timer = setTimeout(checkTime, remaining * 1000);
      }
    };
    const onPause = () => { if (timer) clearTimeout(timer); };
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    // Start immediately if already playing
    if (!audioEl.paused && audioEl.currentTime < 90) {
      const remaining = 90 - audioEl.currentTime;
      timer = setTimeout(checkTime, remaining * 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("pause", onPause);
    };
  }, [playbackMode, data?.currentPlaying?.id, audioPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsubscribe = audioPlayer.onEnded((finishedTrack) => {
      if (!finishedTrack.isStream || finishedTrack.sourcePage !== "Music Review") return;
      const currentQueue = localQueueRef.current;
      const match = currentQueue.find(
        s => (s.status === "pending" || s.status === "playing") &&
          s.songTitle === finishedTrack.title &&
          s.artistName === finishedTrack.artist
      );
      if (!match) return;
      updateStatusRef.current.mutate({ id: match.id, status: "reviewed" }, {
        onSuccess: () => {
          refetchRef.current();
          advanceToNextRef.current(match.id);
        }
      });
    });
    return unsubscribe;
  }, [audioPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl overflow-hidden mb-5 border border-red-600/30 bg-gradient-to-b from-[#1a0000] to-[#0a0000] shadow-[0_0_30px_rgba(209,0,0,0.08)]">
      {/* ── Admin header bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-600/15 via-red-600/5 to-transparent border-b border-red-600/20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-red-400 text-xs uppercase tracking-[0.2em] font-bold">Control Board</span>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">On Air</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-white text-xs font-bold uppercase tracking-wider">Live session controls</p><p className="mt-1 text-[10px] text-white/40">Set the room state first, then manage playback and audience tools below.</p></div>
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${isLive ? "text-green-400" : "text-white/35"}`}>{isLive ? "On air" : "Offline"}</span>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300/70">Broadcast state</div>
        {/* ── Row 1: Go Live + Stream URL ── */}
        <div className="flex gap-2 items-stretch">
          <button
            type="button"
            aria-label={isLive ? "End live session" : "Start live session"}
            onClick={handleGoLive}
            disabled={setLive.isPending}
            className={`flex-shrink-0 px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
              isLive
                ? "bg-red-600/20 border border-red-600/50 text-red-400 hover:bg-red-600/30"
                : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-[0_0_20px_rgba(209,0,0,0.4)]"
            }`}
          >
            {isLive ? "⏹ End" : "🔴 Go Live"}
          </button>
          <input
            type="url"
            value={streamUrlInput}
            onChange={e => setStreamUrlInput(e.target.value)}
            placeholder="Stream URL (YouTube Live / HLS)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20 min-w-0"
          />
          <button
            type="button"
            aria-label="Toggle stream settings"
            onClick={() => setShowStreamSettings(v => !v)}
            className="border border-white/15 rounded-lg text-white/40 hover:text-white hover:border-white/30 px-3 transition-all flex-shrink-0"
            title="More stream settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stream settings (collapsible) */}
        {showStreamSettings && (
          <div className="border border-white/10 bg-black/40 rounded-lg p-3 space-y-2">
            <div>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Live Message</label>
              <input
                type="text"
                value={liveMsg}
                onChange={e => setLiveMsg(e.target.value)}
                placeholder="e.g. Submitting tracks now — drop yours below!"
                className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20"
              />
            </div>
            <button
              onClick={() => {
                setLive.mutate({ isLive, message: liveMsg || undefined, streamUrl: streamUrlInput || undefined });
                toast.success("Settings saved");
              }}
              className="w-full border border-white/15 rounded-lg text-white/60 hover:text-white py-1.5 text-xs uppercase tracking-widest transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}

        </div>

        {/* ── Row 2: Mic / Camera / Mic→Radio ── */}
        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/70">Audio routing</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={audioRoom.toggleMic}
            className={`flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all ${
              audioRoom.isMuted
                ? "border-white/15 text-white/40 hover:border-white/30"
                : "border-green-500/50 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
            }`}
          >
            {audioRoom.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            {audioRoom.isMuted ? "Mic Off" : "Mic On"}
          </button>
          <button
            onClick={videoRoom.toggleCamera}
            className={`flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all ${
              videoRoom.cameraActive
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                : "border-white/15 text-white/40 hover:border-white/30"
            }`}
          >
            {videoRoom.cameraActive ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
            {videoRoom.cameraActive ? "Cam On" : "Cam Off"}
          </button>
          <button
            onClick={async () => {
              try {
                await adminMicBroadcast.toggleBroadcast();
                if (!adminMicBroadcast.isBroadcasting) {
                  toast.success("🎙 Mic broadcasting to radio");
                } else {
                  toast("Mic broadcast stopped");
                }
              } catch {
                toast.error("Could not access microphone");
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border transition-all ${
              adminMicBroadcast.isBroadcasting
                ? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse shadow-[0_0_10px_rgba(209,0,0,0.2)]"
                : "border-white/15 text-white/40 hover:border-red-500/40 hover:text-red-400"
            }`}
            title={adminMicBroadcast.isBroadcasting ? "Stop mic broadcast" : "Broadcast mic to radio"}
          >
            {adminMicBroadcast.isBroadcasting ? <Mic className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
            {adminMicBroadcast.isBroadcasting ? "Mic Live" : "Mic→Radio"}
          </button>
        </div>

        </div>

        {/* ── Reaction triggers (admin only) ── */}
        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300/70">Audience reactions</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => triggerReaction("hype", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-orange-500/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all"
            title="Flood chat with fire emojis"
          >
            🔥 Hype
          </button>
          <button
            onClick={() => triggerReaction("trash", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            title="Flood chat with trash emojis"
          >
            🗑️ Trash
          </button>
          <button
            onClick={() => triggerReaction("knife", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-purple-500/50 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
            title="Flood chat with knife emojis"
          >
            🔪 Knife
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => triggerReaction("bars", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all"
            title="Flood chat with bars reactions"
          >
            🎵 Bars
          </button>
          <button
            onClick={() => triggerReaction("weak", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-gray-500/50 bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-all"
            title="Flood chat with weak reactions"
          >
            😴 Weak
          </button>
          <button
            onClick={() => triggerReaction("next", 3000)}
            className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
            title="Flood chat with skip reactions"
          >
            ⏭️ Next
          </button>
        </div>

        </div>

        {/* ── Chat & Viewer Controls ── */}
        <div className="border border-white/10 bg-white/[0.02] rounded-lg p-3 space-y-3">
          <div className="text-white/40 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <span>💬</span> Chat &amp; Viewer Controls
          </div>

          {/* Comment speed slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Comment Speed</span>
              <span className="text-white/70 text-[10px] font-mono">
                {commentIntervalMs >= 1000
                  ? `${(commentIntervalMs / 1000).toFixed(1)}s`
                  : `${commentIntervalMs}ms`
                } / msg
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">Fast</span>
              <input
                type="range"
                min={500}
                max={30000}
                step={500}
                value={commentIntervalMs}
                onChange={e => setCommentIntervalMs(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-red-500 cursor-pointer"
              />
              <span className="text-[9px] text-white/30">Slow</span>
            </div>
          </div>

          {/* Viewer count range slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Viewer Range</span>
              <span className="text-white/70 text-[10px] font-mono">{viewerMin}–{viewerMax}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">Min</span>
              <input
                type="range"
                min={10}
                max={viewerMax - 10}
                step={10}
                value={viewerMin}
                onChange={e => setViewerMin(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
              />
              <span className="text-[9px] text-white/30">{viewerMin}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">Max</span>
              <input
                type="range"
                min={viewerMin + 10}
                max={5000}
                step={10}
                value={viewerMax}
                onChange={e => setViewerMax(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-green-500 cursor-pointer"
              />
               <span className="text-[9px] text-white/30">{viewerMax}</span>
            </div>
          </div>
          {/* Ghost Fire votes — speed slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Ghost 🔥 Fire Speed</span>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-[10px] font-mono font-bold">
                  {ghostFireIntervalSec === 0 ? "OFF" : `every ${ghostFireIntervalSec}s`}
                </span>
                <span className="text-orange-300/60 text-[10px]">({ghostFireCount} added)</span>
                <button onClick={() => setGhostFireCount(0)} className="text-[9px] text-white/30 hover:text-white/60 border border-white/10 px-1 rounded">reset</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">off</span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={ghostFireIntervalSec}
                onChange={e => setGhostFireIntervalSec(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-orange-500 cursor-pointer"
              />
              <span className="text-[9px] text-white/30">1s</span>
            </div>
          </div>
          {/* Ghost Trash votes — speed slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Ghost 🗑️ Trash Speed</span>
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-[10px] font-mono font-bold">
                  {ghostTrashIntervalSec === 0 ? "OFF" : `every ${ghostTrashIntervalSec}s`}
                </span>
                <span className="text-blue-300/60 text-[10px]">({ghostTrashCount} added)</span>
                <button onClick={() => setGhostTrashCount(0)} className="text-[9px] text-white/30 hover:text-white/60 border border-white/10 px-1 rounded">reset</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30">off</span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={ghostTrashIntervalSec}
                onChange={e => setGhostTrashIntervalSec(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-blue-500 cursor-pointer"
              />
              <span className="text-[9px] text-white/30">1s</span>
            </div>
          </div>
        </div>

        {/* ── Comment Sentiment ── */}
        <div className="border border-white/10 bg-white/[0.02] rounded-lg p-3 space-y-2">
          <div className="text-white/60 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <span>💬</span> Comment Vibe
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-[10px] uppercase tracking-wider">Sentiment Bias</span>
            <span className={`text-[10px] font-bold font-mono ${
              sentimentBias >= 70 ? "text-orange-400" : sentimentBias <= 30 ? "text-blue-400" : "text-white/60"
            }`}>
              {sentimentBias >= 80 ? "🔥 Super Fire" : sentimentBias >= 60 ? "🔥 Mostly Fire" : sentimentBias >= 45 ? "⚖️ Mixed" : sentimentBias >= 25 ? "🗑️ Mostly Trash" : "🗑️ Super Trash"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-blue-400">🗑️</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={sentimentBias}
              onChange={e => setSentimentBias(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: sentimentBias >= 50 ? "#f97316" : "#60a5fa" }}
            />
            <span className="text-[9px] text-orange-400">🔥</span>
          </div>
          <p className="text-white/20 text-[9px]">Controls the ratio of fire vs trash auto-comments. Middle = even mix.</p>
        </div>

        {/* ── Playback Mode ── */}
        <div className="border border-white/10 bg-white/[0.02] rounded-lg p-3 space-y-3">
          <div className="text-white/60 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <span>🎵</span> Playback Mode
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { id: "90sec" as const, label: "90s Cap", desc: "Free=90s, paid=full", color: "orange" },
              { id: "full" as const, label: "Full Song", desc: "All hear full song", color: "green" },
              { id: "paid_only" as const, label: "Paid Only", desc: "Requires payment", color: "red" },
            ]).map(mode => {
              const active = (data?.state?.playbackMode ?? "90sec") === mode.id;
              const colorMap: Record<string, string> = {
                orange: "border-orange-500 bg-orange-500/20 text-orange-300",
                green: "border-green-500 bg-green-500/20 text-green-300",
                red: "border-red-500 bg-red-500/20 text-red-300",
              };
              return (
                <button
                  key={mode.id}
                  onClick={() => setPlaybackMode.mutate({ playbackMode: mode.id })}
                  disabled={setPlaybackMode.isPending}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                    active ? colorMap[mode.color] : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/30"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide">{mode.label}</span>
                  <span className="text-[9px] mt-0.5 opacity-70">{mode.desc}</span>
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <div className="text-white/40 text-[9px] uppercase tracking-wider">Pricing (CashApp)</div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="space-y-1">
                <label className="text-[9px] text-white/40">Submit fee ($)</label>
                <div className="flex gap-1">
                  <input type="number" min={0} step={0.5} value={submitPriceDollars}
                    onChange={e => setSubmitPriceDollars(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-white text-[11px] focus:outline-none focus:border-white/30" />
                  <button
                    onClick={() => setPlaybackMode.mutate({ playbackMode: data?.state?.playbackMode ?? "90sec", submitPriceCents: Math.round(parseFloat(submitPriceDollars || "0") * 100) })}
                    className="text-[9px] bg-white/10 hover:bg-white/20 px-1.5 rounded text-white/60">✓</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-white/40">Skip fee ($)</label>
                <div className="flex gap-1">
                  <input type="number" min={0} step={0.5} value={skipPriceDollars}
                    onChange={e => setSkipPriceDollars(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-white text-[11px] focus:outline-none focus:border-white/30" />
                  <button
                    onClick={() => setPlaybackMode.mutate({ playbackMode: data?.state?.playbackMode ?? "90sec", skipPriceCents: Math.round(parseFloat(skipPriceDollars || "0") * 100) })}
                    className="text-[9px] bg-white/10 hover:bg-white/20 px-1.5 rounded text-white/60">✓</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-white/40">Full song ($)</label>
                <div className="flex gap-1">
                  <input type="number" min={0} step={0.5} value={fullSongPriceDollars}
                    onChange={e => setFullSongPriceDollars(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-white text-[11px] focus:outline-none focus:border-white/30" />
                  <button
                    onClick={() => setPlaybackMode.mutate({ playbackMode: data?.state?.playbackMode ?? "90sec", fullSongPriceCents: Math.round(parseFloat(fullSongPriceDollars || "0") * 100) })}
                    className="text-[9px] bg-white/10 hover:bg-white/20 px-1.5 rounded text-white/60">✓</button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div>
              <div className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">Automatic Vote To Skip</div>
              <div className="text-white/30 text-[10px] mt-0.5">Set 0 to require manual admin action.</div>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100000}
                value={autoSkipThreshold}
                onChange={(event) => setAutoSkipThreshold(event.target.value)}
                className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-center text-[11px] text-white focus:border-white/30 focus:outline-none"
                aria-label="Automatic Vote To Skip threshold"
              />
              <button
                type="button"
                onClick={() => setPlaybackMode.mutate({ playbackMode: data?.state?.playbackMode ?? "90sec", autoSkipThreshold: Math.max(0, Math.floor(Number(autoSkipThreshold) || 0)) })}
                className="rounded bg-white/10 px-2 py-1 text-[9px] text-white/60 hover:bg-white/20"
              >✓</button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div>
              <div className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">Viewer count display</div>
              <div className="text-white/30 text-[10px] mt-0.5">Show the aesthetic viewer number only while the review is live.</div>
            </div>
            <button
              type="button"
              onClick={() => setViewerCountVisible(!viewerCountVisible)}
              className={`relative h-6 w-11 rounded-full border transition-colors ${viewerCountVisible ? "border-red-500 bg-red-600" : "border-white/20 bg-white/10"}`}
              aria-pressed={viewerCountVisible}
              aria-label={viewerCountVisible ? "Hide viewer count" : "Show viewer count"}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${viewerCountVisible ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        {/* ── Pending skip payments ── */}
        {pendingSkips.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3">
            <div className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingSkips.length} Unconfirmed Skip{pendingSkips.length > 1 ? "s" : ""}
            </div>
            {pendingSkips.map(s => {
              const skipLabel = s.paidSubmissionType === "reentry5" ? "5 Spots Up ($5)" : s.paidSubmissionType === "reentry10" ? "10 Spots Up ($10)" : "Skip to Front ($20)";
              return (
                <div key={s.id} className="py-2 border-t border-yellow-500/10 first:border-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div>
                      <span className="text-white text-xs font-semibold">{s.artistName}</span>
                      <span className="text-white/40 text-[10px] ml-2">— {s.songTitle}</span>
                      <span className="text-yellow-400 text-[10px] ml-2 font-bold">{skipLabel}</span>
                    </div>
                    <button
                      onClick={() => { confirmSkip.mutate({ id: s.id, skipType: s.paidSubmissionType ?? "skip" }); toast.success("Skip confirmed — queue updated"); }}
                      className="text-[10px] bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase hover:bg-yellow-400 transition-colors flex-shrink-0"
                    >
                      ✓ Confirm
                    </button>
                  </div>
                  {s.cashappPaymentReceiptUrl && (
                    <a href={s.cashappPaymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline break-all">
                      📄 View Receipt
                    </a>
                  )}
                  {s.contactInfo && <div className="text-white/30 text-[10px] mt-0.5">Contact: {s.contactInfo}</div>}
                </div>
              );
            })}  
          </div>
        )}

        {/* ── Now Playing card ── */}
        {currentPlaying ? (
          <div className="rounded-lg border border-red-600/40 bg-gradient-to-r from-red-600/10 to-transparent p-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-red-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Now Playing
              </span>
            </div>
            <div className="text-white font-semibold text-sm truncate mb-0.5">{currentPlaying.songTitle}</div>
            <div className="text-white/50 text-xs mb-2.5">by <ArtistLink artistName={currentPlaying.artistName} userId={currentPlaying.userId} /></div>
            {/* Transport controls */}
            {currentIsYouTube ? (
              <div className="space-y-2">
                <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-2 text-[10px] text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  YouTube — synced to viewers
                </div>
                {currentPlaying.youtubeUrl && (() => {
                  const ytId = extractYouTubeId(currentPlaying.youtubeUrl!);
                  return ytId ? (
                    <SyncedYouTubePlayer
                      videoId={ytId}
                      submissionId={currentPlaying.id}
                      isAdmin={true}
                      className="border border-white/10 rounded-lg overflow-hidden"
                    />
                  ) : null;
                })()}
                {isJudge ? (
                  <button
                    onClick={handleSkip}
                    className="w-full flex items-center justify-center gap-1.5 border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Done — Next Track
                  </button>
                ) : (
                  <div className="w-full p-2 border border-red-500/30 bg-red-500/5 rounded-lg text-red-400 text-[10px] text-center uppercase tracking-wider">
                    Judges Only
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => { audioPlayer.pause(); broadcastRadioPause(audioPlayer.currentTime); }}
                  className="flex items-center justify-center gap-1 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 rounded-lg py-2 text-[10px] uppercase tracking-wider transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
                <button
                  onClick={() => { audioPlayer.resume(); broadcastRadioResume(audioPlayer.currentTime); }}
                  className="flex items-center justify-center gap-1 border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-lg py-2 text-[10px] uppercase tracking-wider transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Play
                </button>
                <button
                  onClick={() => { audioPlayer.seek(0); broadcastRadioSeek(0); }}
                  className="flex items-center justify-center gap-1 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-lg py-2 text-[10px] uppercase tracking-wider transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Rewind
                </button>
                {isJudge ? (
                  <button
                    onClick={handleSkip}
                    className="flex items-center justify-center gap-1 border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-lg py-2 text-[10px] uppercase tracking-wider transition-colors"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-1 border border-white/10 text-white/20 rounded-lg py-2 text-[10px] uppercase tracking-wider cursor-not-allowed"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-white/10 bg-white/[0.02] rounded-lg p-3 text-center">
            <span className="text-white/30 text-xs uppercase tracking-wider">No track loaded — select from queue</span>
          </div>
        )}

        {/* ── Queue with drag handles ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">
              Queue ({localQueue.length})
            </span>
            <span className="text-white/20 text-[10px]">Drag to reorder</span>
          </div>
          {localQueue.length === 0 ? (
            <div className="text-center py-4 text-white/20 text-xs border border-white/10 rounded-lg">Queue is empty</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {localQueue.map((sub, i) => (
                <div
                  key={sub.id}
                  draggable
                  onDragStart={() => handleDragStart(sub.id)}
                  onDragOver={(e) => handleDragOver(e, sub.id)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center gap-2 p-2 border rounded-lg text-xs cursor-grab active:cursor-grabbing transition-all ${
                    draggedId === sub.id ? "opacity-30 scale-95" :
                    sub.status === "playing"
                      ? "border-red-600/50 bg-red-600/10"
                      : sub.skipPaymentConfirmed
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <GripVertical className="w-3 h-3 text-white/20 flex-shrink-0" />
                  <span className="text-white/30 w-4 text-center flex-shrink-0 font-mono text-[10px]">
                    {sub.status === "playing" ? "▶" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate text-[11px]">{sub.songTitle}</div>
                    <div className="text-white/40 truncate text-[10px]">
                      <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                    </div>
                  </div>
                  {sub.skippedLine && (
                    <span className={`text-[10px] font-bold flex-shrink-0 ${sub.skipPaymentConfirmed ? "text-yellow-400" : "text-yellow-600"}`}>⚡</span>
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    {sub.status !== "playing" && (
                      <button
                        onClick={() => handleSetPlaying(sub.id)}
                        className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-green-500/40 text-green-400 hover:bg-green-500/10 rounded px-1.5 py-0.5 transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" /> Load
                      </button>
                    )}
                    {sub.status === "playing" && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-red-500/40 text-red-400 rounded px-1.5 py-0.5">
                        ▶ Live
                      </span>
                    )}
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="text-white/20 hover:text-red-400 transition-colors p-0.5"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Previously Reviewed (collapsible) ── */}
        {reviewedTracks && reviewedTracks.length > 0 && (
          <div>
            <button
              onClick={() => setShowReviewed(v => !v)}
              className="flex items-center justify-between w-full text-white/40 text-[10px] uppercase tracking-wider hover:text-white/60 transition-colors py-1"
            >
              <span>Previously Reviewed ({reviewedTracks.length})</span>
              {showReviewed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showReviewed && (
              <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                {reviewedTracks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 p-2 border border-white/10 bg-white/[0.02] rounded-lg text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate text-[11px]">{sub.songTitle}</div>
                      <div className="text-white/40 truncate text-[10px]">{sub.artistName}</div>
                    </div>
                    <button
                      onClick={() => {
                        playTrack(sub);
                        broadcastReviewActive({
                          submissionId: sub.id,
                          userId: sub.userId ?? null,
                          artistName: sub.artistName,
                          songTitle: sub.songTitle,
                          audioUrl: null,
                          youtubeUrl: sub.youtubeUrl ?? null,
                          submissionType: sub.submissionType,
                          fileKey: sub.fileKey ?? null,
                          fileUrl: sub.fileUrl ?? null,
                        });
                        toast.success(`Loading: ${sub.songTitle}`);
                      }}
                      className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 rounded px-1.5 py-0.5 transition-colors flex-shrink-0"
                    >
                      <Play className="w-2.5 h-2.5" /> Load
                    </button>
                    <button
                      onClick={() => requeueMutation.mutate({ id: sub.id })}
                      disabled={requeueMutation.isPending}
                      className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-yellow-500 hover:text-yellow-400 rounded px-1.5 py-0.5 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Re-q
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Participants ── */}
        {audioRoom.participants.filter(p => p.role !== "viewer").length > 0 && (
          <div>
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Room ({audioRoom.participants.filter(p => p.role !== "viewer").length})
            </div>
            <div className="space-y-1">
              {audioRoom.participants.filter(p => p.role !== "viewer").map(p => (
                <div key={p.socketId} className="flex items-center gap-2 p-2 border border-white/10 bg-white/[0.02] rounded-lg text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.micActive ? "bg-green-400" : "bg-white/20"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-semibold text-[11px]">{p.username}</span>
                    <span className={`ml-2 text-[10px] uppercase font-bold ${
                      p.role === "judge" ? "text-yellow-400" : p.role === "admin" ? "text-red-400" : "text-white/40"
                    }`}>{p.role}</span>
                  </div>
                  <button
                    onClick={() => audioRoom.adminToggleParticipantMic(p.socketId, !p.micActive)}
                    className={`flex items-center gap-1 px-2 py-1 border rounded text-[10px] uppercase font-bold transition-colors ${
                      p.micActive
                        ? "border-green-500/40 text-green-400 hover:bg-red-600/10 hover:border-red-600/40 hover:text-red-400"
                        : "border-white/20 text-white/30 hover:border-green-500/40 hover:text-green-400"
                    }`}
                  >
                    {p.micActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    {p.micActive ? "Live" : "Muted"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fire/Trash Poll (Redesigned) ─────────────────────────────
function FireTrashPoll({
  submissionId,
  songTitle,
  artistName,
  artistUserId,
  fireCount,
  trashCount,
  myReaction,
  onVote,
  isPending,
  user,
}: {
  submissionId: number;
  songTitle: string;
  artistName: string;
  artistUserId?: number | null;
  fireCount: number;
  trashCount: number;
  myReaction: string | null;
  onVote: (reaction: "fire" | "trash") => void;
  isPending: boolean;
  user: { id: number } | null;
}) {
  const total = fireCount + trashCount;
  const firePct = total > 0 ? Math.round((fireCount / total) * 100) : 50;
  const trashPct = total > 0 ? 100 - firePct : 50;
  const hasVoted = !!myReaction;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <span className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-semibold">Rate This Track</span>
        {hasVoted && (
          <span className="text-[10px] font-semibold">
            {myReaction === "fire" ? <span className="text-orange-400">🔥 You voted Fire</span> : <span className="text-blue-400">🗑️ You voted Trash</span>}
          </span>
        )}
      </div>

      {/* Vote buttons */}
      <div className="grid grid-cols-2 divide-x divide-white/10">
        <button
          onClick={() => {
            if (!user) { toast.error("Login to vote"); return; }
            if (hasVoted) { toast.error("You already voted!"); return; }
            onVote("fire");
          }}
          disabled={hasVoted || isPending}
          className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
            myReaction === "fire" ? "bg-orange-500/20 cursor-default" :
            hasVoted ? "opacity-40 cursor-not-allowed" :
            "hover:bg-orange-500/10 active:bg-orange-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-5xl transition-transform duration-200 select-none ${
            myReaction === "fire" ? "scale-110" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🔥</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-2xl transition-colors ${
              myReaction === "fire" ? "text-orange-300" : "text-orange-400 group-hover:text-orange-300"
            }`}>FIRE</div>
            <div className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">This a banger</div>
          </div>
        </button>
        <button
          onClick={() => {
            if (!user) { toast.error("Login to vote"); return; }
            if (hasVoted) { toast.error("You already voted!"); return; }
            onVote("trash");
          }}
          disabled={hasVoted || isPending}
          className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
            myReaction === "trash" ? "bg-blue-500/20 cursor-default" :
            hasVoted ? "opacity-40 cursor-not-allowed" :
            "hover:bg-blue-500/10 active:bg-blue-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-5xl transition-transform duration-200 select-none ${
            myReaction === "trash" ? "scale-110" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🗑️</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-2xl transition-colors ${
              myReaction === "trash" ? "text-blue-300" : "text-blue-400 group-hover:text-blue-300"
            }`}>TRASH</div>
            <div className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">Next track please</div>
          </div>
        </button>
      </div>

      {/* Live results bar */}
      <div className="border-t border-white/10">
        <div className="flex">
          <div className="h-1.5 bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700 rounded-bl-xl" style={{ width: `${firePct}%` }} />
          <div className="h-1.5 bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-700 rounded-br-xl" style={{ width: `${trashPct}%` }} />
        </div>
        <div className="flex justify-between px-4 py-2 text-[10px]">
          <span className="text-orange-400 font-bold">🔥 {fireCount} ({firePct}%)</span>
          <span className="text-white/30">{total} vote{total !== 1 ? "s" : ""}</span>
          <span className="text-blue-400 font-bold">{trashPct}% ({trashCount}) 🗑️</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MusicReview() {
  const [tab, setTab] = useState<SubmitTab>("queue");
  const [submitType, setSubmitType] = useState<"youtube" | "file">("file");
  const [form, setForm] = useState({ songTitle: "", youtubeUrl: "", contactInfo: "", wantsSkip: false });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [selectedYouTube, setSelectedYouTube] = useState<{ url: string; title: string; artist: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Skip-the-line payment flow state
  const [skipStep, setSkipStep] = useState<"select" | "pay" | "confirm" | "done">("select");
  const [selectedSkipType, setSelectedSkipType] = useState<"reentry5" | "reentry10" | "skip" | null>(null);
  const [skipReceiptUrl, setSkipReceiptUrl] = useState("");
  const [skipPaymentMethod, setSkipPaymentMethod] = useState("");
  const [paidReceiptUrl, setPaidReceiptUrl] = useState("");
  const [selectedPaidType, setSelectedPaidType] = useState<'reentry5' | 'reentry10' | 'skip' | null>(null);
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const createSkipStripeCheckout = trpc.stripe.createSkipCheckoutSession.useMutation();
  const confirmSkipStripeCheckout = trpc.stripe.confirmSkipCheckout.useMutation();

  const { user } = useAuth();
  const { data: reviewPlusStatus, refetch: refetchReviewPlusStatus } = trpc.stripe.getReviewPlusStatus.useQuery(undefined, { enabled: !!user });
  const createReviewPlusCheckout = trpc.stripe.createReviewPlusCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => { window.location.href = checkoutUrl; },
    onError: (error) => toast.error(error.message),
  });
  const confirmReviewPlusCheckout = trpc.stripe.confirmReviewPlusCheckout.useMutation({
    onSuccess: () => { refetchReviewPlusStatus(); toast.success("Review+ is active — unlimited Vote To Skip is now enabled."); },
    onError: (error) => toast.error("Review+ verification failed: " + error.message),
  });
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("review_plus_success") === "true" && sessionId) {
      window.history.replaceState({}, "", "/review");
      confirmReviewPlusCheckout.mutate({ sessionId });
    } else if (params.get("review_plus_canceled") === "true") {
      window.history.replaceState({}, "", "/review");
      toast.error("Review+ checkout was canceled.");
    }
  }, [user]);
  const isAdmin = user?.role === "admin";
  const isAdminPopout = typeof window !== "undefined" && window.location.pathname === "/admin-popout";
  const audioPlayer = useAudioPlayer();
  const { playTrack: resolveAndPlay } = usePlayTrack();

  const { data, refetch, isLoading } = trpc.queue.getAll.useQuery(undefined, { refetchInterval: 5000 });
  const { data: reviewedTracks } = trpc.queue.getReviewed.useQuery(undefined, { refetchInterval: 30000 });

  const [limitReachedData, setLimitReachedData] = useState<{ success: false; limitReached: true; message: string; upgradeOptions: Array<{ type: string; price: number; label: string }> } | null>(null);
  const [pendingFormData, setPendingFormData] = useState<{
    type: 'youtube' | 'file';
    songTitle: string;
    youtubeUrl?: string;
    contactInfo?: string;
    wantsSkip: boolean;
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [paidSubmitSuccess, setPaidSubmitSuccess] = useState<string | null>(null);

  const submitMutation = trpc.queue.submit.useMutation({
    onSuccess: (data) => {
      if (!data.success && 'limitReached' in data && data.limitReached && 'message' in data && 'upgradeOptions' in data) {
        setLimitReachedData(data as any);
        setSubmitting(false);
      } else if (data.success) {
        if ((data as any).isPaid) {
          setPaidSubmitSuccess('basic');
          setLimitReachedData(null);
          setPendingFormData(null);
        } else {
          setSubmitted(true);
        }
        setSubmitting(false); refetch();
      }
    },
    onError: (err) => { toast.error("Submission failed: " + err.message); setSubmitting(false); },
  });
  const preparePaidSubmissionAudioMutation = trpc.stripe.preparePaidSubmissionAudio.useMutation();
  const createPaidSubmissionCheckoutMutation = trpc.stripe.createPaidSubmissionCheckout.useMutation();
  const confirmPaidSubmissionCheckoutMutation = trpc.stripe.confirmPaidSubmissionCheckout.useMutation();

  const uploadAudioMutation = trpc.queue.uploadAudio.useMutation({
    onSuccess: (data) => {
      if (!data.success && 'limitReached' in data && data.limitReached && 'message' in data && 'upgradeOptions' in data) {
        setLimitReachedData(data as any);
        setSubmitting(false);
      } else if (data.success) {
        if ((data as any).isPaid) {
          setPaidSubmitSuccess('basic');
          setLimitReachedData(null);
          setPendingFormData(null);
        } else {
          setSubmitted(true);
        }
        setSubmitting(false); refetch();
      }
    },
    onError: (err) => { toast.error("Upload failed: " + err.message); setSubmitting(false); },
  });
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("paid_submission_success") === "true" && sessionId) {
      window.history.replaceState({}, "", "/review");
      setSubmitting(true);
      confirmPaidSubmissionCheckoutMutation.mutate({ sessionId }, {
        onSuccess: (result) => {
          setPaidSubmitSuccess(result.alreadyCreated ? "already-created" : "stripe");
          setLimitReachedData(null);
          setPendingFormData(null);
          setSelectedPaidType(null);
          setPaidReceiptUrl("");
          setSubmitting(false);
          refetch();
          toast.success("Payment verified — your paid track is pending admin approval.");
        },
        onError: (error) => {
          setSubmitting(false);
          toast.error("Payment verification failed: " + error.message);
        },
      });
    } else if (params.get("paid_submission_canceled") === "true") {
      window.history.replaceState({}, "", "/review");
      toast.error("Stripe checkout was canceled. Your track was not submitted.");
    }
  }, [user]);

  const { data: lineSkipCreditsData, refetch: refetchLineSkipCredits } = trpc.dailyWheel.getMyLineSkipCredits.useQuery(undefined, { enabled: !!user });
  const useLineSkipMutation = trpc.dailyWheel.useLineSkip.useMutation({
    onSuccess: (data) => {
      toast.success(`Line skip applied! Credits remaining: ${data.creditsRemaining}`);
      refetchLineSkipCredits();
      refetch();
    },
    onError: (err) => toast.error("Failed to apply line skip: " + err.message),
  });

  const reactMutation = trpc.queue.react.useMutation({
    onSuccess: () => {
      refetch(); refetchMyReaction(); refetchReactions();
      if (currentPlayingId) broadcastReactionsUpdated(currentPlayingId);
    },
    onError: (err) => {
      if (err.message.includes("Already voted")) toast.error("You already voted on this track!");
      else toast.error(err.message);
    },
  });
  const requeueFromHistoryMutation = trpc.queue.requeue.useMutation({
    onSuccess: () => { refetch(); toast.success("Song re-queued"); },
    onError: () => toast.error("Failed to re-queue song"),
  });

  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
  const [isAdminPanelFloating, setIsAdminPanelFloating] = useState(false);

  // Tip artist state
  const [tipAmount, setTipAmount] = useState<string>("");
  const [showTipPanel, setShowTipPanel] = useState(false);
  const { data: coinBalanceData, refetch: refetchCoinBalance } = trpc.coins.getBalance.useQuery(undefined, { enabled: !!user });
  const tipMutation = trpc.gifts.tipArtist.useMutation({
    onSuccess: (res: any) => {
      toast.success(`Tip sent! New balance: ${res.newBalance} coins`);
      setTipAmount("");
      setShowTipPanel(false);
      refetchCoinBalance();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const [liveReviewActive, setLiveReviewActive] = useState<LiveReviewActiveItem | null>(null);
  const [ytSyncState, setYtSyncState] = useState<{ currentTime: number; updatedAt: number } | null>(null);
  const currentPlayingId = activeSubmissionId ?? data?.currentPlaying?.id ?? null;

  const { data: myReaction, refetch: refetchMyReaction } = trpc.queue.getMyReaction.useQuery(
    { submissionId: currentPlayingId! },
    { enabled: !!user && !!currentPlayingId, refetchInterval: 3000 }
  );
  const { data: reactionCounts, refetch: refetchReactions } = trpc.queue.getReactions.useQuery(
    { submissionId: currentPlayingId! },
    { enabled: !!currentPlayingId, refetchInterval: 3000 }
  );
  const { data: skipVoteStatus, refetch: refetchSkipVoteStatus } = trpc.queue.getSkipVoteStatus.useQuery(
    { submissionId: currentPlayingId! },
    { enabled: !!user && !!currentPlayingId, refetchInterval: 3000 }
  );
  const skipVoteMutation = trpc.queue.voteToSkip.useMutation({
    onSuccess: (result) => {
      toast.success(`Skip vote counted (${result.votes}).`);
      refetchSkipVoteStatus();
    },
    onError: (error) => toast.error(error.message),
  });

  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fake live viewer count and auto-chat messages
  // NOTE: emitFakeChatMessage and emitChatControls are wired in after useChat is initialized
  const fakeChatEmitRef = useRef<((data: any) => void) | undefined>(undefined);
  const chatControlsEmitRef = useRef<((data: any) => void) | undefined>(undefined);

  const {
    viewerCount, viewerCountVisible, setViewerCountVisible, fakeMessages, triggerReaction,
    commentIntervalMs, setCommentIntervalMs,
    viewerMin, setViewerMin, viewerMax, setViewerMax,
    ghostFireCount, setGhostFireCount,
    ghostTrashCount, setGhostTrashCount,
    ghostFireIntervalSec, setGhostFireIntervalSec,
    ghostTrashIntervalSec, setGhostTrashIntervalSec,
    sentimentBias, setSentimentBias,
    receiveFakeMessage,
    receiveChatControls,
  } = useFakeLiveChat({
    isAdmin,
    emitFakeChatMessage: (data) => fakeChatEmitRef.current?.(data),
    emitChatControls: (data) => chatControlsEmitRef.current?.(data),
  });

  const chatUsername = user?.artistName || user?.name || "Anonymous";

  const audioRoom = useAudioRoom({
    room: "music_review",
    username: chatUsername,
    role: isAdmin ? "admin" : voiceJoined ? "user" : "viewer",
    userId: user?.id,
    enabled: isAdmin || voiceJoined,
  });

  const videoRoom = useVideoRoom({
    room: "music_review",
    username: chatUsername,
    role: isAdmin ? "admin" : "viewer",
    userId: user?.id,
    enabled: isAdmin,
  });

  const {
    messages: chatMessages,
    sendMessage,
    isConnected: chatConnected,
    broadcastReviewActive,
    broadcastRadioPause,
    broadcastRadioResume,
    broadcastRadioSeek,
    broadcastReviewPlayback,
    broadcastReviewQueueUpdated,
    broadcastLastSong,
    broadcastReactionsUpdated,
    emitFakeChatMessage,
    emitChatControls,
    emitTriggerReaction,
  } = useChat({
    room: "music_review",
    username: chatUsername,
    userId: user?.id,
    avatarUrl: (user as { avatarUrl?: string | null } | null)?.avatarUrl ?? null,
    isAdmin,
    role: user?.role === "admin" ? "admin" : user?.role === "judge" ? "judge" : user?.role === "contestant" ? "contestant" : "user",
    onFakeChatMessage: receiveFakeMessage,
    onChatControlsReceived: receiveChatControls,
    onTriggerReaction: (data) => { if (!isAdmin) triggerReaction(data.reaction as any, data.duration); },
    onReviewActiveChanged: (item) => {
      setActiveSubmissionId(item.submissionId);
      setLiveReviewActive(item);
      refetch();
      refetchReactions();
      refetchMyReaction();
    },
    onReviewPlayback: (data: LiveReviewPlayback) => {
      if (!liveAudioRef.current) return;
      if (data.action === "play") liveAudioRef.current.play().catch(() => {});
      else if (data.action === "pause") liveAudioRef.current.pause();
      else if (data.action === "replay") { liveAudioRef.current.currentTime = 0; liveAudioRef.current.play().catch(() => {}); }
    },
    onReviewQueueUpdated: () => { refetch(); },
    onLastSongRestored: (data) => {
      toast.success(`↩ "${data.songTitle}" by ${data.artistName} restored to queue`);
      refetch();
    },
    onRadioPaused: (data) => {
      audioPlayer.seek(data.pausedAt);
      audioPlayer.pause();
    },
    onRadioResumed: (data) => {
      const elapsed = (Date.now() - data.startedAt) / 1000;
      audioPlayer.seek(Math.max(0, elapsed));
      audioPlayer.resume();
    },
    onRadioSeeked: (data) => {
      audioPlayer.seek(data.currentTime);
    },
    onReactionsUpdated: () => {
      refetchReactions();
      refetchMyReaction();
    },
  });

  // Wire the emit refs so useFakeLiveChat can call them
  useEffect(() => {
    fakeChatEmitRef.current = emitFakeChatMessage;
    chatControlsEmitRef.current = emitChatControls;
  });

  // Initialize from DB for late joiners
  useEffect(() => {
    if (!liveReviewActive && data?.currentPlaying) {
      const cp = data.currentPlaying;
      setActiveSubmissionId(cp.id);
      setLiveReviewActive({
        submissionId: cp.id,
        userId: cp.userId ?? null,
        artistName: cp.artistName,
        songTitle: cp.songTitle,
        audioUrl: cp.fileUrl ?? null,
        youtubeUrl: cp.youtubeUrl ?? null,
        submissionType: cp.submissionType,
        fileKey: cp.fileKey ?? null,
        fileUrl: cp.fileUrl ?? null,
      });
    }
    }, [data?.currentPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset ghost votes when song changes
  useEffect(() => {
    setGhostFireCount(0);
    setGhostTrashCount(0);
  }, [activeSubmissionId, setGhostFireCount, setGhostTrashCount]);

  // Register admin broadcast functions for FloatingPlayer
  useEffect(() => {
    if (isAdmin) {
      registerSeekBroadcast(broadcastRadioSeek);
      registerPauseBroadcast(broadcastRadioPause);
      registerResumeBroadcast(broadcastRadioResume);
    }
    return () => {
      registerSeekBroadcast(null);
      registerPauseBroadcast(null);
      registerResumeBroadcast(null);
    };
  }, [isAdmin, broadcastRadioSeek, broadcastRadioPause, broadcastRadioResume]);

  const adminMicBroadcast = useAdminMicBroadcast({
    room: "music_review",
    isAdmin,
    enabled: true,
    username: user?.artistName || user?.name || "Admin",
    userId: user?.id,
    getAudioElement: audioPlayer.getAudioElement,
  });

  // Auto-scroll chat to newest message — scroll the container directly to avoid scrolling the whole page
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [chatMessages, fakeMessages]);

  const handleSendChat = () => {
    if (!chatInput.trim() || !user) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Please login to submit your track"); return; }
    if (!form.songTitle) { toast.error("Please fill in song title"); return; }
    if (submitType === "youtube" && !form.youtubeUrl) { toast.error("Please enter a YouTube link"); return; }
    if (submitType === "file" && !audioFile) { toast.error("Please select an audio file"); return; }
        setSubmitting(true);
    const paidOnly = data?.state?.playbackMode === "paid_only";
    const paidType = selectedPaidType ?? "reentry5";
    if (paidOnly) {
      setSelectedPaidType(paidType);
      setPaidSubmitSuccess(null);
      try {
        if (submitType === "file" && audioFile) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const base64 = (ev.target?.result as string).split(",")[1];
              const prepared = await preparePaidSubmissionAudioMutation.mutateAsync({
                fileBase64: base64,
                fileName: audioFile.name,
                mimeType: (audioFile.type || "audio/mpeg") as "audio/mpeg" | "audio/wav" | "audio/mp4" | "audio/x-m4a",
              });
              setPendingFormData({ type: "file", songTitle: form.songTitle, contactInfo: form.contactInfo || undefined, wantsSkip: false, fileBase64: base64, fileName: audioFile.name, mimeType: audioFile.type || "audio/mpeg" });
              const checkout = await createPaidSubmissionCheckoutMutation.mutateAsync({
                submissionType: "file", songTitle: form.songTitle, fileKey: prepared.fileKey, fileUrl: prepared.fileUrl,
                contactInfo: form.contactInfo || undefined, paidSubmissionType: paidType, origin: window.location.origin,
              });
              window.location.href = checkout.checkoutUrl;
            } catch (error: any) {
              setSubmitting(false);
              toast.error(error?.message ?? "Unable to start paid checkout");
            }
          };
          reader.readAsDataURL(audioFile);
        } else {
          setPendingFormData({ type: "youtube", songTitle: form.songTitle, youtubeUrl: form.youtubeUrl, contactInfo: form.contactInfo || undefined, wantsSkip: false });
          const checkout = await createPaidSubmissionCheckoutMutation.mutateAsync({
            submissionType: "youtube", songTitle: form.songTitle, youtubeUrl: form.youtubeUrl,
            contactInfo: form.contactInfo || undefined, paidSubmissionType: paidType, origin: window.location.origin,
          });
          window.location.href = checkout.checkoutUrl;
        }
      } catch (error: any) {
        setSubmitting(false);
        toast.error(error?.message ?? "Unable to start paid checkout");
      }
      return;
    }
    if (submitType === "file" && audioFile) {
      const reader = new FileReader();

      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        setPendingFormData({
          type: 'file',
          songTitle: form.songTitle,
          contactInfo: form.contactInfo || undefined,
          wantsSkip: form.wantsSkip,
          fileBase64: base64,
          fileName: audioFile.name,
          mimeType: audioFile.type || "audio/mpeg",
        });
        uploadAudioMutation.mutate({
          songTitle: form.songTitle,
          fileName: audioFile.name,
          fileBase64: base64,
          mimeType: audioFile.type || "audio/mpeg",
          contactInfo: form.contactInfo || undefined,
          wantsSkip: form.wantsSkip,
        });
      };
      reader.readAsDataURL(audioFile);
    } else {
      setPendingFormData({
        type: 'youtube',
        songTitle: form.songTitle,
        youtubeUrl: form.youtubeUrl,
        contactInfo: form.contactInfo || undefined,
        wantsSkip: form.wantsSkip,
      });
      submitMutation.mutate({
        songTitle: form.songTitle,
        submissionType: "youtube",
        youtubeUrl: form.youtubeUrl,
        contactInfo: form.contactInfo || undefined,
        wantsSkip: form.wantsSkip,
      });
    }
  };

  const handlePaidSubmit = (paidType: 'reentry5' | 'reentry10' | 'skip') => {
    if (!pendingFormData) return;
    const receiptUrl = paidReceiptUrl.trim();
    if (receiptUrl.length < 4) {
      toast.error("Send payment to $MittenMedia in Cash App, then paste the receipt URL.");
      return;
    }
    setPaidSubmitSuccess(null);
    setSubmitting(true);
    if (pendingFormData.type === 'file' && pendingFormData.fileBase64) {
      uploadAudioMutation.mutate({
        songTitle: pendingFormData.songTitle,
        fileName: pendingFormData.fileName!,
        fileBase64: pendingFormData.fileBase64,
        mimeType: pendingFormData.mimeType || "audio/mpeg",
        contactInfo: pendingFormData.contactInfo,
        wantsSkip: paidType === 'skip',
        paidSubmissionType: paidType,
        receiptUrl,
        paymentMethod: "Cash App",
      });
    } else {
      submitMutation.mutate({
        songTitle: pendingFormData.songTitle,
        submissionType: "youtube",
        youtubeUrl: pendingFormData.youtubeUrl,
        contactInfo: pendingFormData.contactInfo,
        wantsSkip: paidType === 'skip',
        paidSubmissionType: paidType,
        receiptUrl,
        paymentMethod: "Cash App",
      });
    }
  };

  const startPaidStripeCheckout = async (paidType: 'reentry5' | 'reentry10' | 'skip') => {
    if (!pendingFormData || !user) return;
    setSubmitting(true);
    try {
      let fileKey: string | undefined;
      let fileUrl: string | undefined;
      if (pendingFormData.type === "file") {
        if (!pendingFormData.fileBase64 || !pendingFormData.fileName) throw new Error("Choose an audio file before checkout.");
        const prepared = await preparePaidSubmissionAudioMutation.mutateAsync({
          fileBase64: pendingFormData.fileBase64,
          fileName: pendingFormData.fileName,
          mimeType: (pendingFormData.mimeType === "audio/wav" || pendingFormData.mimeType === "audio/mp4" || pendingFormData.mimeType === "audio/x-m4a" ? pendingFormData.mimeType : "audio/mpeg"),
        });
        fileKey = prepared.fileKey;
        fileUrl = prepared.fileUrl;
      }
      const { checkoutUrl } = await createPaidSubmissionCheckoutMutation.mutateAsync({
        submissionType: pendingFormData.type,
        songTitle: pendingFormData.songTitle,
        youtubeUrl: pendingFormData.youtubeUrl,
        fileKey,
        fileUrl,
        contactInfo: pendingFormData.contactInfo,
        paidSubmissionType: paidType,
        origin: window.location.origin,
      });
      window.location.href = checkoutUrl;
    } catch (error) {
      setSubmitting(false);
      toast.error("Unable to start Stripe checkout: " + (error instanceof Error ? error.message : "Please try again."));
    }
  };

  // Standalone skip-the-line purchase (user already has a submission in queue)
  const handleStripeSkipCheckout = async () => {
    if (!selectedSkipType || !user) return;
    const mySubmission = data?.submissions?.find(s => s.userId === user.id && (s.status === "pending" || s.status === "playing"));
    if (!mySubmission) {
      toast.error("You need to have a track in the queue first to purchase a skip.");
      return;
    }
    setSkipSubmitting(true);
    try {
      const result = await createSkipStripeCheckout.mutateAsync({
        submissionId: mySubmission.id,
        skipType: selectedSkipType,
        origin: window.location.origin,
      });
      window.location.assign(result.checkoutUrl);
    } catch (error: any) {
      setSkipSubmitting(false);
      toast.error(error?.message ?? "Unable to open Stripe checkout");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("skip_paid") !== "true" || !sessionId || !user || confirmSkipStripeCheckout.isPending) return;
    void confirmSkipStripeCheckout.mutateAsync({ sessionId }).then(() => {
      setSkipStep("done");
      setSkipSubmitting(false);
      void refetch();
      toast.success("Stripe payment received. Your skip is pending admin approval.");
      window.history.replaceState({}, "", window.location.pathname);
    }).catch((error: any) => {
      setSkipSubmitting(false);
      toast.error(error?.message ?? "Stripe payment could not be verified");
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [user, confirmSkipStripeCheckout, refetch]);

  const handleSkipPurchase = () => {
    if (!selectedSkipType || !user) return;
    const mySubmission = data?.submissions?.find(s => s.userId === user.id && (s.status === "pending" || s.status === "playing"));
    if (!mySubmission) {
      toast.error("You need to have a track in the queue first to purchase a skip.");
      return;
    }
    setSkipSubmitting(true);
    submitMutation.mutate({
      songTitle: mySubmission.songTitle,
      submissionType: mySubmission.submissionType,
      youtubeUrl: mySubmission.youtubeUrl ?? undefined,
      contactInfo: mySubmission.contactInfo ?? undefined,
      wantsSkip: true,
      paidSubmissionType: selectedSkipType,
      receiptUrl: skipReceiptUrl || undefined,
      paymentMethod: skipPaymentMethod || undefined,
    }, {
      onSuccess: () => {
        setSkipSubmitting(false);
        setSkipStep("done");
        refetch();
      },
      onError: (err) => {
        setSkipSubmitting(false);
        toast.error("Skip purchase failed: " + err.message);
      },
    });
  };

  const pendingQueue = data?.submissions?.filter(s => s.status === "pending" || s.status === "playing") ?? [];
  const currentPlaying = data?.currentPlaying;
  const isLive = data?.state?.isLive ?? false;
  const liveMessage = data?.state?.liveMessage;
  const streamUrl = data?.state?.streamUrl;

  const playTrack = useCallback(async (sub: ReviewSubmission) => {
    if (sub.submissionType === "youtube" && sub.youtubeUrl) {
      setSelectedYouTube({ url: sub.youtubeUrl, title: sub.songTitle, artist: sub.artistName });
      return;
    }
    if (sub.fileUrl) {
      await resolveAndPlay({
        url: sub.fileUrl,
        urlSource: "queue",
        title: sub.songTitle,
        artist: sub.artistName,
        isStream: false,
        submissionId: sub.id,
        sourcePage: "Music Review",
        sourceUrl: "/review",
      });
      return;
    }
    toast.error("No audio available for this track");
  }, [resolveAndPlay]);

  const playStream = useCallback(() => {
    if (streamUrl) {
      audioPlayer.play({
        url: streamUrl,
        title: "Murder Mitten Media — LIVE",
        artist: "Murder Mitten Media",
        isStream: true,
        artworkUrl: LOGO,
      });
    }
  }, [streamUrl, audioPlayer]);

  // Derived vote data for the active track
  const activeTrackData = currentPlayingId
    ? data?.submissions?.find(s => s.id === currentPlayingId)
    : null;
  const fire = reactionCounts?.fire ?? activeTrackData?.fireCount ?? 0;
  const trash = reactionCounts?.trash ?? activeTrackData?.trashCount ?? 0;
  // Normalize socket and database track data into the render contract. A stopped
  // socket event carries { submissionId: null } and must not render a poll/player.
  const activeTrack = liveReviewActive?.submissionId != null
    ? {
          submissionId: liveReviewActive.submissionId,
          userId: liveReviewActive.userId ?? null,
          artistName: liveReviewActive.artistName ?? "Unknown Artist",
          songTitle: liveReviewActive.songTitle ?? "Untitled Submission",
          audioUrl: liveReviewActive.audioUrl ?? null,
          youtubeUrl: liveReviewActive.youtubeUrl ?? null,
          submissionType: liveReviewActive.submissionType === "youtube" ? "youtube" as const : "file" as const,
          fileKey: liveReviewActive.fileKey ?? null,
          fileUrl: liveReviewActive.fileUrl ?? liveReviewActive.audioUrl ?? null,
        }
    : currentPlaying
      ? {
          submissionId: currentPlaying.id,
          userId: currentPlaying.userId ?? null,
          artistName: currentPlaying.artistName,
          songTitle: currentPlaying.songTitle,
          audioUrl: currentPlaying.fileUrl ?? null,
          youtubeUrl: currentPlaying.youtubeUrl ?? null,
          submissionType: currentPlaying.submissionType,
          fileKey: currentPlaying.fileKey ?? null,
          fileUrl: currentPlaying.fileUrl ?? null,
        }
      : null;

  // ── Merged chat messages (real + fake) sorted chronologically ───
  const allMessages = [...chatMessages, ...fakeMessages].sort((a, b) => {
    const ta = "timestamp" in a ? a.timestamp : new Date(a.createdAt).getTime();
    const tb = "timestamp" in b ? b.timestamp : new Date(b.createdAt).getTime();
    return ta - tb;
  });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <LiveRadioBanner />

      {/* ── HERO HEADER ─────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#0d0d0d] to-[#080808] border-b border-white/5 pt-20 pb-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <Music className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="font-['Anton'] text-3xl uppercase tracking-wider leading-none">
                Music <span className="text-red-600">Review</span>
              </h1>
              <p className="text-white/30 text-xs uppercase tracking-widest mt-0.5">Live Session</p>
            </div>
          </div>
          {/* LIVE VIEWER COUNT — optional and only visible while the review is live */}
          <div className="flex items-center gap-3">
            {shouldShowViewerCount(isLive, viewerCountVisible) && (
              <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/30 rounded-full px-5 py-2.5">
                <Eye className="w-5 h-5 text-red-400" />
                <span className="font-['Anton'] text-2xl text-white tabular-nums">{viewerCount.toLocaleString()}</span>
                <span className="text-red-400 text-xs uppercase tracking-widest font-semibold">Watching</span>
              </div>
            )}
            {isLive && (
              <div className="flex items-center gap-2 bg-green-600/10 border border-green-600/30 rounded-full px-4 py-2.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 text-xs font-bold uppercase tracking-widest">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN SINGLE-COLUMN CONTENT ──────────────────────── */}
      <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">


        {/* ── ADMIN PANEL (admin/judge only) ─────────────────── */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => window.open('/admin-popout', '_blank', 'width=600,height=900,left=100,top=100')}
              className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors uppercase tracking-widest font-bold"
              title="Open admin control panel in new window"
            >
              📺 Open Admin Panel
            </button>
          </div>
        )}

        {/* The pop-out uses the same tested control board in its own window. */}
        {isAdmin && isAdminPopout && (
            <AdminPanel
            data={data}
            refetch={refetch}
            audioRoom={audioRoom}
            videoRoom={videoRoom}
            broadcastReviewActive={broadcastReviewActive}
            broadcastRadioPause={broadcastRadioPause}
            broadcastRadioResume={broadcastRadioResume}
            broadcastRadioSeek={broadcastRadioSeek}
            broadcastReviewPlayback={broadcastReviewPlayback}
            broadcastReviewQueueUpdated={broadcastReviewQueueUpdated}
            broadcastLastSong={broadcastLastSong}
            adminMicBroadcast={adminMicBroadcast}
            playTrack={playTrack}
            setSelectedYouTube={setSelectedYouTube}
            reviewedTracks={reviewedTracks}
            triggerReaction={(reaction, duration) => { triggerReaction(reaction, duration); emitTriggerReaction(reaction, duration ?? 3000); }}
            commentIntervalMs={commentIntervalMs}
            setCommentIntervalMs={(v) => { setCommentIntervalMs(v); emitChatControls({ commentIntervalMs: v }); }}
            viewerMin={viewerMin}
            setViewerMin={setViewerMin}
            viewerMax={viewerMax}
            setViewerMax={setViewerMax}
            ghostFireCount={ghostFireCount}
            setGhostFireCount={setGhostFireCount}
            ghostTrashCount={ghostTrashCount}
            setGhostTrashCount={setGhostTrashCount}
            ghostFireIntervalSec={ghostFireIntervalSec}
            setGhostFireIntervalSec={(v) => { setGhostFireIntervalSec(v); emitChatControls({ ghostFireIntervalSec: v }); }}
            ghostTrashIntervalSec={ghostTrashIntervalSec}
            setGhostTrashIntervalSec={(v) => { setGhostTrashIntervalSec(v); emitChatControls({ ghostTrashIntervalSec: v }); }}
            sentimentBias={sentimentBias}
            setSentimentBias={(v) => { setSentimentBias(v); emitChatControls({ sentimentBias: v }); }}
            viewerCountVisible={viewerCountVisible}
            setViewerCountVisible={(v) => { setViewerCountVisible(v); emitChatControls({ viewerCountVisible: v }); }}
            />
        )}

        {/* ── FLOATING ADMIN PANEL (DISABLED - use new window instead) ─────────────────────── */}
        {false && (
          <FloatingWindow
            title="Admin Control Panel"
            onClose={() => setIsAdminPanelFloating(false)}
            defaultWidth={420}
            defaultHeight={700}
            defaultX={typeof window !== 'undefined' ? window.innerWidth - 450 : 20}
            defaultY={60}
          >
            <AdminPanel
              data={data}
              refetch={refetch}
              audioRoom={audioRoom}
              videoRoom={videoRoom}
              broadcastReviewActive={broadcastReviewActive}
              broadcastRadioPause={broadcastRadioPause}
              broadcastRadioResume={broadcastRadioResume}
              broadcastRadioSeek={broadcastRadioSeek}
              broadcastReviewPlayback={broadcastReviewPlayback}
              broadcastReviewQueueUpdated={broadcastReviewQueueUpdated}
              broadcastLastSong={broadcastLastSong}
              adminMicBroadcast={adminMicBroadcast}
              playTrack={playTrack}
              setSelectedYouTube={setSelectedYouTube}
              reviewedTracks={reviewedTracks}
              triggerReaction={(reaction, duration) => { triggerReaction(reaction, duration); emitTriggerReaction(reaction, duration ?? 3000); }}
              commentIntervalMs={commentIntervalMs}
              setCommentIntervalMs={(v) => { setCommentIntervalMs(v); emitChatControls({ commentIntervalMs: v }); }}
              viewerMin={viewerMin}
              setViewerMin={setViewerMin}
              viewerMax={viewerMax}
              setViewerMax={setViewerMax}
              ghostFireCount={ghostFireCount}
              setGhostFireCount={setGhostFireCount}
              ghostTrashCount={ghostTrashCount}
              setGhostTrashCount={setGhostTrashCount}
              ghostFireIntervalSec={ghostFireIntervalSec}
              setGhostFireIntervalSec={(v) => { setGhostFireIntervalSec(v); emitChatControls({ ghostFireIntervalSec: v }); }}
              ghostTrashIntervalSec={ghostTrashIntervalSec}
              setGhostTrashIntervalSec={(v) => { setGhostTrashIntervalSec(v); emitChatControls({ ghostTrashIntervalSec: v }); }}
              sentimentBias={sentimentBias}
              setSentimentBias={(v) => { setSentimentBias(v); emitChatControls({ sentimentBias: v }); }}
              viewerCountVisible={viewerCountVisible}
              setViewerCountVisible={(v) => { setViewerCountVisible(v); emitChatControls({ viewerCountVisible: v }); }}
            />
          </FloatingWindow>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
        {/* ── NOW PLAYING (large, prominent) ─────────────────── */}
        {activeTrack ? (
          <div className="relative rounded-2xl overflow-hidden border border-red-600/40 bg-gradient-to-br from-red-950/20 via-[#0d0d0d] to-[#080808]">
            {/* Glow corners */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-red-600/10 rounded-full translate-x-1/2 translate-y-1/2 blur-2xl pointer-events-none" />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-2 bg-red-600/20 border border-red-600/40 rounded-full px-4 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Now Being Reviewed</span>
                </div>
                {/* Playback mode badge */}
                {(() => {
                  const mode = data?.state?.playbackMode ?? "90sec";
                  const skipPrice = (data?.state?.skipPriceCents ?? 1500) / 100;
                  const fullSongPrice = (data?.state?.fullSongPriceCents ?? 500) / 100;
                  const submitPrice = (data?.state?.submitPriceCents ?? 0) / 100;
                  if (mode === "90sec") return (
                    <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
                      <span className="text-orange-400 text-[10px] font-bold uppercase tracking-widest">⏱ 90s Preview</span>
                      {fullSongPrice > 0 && <span className="text-orange-300/60 text-[10px]">· Full song ${fullSongPrice} via CashApp</span>}
                    </div>
                  );
                  if (mode === "full") return (
                    <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1">
                      <span className="text-green-400 text-[10px] font-bold uppercase tracking-widest">🎵 Full Song Mode</span>
                    </div>
                  );
                  if (mode === "paid_only") return (
                    <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
                      <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">💰 Paid Submissions Only</span>
                      {submitPrice > 0 && <span className="text-red-300/60 text-[10px]">· ${submitPrice} to submit</span>}
                    </div>
                  );
                  return null;
                })()}
              </div>

              {/* Track info */}
              <div className="flex items-start gap-5 mb-5">
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-red-900/40 to-red-950/60 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                  <Music className="w-8 h-8 text-red-400/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-['Anton'] text-3xl md:text-4xl uppercase leading-tight truncate">
                    {activeTrack.songTitle}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {activeTrack.userId ? (
                      <Link href={`/profile/${activeTrack.userId}`} className="text-red-400 text-lg font-semibold hover:text-red-300 transition-colors truncate">
                        {activeTrack.artistName}
                      </Link>
                    ) : (
                      <span className="text-red-400 text-lg font-semibold truncate">{activeTrack.artistName}</span>
                    )}
                  </div>
                  {activeTrack.submissionType === "youtube" && activeTrack.youtubeUrl && (
                    <a href={activeTrack.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-white/30 text-xs hover:text-white/60 transition-colors mt-1">
                      <ExternalLink className="w-3 h-3" />
                      YouTube Link
                    </a>
                  )}
                </div>
              </div>

              {/* Audio/YouTube player */}
              {activeTrack.submissionType === "youtube" && activeTrack.youtubeUrl ? (
                <div className="rounded-xl overflow-hidden mb-5">
                  <SyncedYouTubePlayer
                    videoId={extractYouTubeId(activeTrack.youtubeUrl) ?? ""}
                    submissionId={activeTrack.submissionId}
                    initialCurrentTime={ytSyncState?.currentTime ?? null}
                    initialUpdatedAt={ytSyncState?.updatedAt ?? null}
                    isAdmin={isAdmin}
                  />
                </div>
              ) : activeTrack.submissionType === "file" && activeTrack.fileUrl ? (
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-5 py-4 mb-5">
                  <AudioPlayButton
                    url={activeTrack.fileUrl}
                    title={activeTrack.songTitle}
                    artist={activeTrack.artistName}
                    sourcePage="Music Review"
                    submissionId={activeTrack.submissionId}
                    artistUserId={activeTrack.userId ?? undefined}
                    size="lg"
                  />
                  <div>
                    <div className="text-white/70 text-sm font-medium">{activeTrack.songTitle}</div>
                    <div className="text-white/30 text-xs">{activeTrack.artistName}</div>
                  </div>
                </div>
              ) : null}

              {/* Fire/Trash voting — always show when liveReviewActive is set */}
              {(() => {
                const pollId = currentPlayingId ?? activeTrack.submissionId;
                return (
                  <>
                  <FireTrashPoll
                    submissionId={pollId}
                    songTitle={activeTrack.songTitle}
                    artistName={activeTrack.artistName}
                    artistUserId={activeTrack.userId ?? null}
                    fireCount={(reactionCounts?.fire ?? currentPlaying?.fireCount ?? 0) + ghostFireCount}
                    trashCount={(reactionCounts?.trash ?? currentPlaying?.trashCount ?? 0) + ghostTrashCount}
                    myReaction={myReaction?.reaction ?? null}
                    onVote={(reaction) => {
                      if (!user) { toast.error("Login to vote"); return; }
                      if (pollId == null) return;
                      reactMutation.mutate({ submissionId: pollId, reaction });
                    }}
                    isPending={reactMutation.isPending}
                    user={user}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Vote To Skip</p>
                      <p className="mt-1 text-[11px] text-white/40">{skipVoteStatus?.votes ?? 0} votes · {skipVoteStatus?.limit ?? 5} free votes per session</p>
                    </div>
                    <button
                      type="button"
                      disabled={!user || pollId == null || skipVoteStatus?.hasVoted || skipVoteMutation.isPending || (skipVoteStatus?.votes ?? 0) >= (skipVoteStatus?.limit ?? 5)}
                      onClick={() => { if (!user) { toast.error("Login to vote to skip"); return; } if (pollId != null) skipVoteMutation.mutate({ submissionId: pollId }); }}
                      className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {skipVoteStatus?.hasVoted ? "Vote counted" : skipVoteMutation.isPending ? "Counting…" : "Vote to skip"}
                    </button>
                  </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Music className="w-8 h-8 text-white/20" />
            </div>
            <p className="font-['Anton'] text-2xl uppercase text-white/20 mb-1">No Track Playing</p>
            <p className="text-white/20 text-sm">{isLive ? "Waiting for admin to start the next track..." : "Session is offline"}</p>
          </div>
        )}

        {/* ── LIVE CHAT ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white font-semibold text-sm uppercase tracking-wider">Live Chat</span>
            </div>
            {shouldShowViewerCount(isLive, viewerCountVisible) && (
              <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/20 rounded-full px-4 py-1.5">
                <Eye className="w-4 h-4 text-red-400" />
                <span className="font-['Anton'] text-lg text-white tabular-nums">{viewerCount.toLocaleString()}</span>
                <span className="text-red-400 text-[10px] uppercase tracking-widest">watching</span>
              </div>
            )}
          </div>

          {/* Messages — real and fake merged by timestamp */}
          <div ref={chatScrollRef} className="h-72 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
            {chatMessages.length === 0 && fakeMessages.length === 0 ? (
              <div className="text-center text-white/20 text-sm py-8">No messages yet — say something!</div>
            ) : (
              [
                ...chatMessages.map(m => ({ _type: 'real' as const, _ts: new Date(m.createdAt).getTime(), real: m })),
                ...fakeMessages.map(m => ({ _type: 'fake' as const, _ts: m.timestamp, fake: m })),
              ]
                .sort((a, b) => a._ts - b._ts)
                .map((entry, i) => {
                  if (entry._type === 'real') {
                    const msg = entry.real;
                    return (
                      <div key={`real-${i}`} className="text-xs leading-relaxed">
                        {(msg as any).type === 'system' ? (
                          <div className="text-white/20 text-center text-[10px] py-1">{(msg as any).text ?? msg.message}</div>
                        ) : (
                          <div className="flex items-start gap-1.5">
                            {msg.avatarUrl ? (
                              <img src={msg.avatarUrl} alt="" className="mt-0.5 h-4 w-4 rounded-full object-cover border border-white/15" />
                            ) : (
                              <span aria-hidden="true" className="mt-0.5 h-4 w-4 rounded-full bg-white/10 border border-white/10" />
                            )}
                            <div className="min-w-0">
                            <Link
                              href={`/profile/${msg.userId}`}
                              className={`font-semibold hover:underline hover:opacity-80 transition-opacity cursor-pointer ${
                                (msg as any).role === 'admin' || msg.isAdmin ? 'text-red-400' : (msg as any).role === 'judge' ? 'text-yellow-400' : 'text-white/80'
                              }`}
                            >
                              {msg.username}
                            </Link>
                            {(msg.isAdmin || (msg as any).role === 'admin') && <span className="ml-1 text-[8px] text-red-500 uppercase">Admin</span>}
                            {(msg as any).role === 'judge' && <span className="ml-1 text-[8px] text-yellow-500 uppercase">Judge</span>}
                            <span className="text-white/50 ml-1.5">{(msg as any).text ?? msg.message}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    const msg = entry.fake;
                    const isRealAccount = msg.userId > 0 && !msg.username.match(/^User\d+$/);
                    const nameClass = `font-semibold ${
                      msg.role === 'admin' ? 'text-red-400' : msg.role === 'judge' ? 'text-yellow-400' : 'text-white/70'
                    }`;
                    return (
                      <div key={msg.id} className="text-xs leading-relaxed flex items-start gap-1.5">
                        <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-white/10 border border-white/10" />
                        <div className="min-w-0">
                        {isRealAccount ? (
                          <a
                            href={`/profile/${msg.userId}`}
                            className={`${nameClass} hover:underline hover:opacity-80 transition-opacity cursor-pointer`}
                          >
                            {msg.username}
                          </a>
                        ) : (
                          <span className={nameClass}>{msg.username}</span>
                        )}
                        {msg.role === 'admin' && <span className="ml-1 text-[8px] text-red-500 uppercase">Admin</span>}
                        {msg.role === 'judge' && <span className="ml-1 text-[8px] text-yellow-500 uppercase">Judge</span>}
                        <span className="text-white/50 ml-1.5">{msg.text}</span>
                        </div>
                      </div>
                    );
                  }
                })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          <div className="px-4 py-3 border-t border-white/10">
            {user ? (
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  placeholder="Say something..."
                  maxLength={200}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl text-white px-4 py-2.5 focus:outline-none focus:border-red-600/40 placeholder-white/20 text-sm"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white rounded-xl px-4 py-2.5 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a href={getLoginUrl()} className="flex items-center justify-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors py-1">
                <LogIn className="w-4 h-4" />
                Login to chat
              </a>
            )}
          </div>
        </div>

        </div>

        {/* ── BOTTOM MENU TABS ────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
          {/* Tab navigation */}
          <div className="flex overflow-x-auto scrollbar-none border-b border-white/10">
            {([
              { id: "submit", label: "Submit Now", icon: "🎵" },
              { id: "queue", label: "Queue", icon: "📋" },
              { id: "history", label: "History", icon: "📜" },
              { id: "skip-info", label: "Skip Track", icon: "⏭️" },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${tab === t.id ? "text-white border-red-600 bg-red-600/5" : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.02]"}`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ── SUBMIT TAB ── */}
            {tab === "submit" && (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="text-center mb-6">
                  <h2 className="font-['Anton'] text-3xl uppercase mb-1">Submit Your <span className="text-red-600">Track</span></h2>
                  <p className="text-white/40 text-sm">Get your music reviewed live on air</p>
                  <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Review+</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/55">Unlimited Vote To Skip for $9.99/month.</p>
                      </div>
                      {reviewPlusStatus?.active ? (
                        <span className="rounded-full border border-green-400/40 bg-green-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-300">Active</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => createReviewPlusCheckout.mutate({ origin: window.location.origin })}
                          disabled={createReviewPlusCheckout.isPending}
                          className="rounded-lg bg-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-amber-300 disabled:opacity-50"
                        >
                          {createReviewPlusCheckout.isPending ? "Opening…" : "Join Review+"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="text-center py-8 border border-white/10 rounded-2xl">
                    <p className="text-white/40 text-sm mb-4">Login to submit your track</p>
                    <a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all">
                      <LogIn className="w-4 h-4" />
                      Login to Submit
                    </a>
                  </div>
                ) : paidSubmitSuccess ? (
                  <div className="text-center py-10 border border-yellow-500/30 bg-yellow-500/5 rounded-2xl">
                    <div className="text-4xl mb-3">🧾</div>
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Payment Submitted</div>
                    <p className="text-white/50 text-sm">Your paid submission is pending admin approval. We’ll move it into the queue after the receipt is verified.</p>
                    <button onClick={() => { setPaidSubmitSuccess(null); setPaidReceiptUrl(""); setSelectedPaidType(null); }} className="mt-4 text-red-400 text-xs hover:text-red-300 transition-colors">Submit another track</button>
                  </div>
                ) : submitted ? (
                  <div className="text-center py-10 border border-green-500/30 bg-green-500/5 rounded-2xl">
                    <div className="text-4xl mb-3">🎉</div>
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Submitted!</div>
                    <p className="text-white/50 text-sm">Your track is in the queue. Stay tuned!</p>
                    <button onClick={() => setSubmitted(false)} className="mt-4 text-red-400 text-xs hover:text-red-300 transition-colors">Submit another</button>
                  </div>
                ) : limitReachedData ? (
                  <div className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Session limit reached</p>
                      <h3 className="mt-1 font-['Anton'] text-2xl uppercase">Keep your track moving</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/55">{limitReachedData.message} Your first {MUSIC_REVIEW_FREE_SUBMISSION_LIMIT} submissions in each live session are free. Paid submissions stay pending until the team verifies payment.</p>
                    </div>
                    <div className="space-y-2">
                      {limitReachedData.upgradeOptions.map((option) => (
                        <button key={option.type} type="button" onClick={() => setSelectedPaidType(option.type as 'reentry5' | 'reentry10' | 'skip')} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedPaidType === option.type ? "border-red-500 bg-red-500/[0.12]" : "border-white/10 bg-white/[0.04] hover:border-red-500/40 hover:bg-red-500/[0.08]"}`}>
                          <span className="block text-sm font-bold text-white">{option.label}</span>
                          <span className="mt-1 block text-xs text-white/40">Cash App receipt required · ${option.price}</span>
                        </button>
                      ))}
                    </div>
                    {selectedPaidType && (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                        <button type="button" onClick={() => startPaidStripeCheckout(selectedPaidType)} disabled={submitting} className="w-full rounded-xl bg-red-600 px-3 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                          {submitting ? "Opening secure checkout..." : `Pay securely with Stripe — $${selectedPaidType === "reentry5" ? 5 : selectedPaidType === "reentry10" ? 10 : 20}`}
                        </button>
                        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/25"><span className="h-px flex-1 bg-white/10" />or Cash App<span className="h-px flex-1 bg-white/10" /></div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00D632]">Cash App: $MittenMedia</p>
                        <p className="text-xs leading-relaxed text-white/55">Pay the exact amount for the selected option, then paste the receipt URL. Admin approval is required before the paid submission is eligible for the queue.</p>
                        <input value={paidReceiptUrl} onChange={(event) => setPaidReceiptUrl(event.target.value)} placeholder="Cash App receipt URL" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/25 focus:border-green-500/50 focus:outline-none" />
                        <button type="button" onClick={() => handlePaidSubmit(selectedPaidType)} disabled={submitting || paidReceiptUrl.trim().length < 4} className="w-full rounded-xl border border-[#00D632]/40 bg-[#00D632]/10 px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#00D632] transition-colors hover:bg-[#00D632]/20 disabled:cursor-not-allowed disabled:opacity-40">
                          {submitting ? "Submitting for approval..." : "Submit Cash App Receipt →"}
                        </button>
                      </div>
                    )}
                    <button type="button" onClick={() => { setLimitReachedData(null); setPendingFormData(null); setPaidReceiptUrl(""); setSelectedPaidType(null); }} className="w-full text-xs text-white/40 transition-colors hover:text-white/70">Back to submission form</button>
                  </div>
                ) : (
                  <>
                    {data?.state?.playbackMode === "paid_only" && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Paid Only Mode</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/65">Submissions are currently paid only. Your track will open secure Stripe checkout and will not enter the queue unless payment is verified.</p>
                      </div>
                    )}
                    {/* Submit type toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-white/10">
                      <button onClick={() => setSubmitType("file")} className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${submitType === "file" ? "bg-red-600 text-white" : "text-white/40 hover:text-white/70"}`}>
                        🎵 Upload MP3
                      </button>
                      <button onClick={() => setSubmitType("youtube")} className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${submitType === "youtube" ? "bg-red-600 text-white" : "text-white/40 hover:text-white/70"}`}>
                        ▶️ YouTube Link
                      </button>
                    </div>

                    {/* Form fields */}
                    <input
                      value={form.songTitle}
                      onChange={e => setForm(f => ({ ...f, songTitle: e.target.value }))}
                      placeholder="Song Title *"
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 focus:outline-none focus:border-red-600/40 placeholder-white/20 text-sm"
                    />

                    {submitType === "youtube" ? (
                      <input
                        value={form.youtubeUrl}
                        onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                        placeholder="YouTube URL *"
                        className="w-full bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 focus:outline-none focus:border-red-600/40 placeholder-white/20 text-sm"
                      />
                    ) : (
                      <div>
                        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] ?? null)} />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white/5 border border-dashed border-white/20 rounded-xl text-white/50 px-4 py-6 hover:border-white/40 hover:text-white/70 transition-all text-sm text-center"
                        >
                          {audioFile ? `✓ ${audioFile.name}` : "Click to upload MP3 / Audio file"}
                        </button>
                      </div>
                    )}

                    <input
                      value={form.contactInfo}
                      onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                      placeholder="Contact Info (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 focus:outline-none focus:border-red-600/40 placeholder-white/20 text-sm"
                    />

                    <button
                      onClick={(e: any) => handleSubmit(e)}
                      disabled={submitting || !form.songTitle.trim() || (submitType === "youtube" ? !form.youtubeUrl.trim() : !audioFile)}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 text-white py-4 rounded-xl font-semibold uppercase tracking-widest transition-all"
                    >
                      {submitting ? (data?.state?.playbackMode === "paid_only" ? "Opening secure checkout..." : "Submitting...") : (data?.state?.playbackMode === "paid_only" ? "Continue to secure checkout →" : "Submit Track →")}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── QUEUE TAB ── */}
            {tab === "queue" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-['Anton'] text-xl uppercase">Queue</h3>
                  <span className="text-white/30 text-xs">{(data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? []).length} tracks</span>
                </div>
                {(data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? []).length === 0 ? (
                  <div className="text-center py-10 text-white/20 text-sm">Queue is empty</div>
                ) : (
                  <div className="space-y-2">
                    {(data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? []).map((sub: ReviewSubmission, idx: number) => (
                      <div key={sub.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${sub.status === "playing" ? "border-red-600/40 bg-red-600/5" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${sub.status === "playing" ? "bg-red-600 text-white" : "bg-white/10 text-white/50"}`}>
                          {sub.status === "playing" ? "▶" : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{sub.songTitle}</div>
                          <div className="text-white/40 text-xs truncate">{sub.artistName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {sub.skippedLine && <span className="text-[10px] bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 px-2 py-0.5 rounded-full">Skip</span>}
                          <StatusBadge status={sub.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === "history" && (
              <div>
                <h3 className="font-['Anton'] text-xl uppercase mb-4">Review History</h3>
                {(reviewedTracks ?? []).length === 0 ? (
                  <div className="text-center py-10 text-white/20 text-sm">No tracks reviewed yet</div>
                ) : (
                  <div className="space-y-2">
                    {(reviewedTracks ?? []).map((sub: ReviewSubmission) => (
                      <div key={sub.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-600/30 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{sub.songTitle}</div>
                          <div className="text-white/40 text-xs truncate">{sub.artistName}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">🔥 {sub.fireCount}</span>
                          <span className="flex items-center gap-1">🗑️ {sub.trashCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SKIP TRACK TAB ── */}
            {tab === "skip-info" && (
              <div className="max-w-lg mx-auto">
                {/* ── STEP 1: Select skip option ── */}
                {skipStep === "select" && (
                  <div>
                    <div className="text-center mb-6">
                      <div className="text-4xl mb-3">⏭️</div>
                      <h2 className="font-['Anton'] text-3xl uppercase mb-2">Skip the <span className="text-red-600">Line</span></h2>
                      <p className="text-white/40 text-sm">Jump ahead in the queue — all skips require admin approval after payment</p>
                    </div>
                    <div className="space-y-3">
                      {([
                        { label: "5 Spots Up", price: "$5", type: "reentry5" as const, desc: "Move 5 positions forward in the queue" },
                        { label: "10 Spots Up", price: "$10", type: "reentry10" as const, desc: "Move 10 positions forward in the queue" },
                        { label: "Skip to Front", price: "$20", type: "skip" as const, desc: "Jump straight to the front of the queue" },
                      ] as const).map(opt => (
                        <button
                          key={opt.type}
                          onClick={() => { setSelectedSkipType(opt.type); setSkipStep("pay"); }}
                          className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all text-left ${
                            selectedSkipType === opt.type
                              ? "border-red-500 bg-red-500/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-sm">{opt.label}</div>
                            <div className="text-white/40 text-xs mt-0.5">{opt.desc}</div>
                          </div>
                          <div className="font-['Anton'] text-2xl text-red-500">{opt.price}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-white/20 text-xs text-center mt-4">You must already have a track in the queue to purchase a skip.</p>
                  </div>
                )}

                {/* ── STEP 2: Choose payment method & pay ── */}
                {skipStep === "pay" && selectedSkipType && (
                  <div>
                    <button onClick={() => setSkipStep("select")} className="flex items-center gap-1 text-white/40 hover:text-white text-xs mb-4 transition-colors">
                      ← Back
                    </button>
                    <div className="text-center mb-5">
                      <div className="text-2xl font-['Anton'] text-red-500 mb-1">
                        {selectedSkipType === "reentry5" ? "$5 — 5 Spots Up" : selectedSkipType === "reentry10" ? "$10 — 10 Spots Up" : "$20 — Skip to Front"}
                      </div>
                      <p className="text-white/40 text-xs">Choose a payment method and send the exact amount</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {[
                        { name: "Cash App", handle: "$MittenMedia", link: "https://cash.app/$MittenMedia", icon: "💸", color: "border-[#00D632]/40 bg-[#00D632]/5", textColor: "text-[#00D632]" },
                        { name: "PayPal", handle: "@MurderMittenPromo", link: "https://paypal.me/MurderMittenPromo", icon: "🈿️", color: "border-[#009cde]/40 bg-[#003087]/5", textColor: "text-[#009cde]" },
                        { name: "Apple Pay", handle: "(313) 420-9004", link: "tel:3134209004", icon: "🍎", color: "border-white/20 bg-white/5", textColor: "text-white" },
                        { name: "Chime", handle: "DM on Instagram", link: "https://www.instagram.com/murdermittenmedia/", icon: "🏦", color: "border-[#00D632]/20 bg-[#00D632]/5", textColor: "text-[#00D632]" },
                      ].map(pm => (
                        <a
                          key={pm.name}
                          href={pm.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setSkipPaymentMethod(pm.name)}
                          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all hover:scale-105 ${
                            skipPaymentMethod === pm.name ? "ring-2 ring-red-500 " + pm.color : pm.color
                          }`}
                        >
                          <span className="text-2xl">{pm.icon}</span>
                          <span className={`text-xs font-bold ${pm.textColor}`}>{pm.name}</span>
                          <span className="text-white/40 text-[10px] text-center">{pm.handle}</span>
                        </a>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleStripeSkipCheckout}
                        disabled={skipSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-[#635bff] hover:bg-[#5148e8] disabled:opacity-50 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
                      >
                        {skipSubmitting ? "Opening Stripe…" : "Pay securely with Stripe"}
                      </button>
                      <div className="text-center text-white/30 text-[10px] uppercase tracking-widest">or pay manually with Cash App above</div>
                      <div>
                        <label className="text-white/60 text-xs uppercase tracking-wider block mb-1">Cash App receipt / confirmation URL <span className="text-white/30">(optional but speeds up approval)</span></label>
                        <input
                          type="url"
                          value={skipReceiptUrl}
                          onChange={e => setSkipReceiptUrl(e.target.value)}
                          placeholder="https://cash.app/receipt/..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
                        />
                      </div>
                      <button
                        onClick={() => setSkipStep("confirm")}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
                      >
                        I’ve Sent Payment — Submit Request
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Confirm submission ── */}
                {skipStep === "confirm" && (
                  <div className="text-center">
                    <button onClick={() => setSkipStep("pay")} className="flex items-center gap-1 text-white/40 hover:text-white text-xs mb-4 transition-colors">
                      ← Back
                    </button>
                    <div className="text-4xl mb-4">✅</div>
                    <h3 className="font-['Anton'] text-2xl uppercase mb-2">Confirm Your Skip</h3>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 text-left space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Skip Type</span>
                        <span className="text-white font-semibold">{selectedSkipType === "reentry5" ? "5 Spots Up" : selectedSkipType === "reentry10" ? "10 Spots Up" : "Skip to Front"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/40">Amount</span>
                        <span className="text-red-400 font-bold">{selectedSkipType === "reentry5" ? "$5" : selectedSkipType === "reentry10" ? "$10" : "$20"}</span>
                      </div>
                      {skipPaymentMethod && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Paid via</span>
                          <span className="text-white">{skipPaymentMethod}</span>
                        </div>
                      )}
                      {skipReceiptUrl && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Receipt</span>
                          <a href={skipReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs truncate max-w-[180px]">View</a>
                        </div>
                      )}
                    </div>
                    <p className="text-white/30 text-xs mb-5">Your skip request will be pending until the admin verifies your payment. You’ll move up in the queue once confirmed.</p>
                    <button
                      onClick={handleSkipPurchase}
                      disabled={skipSubmitting}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-colors"
                    >
                      {skipSubmitting ? "Submitting..." : "Submit Skip Request"}
                    </button>
                  </div>
                )}

                {/* ── STEP 4: Done ── */}
                {skipStep === "done" && (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-4">🚀</div>
                    <h3 className="font-['Anton'] text-2xl uppercase mb-2">Request Submitted!</h3>
                    <p className="text-white/40 text-sm mb-6">Your skip request is pending admin approval. Once confirmed, you’ll move up in the queue automatically.</p>
                    <button
                      onClick={() => { setSkipStep("select"); setSelectedSkipType(null); setSkipReceiptUrl(""); setSkipPaymentMethod(""); }}
                      className="text-red-500 hover:text-red-400 text-sm underline transition-colors"
                    >
                      Submit Another Skip
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── VOICE ROOM (if joined) ──────────────────────────── */}
        {showVoicePanel && (
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-purple-400" />
                <span className="text-white font-semibold text-sm uppercase tracking-wider">Voice Room</span>
              </div>
              <button onClick={() => setShowVoicePanel(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Voice room content handled by audioRoom hooks */}
            <p className="text-white/40 text-sm text-center py-4">Voice room active — use the controls above to manage your audio.</p>
          </div>
        )}

      </div>
    </div>
  );
}
