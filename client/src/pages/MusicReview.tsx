/* ============================================================
   MURDER MITTEN MEDIA — Music Review (Revamped)
   Clean, functional layout for viewers and admin.
   Admin: compact top bar, now-playing card, drag queue
   Viewer: hero, now-being-reviewed banner, fire/trash poll,
           queue list, submit form, chat sidebar
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { io } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { LiveRadioBanner } from "@/components/LiveRadioBanner";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { useChat, type LiveReviewActiveItem, type LiveReviewPlayback } from "@/hooks/useChat";
import { useAudioRoom } from "@/hooks/useAudioRoom";
import { useVideoRoom } from "@/hooks/useVideoRoom";
import { useAdminMicBroadcast } from "@/hooks/useAdminMicBroadcast";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import LabelBadge from "@/components/LabelBadge";
import { UserBadges } from "@/components/UserBadges";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { SyncedYouTubePlayer } from "@/components/SyncedYouTubePlayer";
import { registerSeekBroadcast, registerPauseBroadcast, registerResumeBroadcast } from "@/contexts/RadioSeekBroadcastContext";

// Types inferred from tRPC query
type ReviewSubmission = { id: number; userId?: number | null; artistName: string; songTitle: string; submissionType: "youtube" | "file"; youtubeUrl: string | null; fileKey: string | null; fileUrl: string | null; contactInfo: string | null; status: "pending" | "playing" | "reviewed" | "removed"; skippedLine: boolean; skipPaymentConfirmed: boolean; position: number; notes: string | null; fireCount: number; trashCount: number; createdAt: Date; updatedAt: Date };
type QueueState = { id: number; isLive: boolean; liveMessage: string | null; streamUrl: string | null; currentPlayingId: number | null; updatedAt: Date };
type QueueAllData = { submissions: ReviewSubmission[]; state: QueueState | null; currentPlaying: ReviewSubmission | null };

import {
  Mic, MicOff, Video, VideoOff, Radio, Play, Pause, SkipForward,
  Trash2, CheckCircle, ChevronDown, ChevronUp, Settings, Users,
  ExternalLink, Flame, ThumbsDown, Crown, AlertCircle, RotateCcw, Music,
  GripVertical, X, Send, LogIn,
} from "lucide-react";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const CASHAPP = "$joyfuljules";
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
    playing: { label: "🎵 Now Playing", cls: "bg-red-600/30 text-red-400 border-red-600/60 animate-pulse" },
    reviewed: { label: "Reviewed", cls: "bg-green-600/20 text-green-400 border-green-600/40" },
    removed: { label: "Removed", cls: "bg-white/10 text-white/30 border-white/20" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-xs border px-2 py-0.5 uppercase tracking-wider font-semibold rounded-sm ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Admin Panel ───────────────────────────────────────────────
function AdminPanel({
  data, refetch, audioRoom, videoRoom, broadcastReviewActive, broadcastRadioPause, broadcastRadioResume, broadcastRadioSeek, broadcastReviewPlayback, broadcastReviewQueueUpdated, broadcastLastSong, adminMicBroadcast, playTrack, setSelectedYouTube, reviewedTracks,
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
}) {
  const [streamUrlInput, setStreamUrlInput] = useState(data?.state?.streamUrl ?? "");
  const [liveMsg, setLiveMsg] = useState(data?.state?.liveMessage ?? "");
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);
  const audioPlayer = useAudioPlayer();

  const setLive = trpc.queue.setLive.useMutation({ onSuccess: () => refetch() });
  const setPlaying = trpc.queue.setPlaying.useMutation({ onSuccess: () => refetch() });
  const updateStatus = trpc.queue.updateStatus.useMutation({ onSuccess: () => refetch() });
  const confirmSkip = trpc.queue.confirmSkip.useMutation({ onSuccess: () => refetch() });
  const requeueMutation = trpc.queue.requeue.useMutation({
    onSuccess: () => { refetch(); broadcastReviewQueueUpdated(); toast.success("Song re-queued"); },
    onError: () => toast.error("Failed to re-queue song"),
  });

  const isLive = data?.state?.isLive ?? false;
  const currentPlaying = data?.currentPlaying;
  const queue: ReviewSubmission[] = data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? [];

  // Drag-to-reorder state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [localQueue, setLocalQueue] = useState<ReviewSubmission[]>([]);
  // Keep a stable ref to localQueue so onEnded callback always sees latest without re-subscribing
  const localQueueRef = useRef<ReviewSubmission[]>([]);
  localQueueRef.current = localQueue;
  useEffect(() => {
    if (draggedId === null) setLocalQueue(queue);
  }, [queue, draggedId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // YouTube timer: when a YouTube track is loaded, admin can manually skip or it stays until skipped
  // We track whether the current playing track is a YouTube submission
  const currentIsYouTube = currentPlaying?.submissionType === "youtube";

  const handleSetPlaying = async (id: number) => {
    // Search localQueue first (respects drag order), fall back to full queue
    const sub = localQueue.find(s => s.id === id) ?? queue.find(s => s.id === id);
    if (!sub) return;
    // Clear any existing YouTube embed before loading new track
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

  // Helper: advance to next track in localQueue order (respects drag reorder)
  const advanceToNext = (skipId: number) => {
    // Use localQueue order — this is the drag-reordered order
    const pendingInOrder = localQueue.filter(s => s.status === "pending" && s.id !== skipId);
    const next = pendingInOrder[0] ?? null;
    // Clear YouTube embed
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
            toast.success(`\u25b6 Auto-advancing to: ${next.songTitle}`);
          }
        });
      }, 400);
    } else {
      setPlaying.mutate({ submissionId: null }, {
        onSuccess: () => {
          broadcastReviewActive({ submissionId: null });
          broadcastReviewQueueUpdated();
          toast("Queue finished \u2014 all tracks reviewed!");
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

  // Stable refs so the onEnded callback never has a stale closure
  const updateStatusRef = useRef(updateStatus);
  updateStatusRef.current = updateStatus;
  const advanceToNextRef = useRef(advanceToNext);
  advanceToNextRef.current = advanceToNext;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  // Auto-advance: when an audio track finishes, mark it reviewed and load the next one in localQueue order.
  // Uses refs so this effect only subscribes ONCE and never fires with stale data.
  useEffect(() => {
    const unsubscribe = audioPlayer.onEnded((finishedTrack) => {
      // Only handle tracks that are live Music Review streams (not regular audio)
      if (!finishedTrack.isStream || finishedTrack.sourcePage !== "Music Review") return;
      // Match against localQueueRef (always latest drag-reordered state)
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
    <div className="border border-red-600/40 bg-[#0d0000] rounded-sm mb-8">
      {/* ── Admin header bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-600/20 bg-red-600/5">
        <div className="flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Admin Controls</span>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Row 1: Go Live + Stream URL inline ── */}
        <div className="flex gap-2 items-stretch">
          <button
            onClick={handleGoLive}
            disabled={setLive.isPending}
            className={`flex-shrink-0 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              isLive
                ? "bg-red-600/20 border border-red-600/60 text-red-400 hover:bg-red-600/30"
                : "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(209,0,0,0.3)]"
            }`}
          >
            {isLive ? "⏹ End Stream" : "🔴 Go Live"}
          </button>
          <input
            type="url"
            value={streamUrlInput}
            onChange={e => setStreamUrlInput(e.target.value)}
            placeholder="Stream URL (YouTube Live / HLS)"
            className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20 min-w-0"
          />
          <button
            onClick={() => setShowStreamSettings(v => !v)}
            className="border border-white/20 text-white/40 hover:text-white px-3 transition-colors flex-shrink-0"
            title="More stream settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stream settings (collapsible) */}
        {showStreamSettings && (
          <div className="border border-white/10 bg-black/30 p-3 space-y-2">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">Live Message</label>
              <input
                type="text"
                value={liveMsg}
                onChange={e => setLiveMsg(e.target.value)}
                placeholder="e.g. Submitting tracks now — drop yours below!"
                className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20"
              />
            </div>
            <button
              onClick={() => {
                setLive.mutate({ isLive, message: liveMsg || undefined, streamUrl: streamUrlInput || undefined });
                toast.success("Settings saved");
              }}
              className="w-full border border-white/20 text-white/60 hover:text-white py-1.5 text-xs uppercase tracking-widest transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}

        {/* ── Row 2: Mic / Camera / Mic→Radio in one row ── */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={audioRoom.toggleMic}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider border transition-all ${
              audioRoom.isMuted
                ? "border-white/20 text-white/40 hover:border-white/40"
                : "border-green-500/50 bg-green-500/10 text-green-400"
            }`}
          >
            {audioRoom.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            {audioRoom.isMuted ? "Mic Off" : "Mic On"}
          </button>
          <button
            onClick={videoRoom.toggleCamera}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider border transition-all ${
              videoRoom.cameraActive
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-white/20 text-white/40 hover:border-white/40"
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
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider border transition-all ${
              adminMicBroadcast.isBroadcasting
                ? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
                : "border-white/20 text-white/40 hover:border-red-500/40 hover:text-red-400"
            }`}
            title={adminMicBroadcast.isBroadcasting ? "Stop mic broadcast" : "Broadcast mic to radio"}
          >
            {adminMicBroadcast.isBroadcasting ? <Mic className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
            {adminMicBroadcast.isBroadcasting ? "Mic Live" : "Mic→Radio"}
          </button>
        </div>

        {/* ── Pending skip payments ── */}
        {pendingSkips.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-3">
            <div className="text-yellow-400 text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingSkips.length} Unconfirmed Skip Payment{pendingSkips.length > 1 ? "s" : ""}
            </div>
            {pendingSkips.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-yellow-500/10 first:border-0">
                <div>
                  <span className="text-white text-xs font-semibold">{s.artistName}</span>
                  <span className="text-white/40 text-xs ml-2">— {s.songTitle}</span>
                </div>
                <button
                  onClick={() => { confirmSkip.mutate({ id: s.id }); toast.success("Skip payment confirmed"); }}
                  className="text-xs bg-yellow-500 text-black px-2 py-1 font-bold uppercase hover:bg-yellow-400 transition-colors flex-shrink-0"
                >
                  Confirm $10
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Now Playing card ── */}
        {currentPlaying ? (
          <div className="border border-red-600/40 bg-red-600/8 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-red-400 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Now Playing
              </span>
            </div>
            <div className="text-white font-semibold text-sm truncate mb-0.5">{currentPlaying.songTitle}</div>
            <div className="text-white/50 text-xs mb-3">by <ArtistLink artistName={currentPlaying.artistName} userId={currentPlaying.userId} /></div>
            {/* Transport controls — YouTube vs audio */}
            {currentIsYouTube ? (
              <div className="space-y-2">
                <div className="border border-orange-500/30 bg-orange-500/5 p-2 text-[10px] text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  YouTube track — your position is synced to viewers in real-time.
                </div>
                {currentPlaying.youtubeUrl && (() => {
                  const ytId = extractYouTubeId(currentPlaying.youtubeUrl!);
                  return ytId ? (
                    <SyncedYouTubePlayer
                      videoId={ytId}
                      submissionId={currentPlaying.id}
                      isAdmin={true}
                      className="border border-white/10"
                    />
                  ) : null;
                })()}
                <button
                  onClick={handleSkip}
                  className="w-full flex items-center justify-center gap-1.5 border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Done — Skip to Next Track
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => { audioPlayer.pause(); broadcastRadioPause(audioPlayer.currentTime); }}
                  className="flex items-center justify-center gap-1 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 py-2 text-[10px] uppercase tracking-wider transition-colors"
                  title="Pause for all listeners"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
                <button
                  onClick={() => { audioPlayer.resume(); broadcastRadioResume(audioPlayer.currentTime); }}
                  className="flex items-center justify-center gap-1 border border-green-500/40 text-green-400 hover:bg-green-500/10 py-2 text-[10px] uppercase tracking-wider transition-colors"
                  title="Resume for all listeners"
                >
                  <Play className="w-3 h-3" />
                  Play
                </button>
                <button
                  onClick={() => { audioPlayer.seek(0); broadcastRadioSeek(0); }}
                  className="flex items-center justify-center gap-1 border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 py-2 text-[10px] uppercase tracking-wider transition-colors"
                  title="Rewind to start"
                >
                  <RotateCcw className="w-3 h-3" />
                  Rewind
                </button>
                <button
                  onClick={handleSkip}
                  className="flex items-center justify-center gap-1 border border-white/20 text-white/60 hover:text-white py-2 text-[10px] uppercase tracking-wider transition-colors"
                  title="Skip to next track"
                >
                  <SkipForward className="w-3 h-3" />
                  Skip
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-white/10 bg-white/[0.02] p-3 text-center">
            <span className="text-white/30 text-xs uppercase tracking-wider">No track loaded — select from queue below</span>
          </div>
        )}

        {/* ── Queue with drag handles ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">
              Queue ({localQueue.length})
            </span>
            <span className="text-white/20 text-[10px]">Drag to reorder</span>
          </div>
          {localQueue.length === 0 ? (
            <div className="text-center py-4 text-white/20 text-xs border border-white/10">Queue is empty</div>
          ) : (
            <div className="space-y-1">
              {localQueue.map((sub, i) => (
                <div
                  key={sub.id}
                  draggable
                  onDragStart={() => handleDragStart(sub.id)}
                  onDragOver={(e) => handleDragOver(e, sub.id)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center gap-2 p-2 border text-xs cursor-grab active:cursor-grabbing transition-all ${
                    draggedId === sub.id ? "opacity-30 scale-95" :
                    sub.status === "playing"
                      ? "border-red-600/50 bg-red-600/10"
                      : sub.skipPaymentConfirmed
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <GripVertical className="w-3 h-3 text-white/20 flex-shrink-0" />
                  <span className="text-white/30 w-4 text-center flex-shrink-0 font-mono">
                    {sub.status === "playing" ? "▶" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{sub.songTitle}</div>
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
                        className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-green-500/40 text-green-400 hover:bg-green-500/10 px-1.5 py-0.5 transition-colors"
                        title="Load to Now Playing"
                      >
                        <Play className="w-2.5 h-2.5" /> Load
                      </button>
                    )}
                    {sub.status === "playing" && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-red-500/40 text-red-400 px-1.5 py-0.5">
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
              className="flex items-center justify-between w-full text-white/40 text-xs uppercase tracking-wider hover:text-white/60 transition-colors py-1"
            >
              <span>Previously Reviewed ({reviewedTracks.length})</span>
              {showReviewed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showReviewed && (
              <div className="space-y-1 mt-2 max-h-48 overflow-y-auto">
                {reviewedTracks.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 p-2 border border-white/10 bg-white/[0.02] text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">{sub.songTitle}</div>
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
                      className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 px-1.5 py-0.5 transition-colors flex-shrink-0"
                    >
                      <Play className="w-2.5 h-2.5" /> Load
                    </button>
                    <button
                      onClick={() => requeueMutation.mutate({ id: sub.id })}
                      disabled={requeueMutation.isPending}
                      className="flex items-center gap-0.5 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-yellow-500 hover:text-yellow-400 px-1.5 py-0.5 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Re-queue
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
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Room Participants
            </div>
            <div className="space-y-1">
              {audioRoom.participants.filter(p => p.role !== "viewer").map(p => (
                <div key={p.socketId} className="flex items-center gap-2 p-2 border border-white/10 bg-white/[0.02] text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.micActive ? "bg-green-400" : "bg-white/20"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-semibold">{p.username}</span>
                    <span className={`ml-2 text-[10px] uppercase font-bold ${
                      p.role === "judge" ? "text-yellow-400" : p.role === "admin" ? "text-red-400" : "text-white/40"
                    }`}>{p.role}</span>
                  </div>
                  <button
                    onClick={() => audioRoom.adminToggleParticipantMic(p.socketId, !p.micActive)}
                    className={`flex items-center gap-1 px-2 py-1 border text-[10px] uppercase font-bold transition-colors ${
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

// ── Fire/Trash Poll ───────────────────────────────────────────
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
    <div className="border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <span className="text-white/50 text-xs uppercase tracking-widest font-semibold">Rate This Track</span>
        {hasVoted && (
          <span className="text-xs font-semibold">
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
          className={`group flex flex-col items-center justify-center gap-3 py-10 transition-all duration-200 ${
            myReaction === "fire" ? "bg-orange-500/20 cursor-default" :
            hasVoted ? "opacity-40 cursor-not-allowed" :
            "hover:bg-orange-500/10 active:bg-orange-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-6xl transition-transform duration-200 select-none ${
            myReaction === "fire" ? "scale-125" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🔥</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-3xl transition-colors ${
              myReaction === "fire" ? "text-orange-300" : "text-orange-400 group-hover:text-orange-300"
            }`}>FIRE</div>
            <div className="text-white/30 text-xs uppercase tracking-widest mt-0.5">This a banger</div>
          </div>
        </button>
        <button
          onClick={() => {
            if (!user) { toast.error("Login to vote"); return; }
            if (hasVoted) { toast.error("You already voted!"); return; }
            onVote("trash");
          }}
          disabled={hasVoted || isPending}
          className={`group flex flex-col items-center justify-center gap-3 py-10 transition-all duration-200 ${
            myReaction === "trash" ? "bg-blue-500/20 cursor-default" :
            hasVoted ? "opacity-40 cursor-not-allowed" :
            "hover:bg-blue-500/10 active:bg-blue-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-6xl transition-transform duration-200 select-none ${
            myReaction === "trash" ? "scale-125" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🗑️</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-3xl transition-colors ${
              myReaction === "trash" ? "text-blue-300" : "text-blue-400 group-hover:text-blue-300"
            }`}>TRASH</div>
            <div className="text-white/30 text-xs uppercase tracking-widest mt-0.5">Next track please</div>
          </div>
        </button>
      </div>

      {/* Live results bar */}
      <div className="border-t border-white/10">
        <div className="flex">
          <div className="h-2 bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700" style={{ width: `${firePct}%` }} />
          <div className="h-2 bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-700" style={{ width: `${trashPct}%` }} />
        </div>
        <div className="flex justify-between px-4 py-2 text-xs">
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const audioPlayer = useAudioPlayer();
  const { playTrack: resolveAndPlay } = usePlayTrack();

  const { data, refetch, isLoading } = trpc.queue.getAll.useQuery(undefined, { refetchInterval: 5000 });
  const { data: reviewedTracks } = trpc.queue.getReviewed.useQuery(undefined, { refetchInterval: 30000 });

  // Line skip credits from Daily Wheel prize
  const { data: lineSkipCreditsData, refetch: refetchLineSkipCredits } = trpc.dailyWheel.getMyLineSkipCredits.useQuery(
    undefined,
    { enabled: !!user }
  );
  const lineSkipCredits = lineSkipCreditsData ?? 0;

  const [limitReachedData, setLimitReachedData] = useState<{ success: false; limitReached: true; message: string; upgradeOptions: Array<{ type: string; price: number; label: string }> } | null>(null);
  
  const submitMutation = trpc.queue.submit.useMutation({
    onSuccess: (data) => {
      if (!data.success && 'limitReached' in data && data.limitReached && 'message' in data && 'upgradeOptions' in data) {
        setLimitReachedData(data as any);
        setSubmitting(false);
        toast.error(data.message as string);
      } else if (data.success) {
        setSubmitted(true); setSubmitting(false); refetch();
      }
    },
    onError: (err) => { toast.error("Submission failed: " + err.message); setSubmitting(false); },
  });
  const uploadAudioMutation = trpc.queue.uploadAudio.useMutation({
    onSuccess: (data) => {
      if (!data.success && 'limitReached' in data && data.limitReached && 'message' in data && 'upgradeOptions' in data) {
        setLimitReachedData(data as any);
        setSubmitting(false);
        toast.error(data.message as string);
      } else if (data.success) {
        setSubmitted(true); setSubmitting(false); refetch();
      }
    },
    onError: (err) => { toast.error("Upload failed: " + err.message); setSubmitting(false); },
  });
  const useLineSkipMutation = trpc.dailyWheel.useLineSkip.useMutation({
    onSuccess: (result) => {
      toast.success(`Line skip applied! Credits remaining: ${result.creditsRemaining}`);
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
  const [liveReviewActive, setLiveReviewActive] = useState<LiveReviewActiveItem | null>(null);
  // YouTube timestamp sync state for late-joiner seek
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

  // Auto-advance is handled inside AdminPanel where mutations are available

  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

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
  } = useChat({
    room: "music_review",
    username: chatUsername,
    userId: user?.id,
    isAdmin,
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

  // Initialize from DB for late joiners
  useEffect(() => {
    if (!liveReviewActive && data?.currentPlaying) {
      const cp = data.currentPlaying;
      setActiveSubmissionId(cp.id);
      setLiveReviewActive({
        submissionId: cp.id,
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

    if (submitType === "file" && audioFile) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
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
      submitMutation.mutate({
        songTitle: form.songTitle,
        submissionType: "youtube",
        youtubeUrl: form.youtubeUrl,
        contactInfo: form.contactInfo || undefined,
        wantsSkip: form.wantsSkip,
      });
    }
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

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden pb-24">
      <SiteNav />
      {!isAdmin && !isLive && <LiveRadioBanner filter="review" />}

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="pt-20 pb-6 border-b border-white/10">
        <div className="container">
          {/* Status + title */}
          <div className="flex items-center gap-3 mb-3">
            {isLive ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-bold">Live Now</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                <span className="text-white/30 text-xs uppercase tracking-[0.3em]">Stream Offline</span>
              </>
            )}
          </div>
          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase mb-2">
            MUSIC <span className="text-red-600">REVIEW</span>
          </h1>
          <p className="text-white/40 text-sm max-w-xl mb-5">
            Submit your track for a live review. Get in line, or skip to the front for $10.
          </p>

          {/* Stream embed / live radio card */}
          {isLive && streamUrl ? (
            <div className="mb-2">
              {(streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be")) ? (
                <div className="relative w-full aspect-video max-w-3xl bg-black border border-white/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${
                      streamUrl.includes("v=")
                        ? streamUrl.split("v=")[1]?.split("&")[0]
                        : streamUrl.split("/").pop()
                    }?autoplay=1`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="border border-red-600/30 bg-red-600/5 p-5 max-w-3xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-['Anton'] text-lg uppercase">Murder Mitten Media — LIVE</div>
                    {liveMessage && <div className="text-white/50 text-sm mt-0.5">{liveMessage}</div>}
                  </div>
                  <button
                    onClick={playStream}
                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" /> Listen Live
                  </button>
                </div>
              )}
            </div>
          ) : isLive ? (
            <div className="border border-red-600/30 bg-red-600/5 p-4 max-w-3xl mb-2 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div>
                <div className="text-red-400 text-sm font-semibold">Session is Live</div>
                {liveMessage && <div className="text-white/40 text-xs mt-0.5">{liveMessage}</div>}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="container py-6">
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="min-w-0">

            {/* Admin panel */}
            {isAdmin && (
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
                reviewedTracks={reviewedTracks ?? []}
              />
            )}

            {/* Inline YouTube embed */}
            {selectedYouTube && (() => {
              const ytId = extractYouTubeId(selectedYouTube.url);
              return (
                <div className="mb-5 border border-white/20 bg-black/60 p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-['Anton'] text-lg uppercase">{selectedYouTube.title}</div>
                      <div className="text-white/50 text-xs">by {selectedYouTube.artist}</div>
                    </div>
                    <button onClick={() => setSelectedYouTube(null)} className="text-white/30 hover:text-white text-xl leading-none px-2" title="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {ytId ? (
                    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                        className="absolute inset-0 w-full h-full border border-white/10"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={selectedYouTube.title}
                      />
                    </div>
                  ) : (
                    <div className="text-white/40 text-sm py-4 text-center">
                      <a href={selectedYouTube.url} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">Open on YouTube →</a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NOW BEING REVIEWED banner ── */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="mb-5 border border-red-600/50 bg-red-600/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent animate-pulse" />
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Being Reviewed</span>
                </div>
                <div className="font-['Anton'] text-2xl md:text-3xl uppercase mb-0.5">{liveReviewActive.songTitle}</div>
                <div className="text-white/60 text-sm mb-3">
                  by <ArtistLink artistName={liveReviewActive.artistName ?? ''} userId={liveReviewActive.userId ?? null} />
                </div>
                {liveReviewActive.audioUrl && !isAdmin && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span className="font-semibold text-xs uppercase tracking-wider">Playing Live — synced to admin</span>
                    </div>
                    {/* Big Tune In CTA — user gesture required for browser autoplay */}
                    {!audioPlayer.isPlaying ? (
                      <button
                        onClick={() => {
                          const track = {
                            url: liveReviewActive.audioUrl!,
                            title: liveReviewActive.songTitle ?? 'Live Track',
                            artist: liveReviewActive.artistName ?? 'Murder Mitten Media',
                            artworkUrl: LOGO,
                            isStream: true,
                            submissionId: liveReviewActive.submissionId ?? undefined,
                            sourcePage: 'Music Review',
                            sourceUrl: '/review',
                          };
                          // Request current radio state to sync to admin's exact position
                          const socket = io(window.location.origin, {
                            path: "/api/socket.io",
                            query: { room: "global" },
                          });
                          let responded = false;
                          socket.on("connect", () => socket.emit("radio:get_state"));
                          socket.on("radio:state", (data: any) => {
                            if (responded) return;
                            responded = true;
                            socket.disconnect();
                            const seekTo = data?.currentTime ?? 0;
                            if (seekTo > 1) {
                              // playWithSeek: starts audio and seeks to admin's position on canplay
                              audioPlayer.playWithSeek(track, seekTo);
                              if (data?.pausedAt !== null && data?.pausedAt !== undefined) {
                                setTimeout(() => audioPlayer.pause(), 500);
                              }
                            } else {
                              audioPlayer.play(track);
                            }
                          });
                          // Fallback: if no response in 1.5s, play from start
                          setTimeout(() => {
                            if (!responded) {
                              responded = true;
                              socket.disconnect();
                              audioPlayer.play(track);
                            }
                          }, 1500);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white py-4 text-base font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_30px_rgba(209,0,0,0.5)]"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                        🎙 Tap to Listen Live
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-green-400 text-xs font-semibold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        You're tuned in
                      </div>
                    )}
                  </div>
                )}
                {liveReviewActive.youtubeUrl && !isAdmin && (() => {
                  const ytId = extractYouTubeId(liveReviewActive.youtubeUrl!);
                  return ytId ? (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2 text-orange-400 text-xs font-semibold uppercase tracking-wider">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        Watch synced to admin’s position
                      </div>
                      <SyncedYouTubePlayer
                        videoId={ytId}
                        submissionId={liveReviewActive.submissionId!}
                        isAdmin={false}
                        initialCurrentTime={ytSyncState?.currentTime ?? null}
                        initialUpdatedAt={ytSyncState?.updatedAt ?? null}
                        className="border border-white/10"
                      />
                      <a href={liveReviewActive.youtubeUrl!} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors mt-2">
                        <ExternalLink className="w-3 h-3" /> Open on YouTube
                      </a>
                    </div>
                  ) : (
                    <a href={liveReviewActive.youtubeUrl!} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-1">
                      <ExternalLink className="w-3.5 h-3.5" /> Open on YouTube
                    </a>
                  );
                })()}
              </div>
            )}

            {/* ── FIRE / TRASH POLL ── */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="mb-5">
                <FireTrashPoll
                  submissionId={liveReviewActive.submissionId}
                  songTitle={liveReviewActive.songTitle ?? ""}
                  artistName={liveReviewActive.artistName ?? ""}
                  fireCount={fire}
                  trashCount={trash}
                  myReaction={myReaction?.reaction ?? null}
                  onVote={(reaction) => reactMutation.mutate({ submissionId: liveReviewActive.submissionId!, reaction })}
                  isPending={reactMutation.isPending}
                  user={user}
                />
              </div>
            )}

            {/* Fallback poll for currentPlaying when liveReviewActive is not set */}
            {!liveReviewActive && currentPlaying && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-['Anton'] text-lg uppercase">{currentPlaying.songTitle}</span>
                  <span className="text-white/40 text-xs">by <ArtistLink artistName={currentPlaying.artistName} userId={currentPlaying.userId} /></span>
                </div>
                <FireTrashPoll
                  submissionId={currentPlaying.id}
                  songTitle={currentPlaying.songTitle}
                  artistName={currentPlaying.artistName}
                  artistUserId={currentPlaying.userId}
                  fireCount={fire}
                  trashCount={trash}
                  myReaction={myReaction?.reaction ?? null}
                  onVote={(reaction) => reactMutation.mutate({ submissionId: currentPlaying.id, reaction })}
                  isPending={reactMutation.isPending}
                  user={user}
                />
              </div>
            )}

            {/* ── TABS: Queue / Submit / Skip Line ── */}
            <div className="flex gap-0 mb-4 border border-white/10">
             {(["queue", "history", "submit", "skip-info"] as SubmitTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-semibold transition-all border-r last:border-r-0 border-white/10 ${
                    tab === t
                      ? "bg-red-600 text-white"
                      : t === "skip-info"
                      ? "text-yellow-500/70 hover:text-yellow-400"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {t === "queue" ? `Queue (${pendingQueue.length})` : t === "history" ? "History" : t === "submit" ? "Submit Track" : "⚡ Skip Line ($10)"}
                </button>
              ))}
            </div>

            {/* ── QUEUE VIEW ── */}
            {tab === "queue" && (
              <div>
                {isLoading ? (
                  <div className="text-center py-16 text-white/30 text-sm">Loading queue...</div>
                ) : pendingQueue.length === 0 ? (
                  <div className="text-center py-12 border border-white/10 bg-white/[0.02]">
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Queue is Empty</div>
                    <p className="text-white/40 text-sm mb-5">Be the first to submit your track!</p>
                    <button
                      onClick={() => setTab("submit")}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all"
                    >
                      Submit Your Track →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingQueue.map((sub, i) => (
                      <div
                        key={sub.id}
                        className={`flex items-center gap-3 p-3 border transition-all ${
                          sub.status === "playing"
                            ? "border-red-600/60 bg-red-600/10"
                            : sub.skipPaymentConfirmed
                            ? "border-yellow-500/40 bg-yellow-500/5"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        {/* Position number */}
                        <div className={`w-8 h-8 flex items-center justify-center font-['Anton'] text-lg flex-shrink-0 ${
                          sub.status === "playing" ? "text-red-500" : "text-white/20"
                        }`}>
                          {sub.status === "playing" ? "▶" : i + 1}
                        </div>
                        {/* Song info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate text-sm">{sub.songTitle}</div>
                          <div className="text-white/50 text-xs truncate">
                            <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                            {sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-400 font-bold">⚡ Skip Confirmed</span>}
                            {sub.skippedLine && !sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-600">⚡ Pending Payment</span>}
                          </div>
                        </div>
                        {/* Status + reactions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={sub.status} />
                          <span className="flex items-center gap-1 text-xs text-white/30">
                            <Flame className="w-3 h-3 text-orange-500/60" />
                            {sub.fireCount}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-white/30">
                            <ThumbsDown className="w-3 h-3 text-blue-500/60" />
                            {sub.trashCount}
                          </span>
                          {sub.submissionType === "youtube" && sub.youtubeUrl && (
                            <button
                              onClick={() => setSelectedYouTube({ url: sub.youtubeUrl!, title: sub.songTitle, artist: sub.artistName })}
                              className="text-white/30 hover:text-red-400 transition-colors"
                              title="Watch on page"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Free line skip button — only for user's own pending submissions */}
                          {user && sub.userId === user.id && !sub.skippedLine && lineSkipCredits > 0 && sub.status === "pending" && (
                            <button
                              onClick={() => {
                                if (confirm(`Apply your free line skip to "${sub.songTitle}"? This will use 1 credit.`)) {
                                  useLineSkipMutation.mutate({ submissionId: sub.id });
                                }
                              }}
                              disabled={useLineSkipMutation.isPending}
                              className="text-xs bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 px-2 py-0.5 rounded transition-all disabled:opacity-50"
                              title="Apply free line skip"
                            >
                              🎡 Skip
                            </button>
                          )}
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
                {!reviewedTracks || reviewedTracks.length === 0 ? (
                  <div className="text-center py-12 border border-white/10 bg-white/[0.02]">
                    <div className="font-['Anton'] text-2xl uppercase mb-2">No History Yet</div>
                    <p className="text-white/40 text-sm">Previously played songs will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reviewedTracks.map((sub) => {
                      return (
                        <div key={sub.id} className="flex items-center gap-3 p-3 border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all">
                          {/* Song info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate text-sm">{sub.songTitle}</div>
                            <div className="text-white/50 text-xs truncate">
                              <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                            </div>
                          </div>
                          {/* Reactions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => reactMutation.mutate({ submissionId: sub.id, reaction: "fire" })}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all text-white/30 hover:text-orange-400"
                            >
                              <Flame className="w-3 h-3" />
                              {sub.fireCount}
                            </button>
                            <button
                              onClick={() => reactMutation.mutate({ submissionId: sub.id, reaction: "trash" })}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all text-white/30 hover:text-blue-400"
                            >
                              <ThumbsDown className="w-3 h-3" />
                              {sub.trashCount}
                            </button>
                          </div>
                          {/* Watch button */}
                          {sub.submissionType === "youtube" && sub.youtubeUrl && (
                            <button
                              onClick={() => setSelectedYouTube({ url: sub.youtubeUrl!, title: sub.songTitle, artist: sub.artistName })}
                              className="text-white/30 hover:text-red-400 transition-colors"
                              title="Watch on page"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SUBMIT FORM ── */}
            {tab === "submit" && (
              <div>
                {submitted ? (
                  <div className="text-center py-12 border border-green-500/30 bg-green-500/5">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="font-['Anton'] text-3xl uppercase mb-2">You're in the Queue!</div>
                    <p className="text-white/50 text-sm mb-5">We'll review your track during the next live session.</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => { setSubmitted(false); setForm({ songTitle: "", youtubeUrl: "", contactInfo: "", wantsSkip: false }); setAudioFile(null); }}
                        className="border border-white/20 text-white/60 hover:text-white px-6 py-2.5 text-xs uppercase tracking-widest transition-colors"
                      >
                        Submit Another
                      </button>
                      <button
                        onClick={() => setTab("queue")}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 text-xs uppercase tracking-widest transition-all"
                      >
                        View Queue
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File / YouTube toggle */}
                    <div className="flex gap-0 border border-white/10">
                      {(["file", "youtube"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setSubmitType(t)}
                          className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-semibold transition-all ${
                            submitType === t ? "bg-red-600 text-white" : "text-white/40 hover:text-white"
                          }`}>
                          {t === "youtube" ? "YouTube Link" : "Upload File"}
                        </button>
                      ))}
                    </div>

                    {/* Submitting as */}
                    <div className="bg-white/5 border border-white/10 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white/30 text-xs uppercase tracking-wider">Submitting as</span>
                      <span className="text-white font-semibold text-sm">{user?.artistName || user?.name || "Unknown Artist"}</span>
                    </div>

                    {/* Song title */}
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Song Title *</label>
                      <input type="text" value={form.songTitle}
                        onChange={e => setForm(f => ({ ...f, songTitle: e.target.value }))}
                        placeholder="Track name" required
                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                    </div>

                    {/* File or YouTube */}
                    {submitType === "youtube" ? (
                      <div>
                        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">YouTube Link *</label>
                        <input type="url" value={form.youtubeUrl}
                          onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                          placeholder="https://youtube.com/watch?v=..." required
                          className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Audio File * (MP3, WAV, M4A — max 20MB)</label>
                        <div
                          className={`border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                            audioFile ? "border-green-500/50 bg-green-500/5" : "border-white/20 hover:border-red-600/50"
                          }`}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {audioFile ? (
                            <div>
                              <div className="text-green-400 font-semibold text-sm">{audioFile.name}</div>
                              <div className="text-white/30 text-xs mt-1">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</div>
                              <button type="button" onClick={e => { e.stopPropagation(); setAudioFile(null); }}
                                className="text-white/30 hover:text-red-400 text-xs mt-2 transition-colors">Remove</button>
                            </div>
                          ) : (
                            <div>
                              <Music className="w-8 h-8 text-white/20 mx-auto mb-2" />
                              <div className="text-white/40 text-sm mb-1">Tap to select audio file</div>
                              <div className="text-white/20 text-xs">MP3, WAV, M4A — max 20MB</div>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > 20 * 1024 * 1024) { toast.error("File must be under 20MB"); return; }
                            setAudioFile(f);
                          }} />
                      </div>
                    )}

                    {/* Contact */}
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Instagram / Contact (Optional)</label>
                      <input type="text" value={form.contactInfo}
                        onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                        placeholder="@yourinstagram or phone number"
                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                    </div>

                    {/* Skip the line — Free credit from Daily Wheel */}
                    {user && lineSkipCredits > 0 && (
                      <div className="border border-green-500/40 bg-green-500/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm text-green-400">🎡 Free Line Skip Available!</div>
                            <div className="text-white/40 text-xs mt-0.5">
                              You have {lineSkipCredits} free line skip credit{lineSkipCredits !== 1 ? 's' : ''} from the Daily Wheel. Submit your track first, then apply your skip from the queue.
                            </div>
                          </div>
                          <span className="flex-shrink-0 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold px-2 py-1 rounded">
                            {lineSkipCredits}x
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Skip the line — Paid */}
                    <div
                      className={`border p-4 cursor-pointer transition-all ${form.wantsSkip ? "border-yellow-500/50 bg-yellow-500/5" : "border-white/10 hover:border-yellow-500/30"}`}
                      onClick={() => setForm(f => ({ ...f, wantsSkip: !f.wantsSkip }))}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${form.wantsSkip ? "border-yellow-500 bg-yellow-500" : "border-white/30"}`}>
                          {form.wantsSkip && <span className="text-black text-xs font-bold">✓</span>}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-yellow-400">⚡ Skip the Line — $10</div>
                          <div className="text-white/40 text-xs mt-0.5">
                            Move to the front. Send $10 to {CASHAPP} / PayPal: {PAYPAL} / Apple Pay: {APPLEPAY}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!user && (
                      <a href={getLoginUrl()} className="flex items-center justify-center gap-2 w-full border border-white/20 text-white/60 hover:text-white py-3 text-xs uppercase tracking-widest transition-colors">
                        <LogIn className="w-3.5 h-3.5" /> Login to Submit
                      </a>
                    )}

                    {user && (
                      <button type="submit" disabled={submitting}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3.5 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]">
                        {submitting ? "Submitting..." : "Submit to Queue →"}
                      </button>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* ── LIMIT REACHED MODAL ── */}
            {limitReachedData && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1a1a] border border-red-600/50 rounded-lg p-8 max-w-md w-full">
                  <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Max Submissions Reached</h2>
                  <p className="text-white/70 mb-6">You've reached your limit of 2 active submissions. Upgrade to submit more songs.</p>
                  
                  <div className="space-y-3 mb-6">
                    {limitReachedData.upgradeOptions.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => { window.location.href = `/promo?upgrade=${opt.type}`; }}
                        className="w-full border border-red-600 hover:bg-red-600/20 text-white py-3 px-4 rounded transition-all text-sm font-semibold uppercase tracking-widest"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => setLimitReachedData(null)}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded transition-all text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* ── SKIP INFO ── */}
            {tab === "skip-info" && (
              <div className="border border-yellow-500/30 bg-yellow-500/5 p-8">
                <div className="text-center mb-7">
                  <div className="text-4xl mb-3">⚡</div>
                  <h2 className="font-['Anton'] text-4xl uppercase mb-2">Skip the <span className="text-yellow-400">Line</span></h2>
                  <p className="text-white/50 text-sm">Move your submission to the front of the review queue for just $10.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mb-7">
                  {[
                    { label: "CashApp", value: CASHAPP, icon: "💸" },
                    { label: "PayPal", value: PAYPAL, icon: "🅿" },
                    { label: "Apple Pay", value: APPLEPAY, icon: "🍎" },
                  ].map(p => (
                    <div key={p.label} className="border border-yellow-500/20 bg-black/30 p-4 text-center">
                      <div className="text-2xl mb-2">{p.icon}</div>
                      <div className="text-yellow-400 text-xs uppercase tracking-widest mb-1">{p.label}</div>
                      <div className="font-['Anton'] text-lg text-white">{p.value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setTab("submit"); setForm(f => ({ ...f, wantsSkip: true })); }}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3.5 text-sm font-bold uppercase tracking-widest transition-all"
                >
                  Submit & Skip the Line →
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Chat + Voice ── */}
          <div className="flex flex-col gap-4">
            {/* Live Chat */}
            <div className="border border-white/10 bg-white/[0.02] flex flex-col" style={{ height: "500px" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">Live Chat</span>
                <span className={`flex items-center gap-1.5 text-xs ${chatConnected ? "text-green-400" : "text-white/20"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${chatConnected ? "bg-green-400" : "bg-white/20"}`} />
                  {chatConnected ? "Live" : "Connecting..."}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {chatMessages.length === 0 && (
                  <p className="text-white/20 text-xs text-center py-6">No messages yet — be the first!</p>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className="text-xs leading-relaxed">
                    <span className={`font-semibold ${msg.isAdmin ? "text-red-400" : "text-white/70"}`}>
                      {msg.isAdmin && <span className="text-red-500 text-[10px] font-bold uppercase mr-1">[HOST]</span>}
                      {msg.userId ? (
                        <Link href={`/profile/${msg.userId}`} className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</Link>
                      ) : (
                        <ArtistStatModal artistName={msg.username}>
                          <button className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</button>
                        </ArtistStatModal>
                      )}
                      {msg.accountLabels && msg.accountLabels.length > 0 && <span className="ml-1"><LabelBadge labels={msg.accountLabels} size="xs" /></span>}
                      {msg.userId && <span className="ml-1"><UserBadges userId={msg.userId} size="xs" maxVisible={2} /></span>}
                      <span className="text-white/30">:</span>
                    </span>{" "}
                    <span className="text-white/80">{msg.message}</span>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="border-t border-white/10 flex gap-1.5 p-2 flex-shrink-0">
                {user ? (
                  <>
                    <input
                      type="text" value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendChat()}
                      placeholder="Say something..."
                      maxLength={500}
                      className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20"
                    />
                    <button onClick={handleSendChat} disabled={!chatInput.trim()}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-2 transition-colors">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <a href={getLoginUrl()} className="flex-1 flex items-center justify-center gap-2 text-white/40 hover:text-white text-xs py-2 transition-colors">
                    <LogIn className="w-3.5 h-3.5" /> Login to chat
                  </a>
                )}
              </div>
            </div>

            {/* Voice Chat Panel */}
            <div className="border border-white/10 bg-white/[0.02]">
              <button
                onClick={() => setShowVoicePanel(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs uppercase tracking-widest font-semibold text-white/50 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5" />
                  Voice Chat
                  <span className={`w-1.5 h-1.5 rounded-full ${audioRoom.isConnected ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                  <span className="text-white/30 normal-case font-normal">{audioRoom.participants.length} in room</span>
                </div>
                {showVoicePanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showVoicePanel && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                  {audioRoom.error && (
                    <div className="text-red-400 text-xs bg-red-900/20 border border-red-600/20 p-2 mb-3">{audioRoom.error}</div>
                  )}
                  {!user ? (
                    <a href={getLoginUrl()} className="block w-full text-center text-xs bg-red-600 hover:bg-red-700 text-white py-2 uppercase tracking-widest transition-colors">
                      Login to Join Voice
                    </a>
                  ) : !voiceJoined && !isAdmin ? (
                    <button onClick={() => setVoiceJoined(true)} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 text-xs font-semibold uppercase tracking-widest transition-colors">
                      Join Voice Chat
                    </button>
                  ) : (
                    <>
                      <div className="space-y-1 mb-3 max-h-28 overflow-y-auto">
                        {audioRoom.participants.length === 0 && <p className="text-white/20 text-xs text-center py-2">No one in voice yet</p>}
                        {audioRoom.participants.map(p => (
                          <div key={p.userId || p.socketId} className="flex items-center justify-between py-1 border-b border-white/5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${p.micActive ? "bg-green-400" : "bg-white/20"}`} />
                              <span className="text-xs text-white/70">{p.username}</span>
                              {p.role === "admin" && <span className="text-[10px] text-red-400 font-bold uppercase">HOST</span>}
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => audioRoom.adminToggleParticipantMic(p.socketId, !p.micActive)}
                                  className={`text-[10px] px-1.5 py-0.5 border transition-colors ${p.micActive ? "border-red-600/40 text-red-400 hover:bg-red-600/20" : "border-green-600/40 text-green-400 hover:bg-green-600/20"}`}
                                >
                                  {p.micActive ? "Mute" : "Unmute"}
                                </button>
                                <button
                                  onClick={() => audioRoom.kickParticipant(p.socketId)}
                                  className="text-[10px] px-1.5 py-0.5 border border-white/20 text-white/40 hover:border-red-600 hover:text-red-400 transition-colors"
                                >
                                  Kick
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={audioRoom.toggleMic}
                          className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                            audioRoom.isMuted ? "border-white/20 text-white/40 hover:border-green-600 hover:text-green-400" : "border-green-600 text-green-400 hover:bg-green-600/20"
                          }`}
                        >
                          {audioRoom.isMuted ? <><MicOff className="w-3 h-3 inline mr-1" />Mic Off</> : <><Mic className="w-3 h-3 inline mr-1" />Mic On</>}
                        </button>
                        {!isAdmin && (
                          <button onClick={() => setVoiceJoined(false)} className="flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider border border-white/20 text-white/40 hover:border-red-600 hover:text-red-400 transition-colors">
                            Leave
                          </button>
                        )}
                      </div>
                      {/* Voice mix volume */}
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/40 uppercase tracking-widest">Voice Mix Volume</span>
                          <span className="text-[10px] text-white/60 font-mono">{Math.round(audioRoom.voiceVolume * 100)}%</span>
                        </div>
                        <input
                          type="range" min="0" max="1" step="0.05"
                          value={audioRoom.voiceVolume}
                          onChange={e => audioRoom.setVoiceVolume(parseFloat(e.target.value))}
                          className="w-full h-1.5 accent-red-600 cursor-pointer"
                          title="Voice chat volume (does not affect radio)"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PREVIOUSLY REVIEWED TRACKS ── */}
      {reviewedTracks && reviewedTracks.length > 0 && (
        <section className="border-t border-white/10 py-10">
          <div className="container">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-8 bg-red-600" />
              <div>
                <h2 className="font-['Anton'] text-2xl uppercase">Previously Submitted Tracks</h2>
                <p className="text-white/40 text-xs uppercase tracking-widest mt-0.5">Tracks reviewed on air — play them anytime</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviewedTracks.map((sub: ReviewSubmission) => (
                <div
                  key={sub.id}
                  className="border border-white/10 bg-white/[0.02] hover:border-red-600/30 hover:bg-white/[0.04] transition-all duration-200 p-4 flex items-center gap-3"
                >
                  {sub.fileUrl ? (
                    <AudioPlayButton
                      url={sub.fileUrl}
                      urlSource="queue"
                      title={sub.songTitle}
                      artist={sub.artistName}
                      submissionId={sub.id}
                      sourcePage="Music Review"
                      sourceUrl="/review"
                      size="md"
                    />
                  ) : sub.youtubeUrl ? (
                    <a
                      href={sub.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 flex items-center justify-center flex-shrink-0 border border-red-600/50 text-red-500 hover:bg-red-600 hover:text-white transition-all"
                      title="Open on YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 border border-white/10 text-white/20">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate text-sm">{sub.songTitle}</div>
                    <div className="text-white/40 text-xs truncate">
                      <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                      <span>🔥 {sub.fireCount}</span>
                      <span>🗑️ {sub.trashCount}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => requeueFromHistoryMutation.mutate({ id: sub.id })}
                      disabled={requeueFromHistoryMutation.isPending}
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-yellow-500 hover:text-yellow-400 px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      <RotateCcw className="w-3 h-3" /> Re-queue
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/10 py-8 mt-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs">© 2022-{new Date().getFullYear()} Murder Mitten Media ™ · Michigan</div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
