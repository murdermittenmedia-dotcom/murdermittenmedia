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
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { SyncedYouTubePlayer } from "@/components/SyncedYouTubePlayer";
import { registerSeekBroadcast, registerPauseBroadcast, registerResumeBroadcast } from "@/contexts/RadioSeekBroadcastContext";
import { JudgeLiveBroadcast, JudgeBroadcastViewer } from "@/components/JudgeLiveBroadcast";
import { useFakeLiveChat } from "@/hooks/useFakeLiveChat";

// Types inferred from tRPC query
type ReviewSubmission = { id: number; userId?: number | null; artistName: string; songTitle: string; submissionType: "youtube" | "file"; youtubeUrl: string | null; fileKey: string | null; fileUrl: string | null; contactInfo: string | null; status: "pending" | "playing" | "reviewed" | "removed"; skippedLine: boolean; skipPaymentConfirmed: boolean; position: number; notes: string | null; fireCount: number; trashCount: number; createdAt: Date; updatedAt: Date };
type QueueState = { id: number; isLive: boolean; liveMessage: string | null; streamUrl: string | null; currentPlayingId: number | null; updatedAt: Date };
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

// ── Judge Broadcast Card Component (LiveKit viewer) ───────────
function JudgeBroadcastCard({ broadcast }: { broadcast: any }) {
  const { data: viewerData } = trpc.review.getJudgeViewerToken.useQuery(
    { broadcastId: broadcast.id },
    { retry: false, staleTime: 1000 * 60 * 5 }
  );
  if (viewerData) {
    return (
      <JudgeBroadcastViewer
        roomName={viewerData.roomName}
        livekitUrl={viewerData.livekitUrl}
        viewerToken={viewerData.token}
        judgeName={`Judge #${broadcast.userId}`}
        judgeUserId={broadcast.userId}
      />
    );
  }
  return (
    <div className="border border-green-500/30 bg-black/40 rounded-lg overflow-hidden">
      <div className="aspect-video bg-black/60 flex items-center justify-center">
        <div className="text-green-400/50 text-xs text-center">Connecting…</div>
      </div>
      <div className="p-2 border-t border-green-500/20">
        <div className="text-white/80 text-xs font-semibold truncate">Judge #{broadcast.userId}</div>
        <div className="text-green-400 text-[10px] flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>
    </div>
  );
}

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
  const { data: activeBroadcasts } = trpc.review.getActive.useQuery();
  const forceEndBroadcast = trpc.review.forceEnd.useMutation({
    onSuccess: () => { toast.success("Judge broadcast ended"); },
    onError: (e: any) => toast.error("Failed to end broadcast: " + e.message),
  });
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

      <div className="p-4 space-y-3">
        {/* ── Row 1: Go Live + Stream URL ── */}
        <div className="flex gap-2 items-stretch">
          <button
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
          {currentUser?.role === "admin" && activeBroadcasts && activeBroadcasts.length > 0 && (
            <div className="flex gap-1">
              {activeBroadcasts.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => forceEndBroadcast.mutate({ broadcastId: b.id })}
                  disabled={forceEndBroadcast.isPending}
                  className="flex-shrink-0 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-green-900/40 border border-green-600/50 text-green-300 hover:bg-green-900/60 transition-all"
                  title="End judge broadcast"
                >
                  X Judge
                </button>
              ))}
            </div>
          )}
          <button
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

        {/* ── Row 2: Mic / Camera / Mic→Radio ── */}
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

        {/* ── Reaction triggers (admin only) ── */}
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

        {/* ── Pending skip payments ── */}
        {pendingSkips.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3">
            <div className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingSkips.length} Unconfirmed Skip{pendingSkips.length > 1 ? "s" : ""}
            </div>
            {pendingSkips.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-yellow-500/10 first:border-0">
                <div>
                  <span className="text-white text-xs font-semibold">{s.artistName}</span>
                  <span className="text-white/40 text-[10px] ml-2">— {s.songTitle}</span>
                </div>
                <button
                  onClick={() => { confirmSkip.mutate({ id: s.id }); toast.success("Skip payment confirmed"); }}
                  className="text-[10px] bg-yellow-500 text-black px-2 py-1 rounded font-bold uppercase hover:bg-yellow-400 transition-colors flex-shrink-0"
                >
                  Confirm $10
                </button>
              </div>
            ))}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isJudge = user?.role === "judge";
  const [showOBSSetup, setShowOBSSetup] = useState(false);
  const [myBroadcast, setMyBroadcast] = useState<any>(null);
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);
  const [livekitBroadcastData, setLivekitBroadcastData] = useState<{ token: string; roomName: string; livekitUrl: string } | null>(null);
  
  // Fetch judge broadcasts
  const { data: broadcasts } = trpc.review.getActive.useQuery(undefined, { refetchInterval: 3000 });
  const { data: myBroadcastData } = trpc.review.getMyBroadcast.useQuery(undefined, { enabled: isJudge || isAdmin });
  const startBroadcast = trpc.review.startBroadcast.useMutation();
  const endBroadcast = trpc.review.endBroadcast.useMutation();
  const getJudgeToken = trpc.review.getJudgeToken.useMutation();
  
  const broadcastsRef = useRef<any[]>([]);
  useEffect(() => {
    if (broadcasts && JSON.stringify(broadcasts) !== JSON.stringify(broadcastsRef.current)) {
      broadcastsRef.current = broadcasts;
      setActiveBroadcasts(broadcasts);
    }
  }, [broadcasts]);
  
  const myBroadcastRef = useRef<any>(null);
  useEffect(() => {
    if (myBroadcastData && JSON.stringify(myBroadcastData) !== JSON.stringify(myBroadcastRef.current)) {
      myBroadcastRef.current = myBroadcastData;
      setMyBroadcast(myBroadcastData);
    }
  }, [myBroadcastData]);
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
  const { data: lineSkipCreditsData, refetch: refetchLineSkipCredits } = trpc.dailyWheel.getMyLineSkipCredits.useQuery();
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

  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fake live viewer count and auto-chat messages
  const { viewerCount, fakeMessages, triggerReaction } = useFakeLiveChat();

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
      });
    } else {
      submitMutation.mutate({
        songTitle: pendingFormData.songTitle,
        submissionType: "youtube",
        youtubeUrl: pendingFormData.youtubeUrl,
        contactInfo: pendingFormData.contactInfo,
        wantsSkip: paidType === 'skip',
        paidSubmissionType: paidType,
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
      <section className="relative pt-14 pb-5 border-b border-white/[0.06] overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
        
        <div className="container relative">
          {/* Status + title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {isLive ? (
                <div className="flex items-center gap-2 bg-red-600/15 border border-red-600/30 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-[10px] uppercase tracking-[0.3em] font-bold">Live Now</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                  <span className="text-white/30 text-[10px] uppercase tracking-[0.3em]">Offline</span>
                </div>
              )}
              {pendingQueue.length > 0 && (
                <span className="text-white/20 text-[10px] uppercase tracking-wider hidden md:block">
                  {pendingQueue.length} track{pendingQueue.length !== 1 ? "s" : ""} in queue
                </span>
              )}
            </div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider hidden md:block">
              Submit your track · skip to front for $10
            </p>
          </div>

          {/* Title */}
          <h1 className="font-['Anton'] text-4xl md:text-5xl uppercase leading-none mb-4">
            MUSIC <span className="text-red-600">REVIEW</span>
          </h1>

          {/* Judge Broadcast Panel */}
          {(isJudge || isAdmin) && (
            <div className="mb-4">
              {livekitBroadcastData && myBroadcast ? (
                <JudgeLiveBroadcast
                  broadcastId={myBroadcast.id}
                  token={livekitBroadcastData.token}
                  livekitUrl={livekitBroadcastData.livekitUrl}
                  onStop={() => {
                    endBroadcast.mutate({ broadcastId: myBroadcast.id }, {
                      onSuccess: () => {
                        setMyBroadcast(null);
                        setLivekitBroadcastData(null);
                        toast.success("Broadcast ended");
                      }
                    });
                  }}
                />
              ) : (
                <div className="border border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-green-400 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Judge Broadcast</div>
                    <div className="text-white/60 text-sm">
                      {myBroadcast ? "Session active — click to resume camera" : "Ready to broadcast"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startBroadcast.mutate(undefined, {
                        onSuccess: (data: any) => {
                          if (data.success && data.broadcast && data.token) {
                            setMyBroadcast(data.broadcast);
                            setLivekitBroadcastData({ token: data.token, roomName: data.broadcast.roomName, livekitUrl: data.livekitUrl });
                            toast.success("Camera & mic ready!");
                          }
                        },
                        onError: (e: any) => toast.error("Failed to start broadcast: " + e.message),
                      })}
                      disabled={startBroadcast.isPending}
                      className="text-xs border border-green-500/50 bg-green-500/10 text-green-400 px-4 py-2 rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50"
                    >
                      {startBroadcast.isPending ? "Starting…" : myBroadcast ? "📷 Resume" : "📷 Go Live"}
                    </button>
                    {myBroadcast && (
                      <button
                        onClick={() => endBroadcast.mutate({ broadcastId: myBroadcast.id }, {
                          onSuccess: () => { setMyBroadcast(null); setLivekitBroadcastData(null); toast.success("Broadcast ended"); }
                        })}
                        className="text-xs border border-red-500/50 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OBS Setup Modal */}
          {showOBSSetup && myBroadcast && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-white/20 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h2 className="text-white font-['Anton'] text-lg uppercase">OBS Setup</h2>
                  <button onClick={() => setShowOBSSetup(false)} className="text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-white/60 text-xs uppercase tracking-widest mb-2">Server URL</div>
                    <div className="bg-black/40 border border-white/10 p-3 rounded-lg font-mono text-sm text-green-400 break-all">
                      {myBroadcast.rtmpUrl}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(myBroadcast.rtmpUrl); toast.success("Copied!"); }}
                      className="text-xs text-white/50 hover:text-white mt-2">Copy</button>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs uppercase tracking-widest mb-2">Stream Key</div>
                    <div className="bg-black/40 border border-white/10 p-3 rounded-lg font-mono text-sm text-yellow-400 break-all">
                      {myBroadcast.rtmpKey}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(myBroadcast.rtmpKey); toast.success("Copied!"); }}
                      className="text-xs text-white/50 hover:text-white mt-2">Copy</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stream embed / live radio card */}
          {isLive && streamUrl ? (
            <div className="mb-2">
              {(streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be")) ? (
                <div className="relative w-full aspect-video max-w-3xl bg-black border border-white/10 rounded-xl overflow-hidden">
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
                <div className="border border-red-600/30 bg-gradient-to-r from-red-600/10 to-transparent rounded-xl p-5 max-w-3xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(209,0,0,0.2)]">
                    <Radio className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-['Anton'] text-lg uppercase">Murder Mitten Media — LIVE</div>
                    {liveMessage && <div className="text-white/50 text-sm mt-0.5">{liveMessage}</div>}
                  </div>
                  <button
                    onClick={playStream}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(209,0,0,0.3)]"
                  >
                    <Headphones className="w-3.5 h-3.5" /> Listen Live
                  </button>
                </div>
              )}
            </div>
          ) : isLive ? (
            <div className="border border-red-600/30 bg-red-600/5 rounded-xl p-4 max-w-3xl mb-2 flex items-center gap-3">
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
      <div className="container py-4">
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="min-w-0 space-y-4">

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
                triggerReaction={triggerReaction}
              />
            )}

            {/* Inline YouTube embed */}
            {selectedYouTube && (() => {
              const ytId = extractYouTubeId(selectedYouTube.url);
              return (
                <div className="rounded-xl border border-white/15 bg-black/60 p-4 relative">
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
                    <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                        className="absolute inset-0 w-full h-full"
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

            {/* ── NOW BEING REVIEWED — Dramatic spotlight card ── */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="rounded-xl border border-red-600/40 bg-gradient-to-br from-red-600/10 via-[#0d0000] to-transparent p-5 relative overflow-hidden shadow-[0_0_40px_rgba(209,0,0,0.08)]">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
                {/* Corner glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(209,0,0,0.6)]" />
                    <span className="text-red-400 text-[10px] uppercase tracking-[0.3em] font-bold">Now Being Reviewed</span>
                  </div>
                  <div className="font-['Anton'] text-3xl md:text-4xl uppercase mb-1 leading-tight">{liveReviewActive.songTitle}</div>
                  <div className="text-white/60 text-sm mb-4">
                    by <ArtistLink artistName={liveReviewActive.artistName ?? ''} userId={liveReviewActive.userId ?? null} />
                  </div>
                  
                  {liveReviewActive.audioUrl && !isAdmin && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-red-400 text-xs">
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span className="font-semibold text-xs uppercase tracking-wider">Playing Live — synced to admin</span>
                      </div>
                      {/* Tune In CTA */}
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
                                audioPlayer.playWithSeek(track, seekTo);
                                if (data?.pausedAt !== null && data?.pausedAt !== undefined) {
                                  setTimeout(() => audioPlayer.pause(), 500);
                                }
                              } else {
                                audioPlayer.play(track);
                              }
                            });
                            setTimeout(() => {
                              if (!responded) {
                                responded = true;
                                socket.disconnect();
                                audioPlayer.play(track);
                              }
                            }, 1500);
                          }}
                          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] text-white py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(209,0,0,0.3)] hover:shadow-[0_0_35px_rgba(209,0,0,0.5)]"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                          🎙 Tap to Listen Live
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-green-400 text-xs font-semibold uppercase tracking-wider bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          You're tuned in
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TIP ARTIST PANEL ── */}
                  {!isAdmin && liveReviewActive.userId && user && liveReviewActive.userId !== user.id && (
                    <div className="mt-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 text-sm font-semibold">💰 Tip {liveReviewActive.artistName}</span>
                          <span className="text-white/30 text-[10px]">Balance: {coinBalanceData?.balance ?? 0} coins</span>
                        </div>
                        <button
                          onClick={() => setShowTipPanel(v => !v)}
                          className="text-[10px] text-yellow-400/70 hover:text-yellow-400 transition-colors"
                        >
                          {showTipPanel ? 'Cancel' : 'Send Tip'}
                        </button>
                      </div>
                      {showTipPanel && (
                        <div className="flex gap-2 items-center">
                          <div className="flex gap-1">
                            {[10, 25, 50, 100].map(amt => (
                              <button
                                key={amt}
                                onClick={() => setTipAmount(String(amt))}
                                className={`px-2 py-1 text-[10px] border rounded transition-all ${
                                  tipAmount === String(amt)
                                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                                    : 'border-white/10 text-white/40 hover:border-yellow-500/50 hover:text-yellow-400'
                                }`}
                              >
                                {amt}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number" min="1" max="10000" value={tipAmount}
                            onChange={e => setTipAmount(e.target.value)} placeholder="Custom"
                            className="w-16 bg-transparent border border-white/20 rounded text-white text-[10px] px-2 py-1 focus:outline-none focus:border-yellow-500/50"
                          />
                          <button
                            disabled={!tipAmount || parseInt(tipAmount) < 1 || tipMutation.isPending}
                            onClick={() => {
                              const coins = parseInt(tipAmount);
                              if (!coins || coins < 1) return;
                              tipMutation.mutate({ toUserId: liveReviewActive.userId!, coins });
                            }}
                            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black text-[10px] font-semibold px-3 py-1 rounded transition-all"
                          >
                            {tipMutation.isPending ? '...' : 'Tip'}
                          </button>
                        </div>
                      )}
                      {!showTipPanel && (
                        <div className="flex gap-1">
                          {[10, 25, 50, 100].map(amt => (
                            <button
                              key={amt}
                              onClick={() => {
                                if (!liveReviewActive.userId) return;
                                tipMutation.mutate({ toUserId: liveReviewActive.userId, coins: amt });
                              }}
                              disabled={tipMutation.isPending}
                              className="px-3 py-1 text-[10px] border border-yellow-500/30 text-yellow-400/70 rounded hover:border-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-40"
                            >
                              💰 {amt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {liveReviewActive.youtubeUrl && !isAdmin && (() => {
                    const ytId = extractYouTubeId(liveReviewActive.youtubeUrl!);
                    return ytId ? (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2 text-orange-400 text-[10px] font-semibold uppercase tracking-wider">
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                          Watch synced to admin's position
                        </div>
                        <SyncedYouTubePlayer
                          videoId={ytId}
                          submissionId={liveReviewActive.submissionId!}
                          isAdmin={false}
                          initialCurrentTime={ytSyncState?.currentTime ?? null}
                          initialUpdatedAt={ytSyncState?.updatedAt ?? null}
                          className="border border-white/10 rounded-lg overflow-hidden"
                        />
                        <a href={liveReviewActive.youtubeUrl!} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10px] text-white/30 hover:text-red-400 transition-colors mt-2">
                          <ExternalLink className="w-3 h-3" /> Open on YouTube
                        </a>
                      </div>
                    ) : (
                      <a href={liveReviewActive.youtubeUrl!} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-2">
                        <ExternalLink className="w-3.5 h-3.5" /> Open on YouTube
                      </a>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── FIRE / TRASH POLL ── */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
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
            )}

            {/* Fallback poll for currentPlaying when liveReviewActive is not set */}
            {!liveReviewActive && currentPlaying && (
              <div>
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

            {/* ── TABS: Queue / History / Submit / Skip Line — Pill style ── */}
            <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-xl">
              {(["queue", "history", "submit", "skip-info"] as SubmitTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-lg transition-all ${
                    tab === t
                      ? t === "skip-info"
                        ? "bg-yellow-500/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                        : "bg-red-600/20 text-red-400 shadow-[0_0_10px_rgba(209,0,0,0.1)]"
                      : t === "skip-info"
                      ? "text-yellow-500/60 hover:text-yellow-400 hover:bg-yellow-500/5"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                  }`}
                >
                  {t === "queue" ? `Queue (${pendingQueue.length})` : t === "history" ? "History" : t === "submit" ? "Submit" : "⚡ Skip ($10)"}
                </button>
              ))}
            </div>

            {/* ── QUEUE TAB ── */}
            {tab === "queue" && (
              <div>
                {isLoading ? (
                  <div className="text-center py-16 text-white/30 text-sm">Loading queue...</div>
                ) : pendingQueue.length === 0 ? (
                  <div className="text-center py-12 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Queue is Empty</div>
                    <p className="text-white/40 text-sm mb-5">Be the first to submit your track!</p>
                    <button
                      onClick={() => setTab("submit")}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(209,0,0,0.2)]"
                    >
                      Submit Your Track →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingQueue.map((sub, i) => (
                      <div
                        key={sub.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl transition-all hover:translate-x-0.5 ${
                          sub.status === "playing"
                            ? "border-red-600/50 bg-gradient-to-r from-red-600/10 to-transparent shadow-[0_0_15px_rgba(209,0,0,0.08)]"
                            : sub.skipPaymentConfirmed
                            ? "border-yellow-500/40 bg-yellow-500/5"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        {/* Position number */}
                        <div className={`w-7 h-7 flex items-center justify-center font-['Anton'] text-base flex-shrink-0 rounded-lg ${
                          sub.status === "playing" ? "text-red-500 bg-red-600/20" : "text-white/20 bg-white/[0.04]"
                        }`}>
                          {sub.status === "playing" ? "▶" : i + 1}
                        </div>
                        {/* Song info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate text-sm">{sub.songTitle}</div>
                          <div className="text-white/50 text-xs truncate">
                            <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                            {sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-400 font-bold">⚡ Skip</span>}
                            {sub.skippedLine && !sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-600">⚡ Pending</span>}
                          </div>
                        </div>
                        {/* Status + reactions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={sub.status} />
                          <span className="flex items-center gap-0.5 text-[10px] text-white/30">
                            <Flame className="w-3 h-3 text-orange-500/60" />
                            {sub.fireCount}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-white/30">
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
                  <div className="text-center py-12 border border-white/10 bg-white/[0.02] rounded-xl">
                    <div className="font-['Anton'] text-xl uppercase mb-2">No History Yet</div>
                    <p className="text-white/40 text-sm">Tracks will appear here after they've been reviewed.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reviewedTracks.map((sub: ReviewSubmission) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 p-3 border border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] rounded-xl transition-all"
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
                            className="w-9 h-9 flex items-center justify-center flex-shrink-0 border border-red-600/50 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                            title="Open on YouTube"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 border border-white/10 text-white/20 rounded-lg">
                            <Music className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate text-sm">{sub.songTitle}</div>
                          <div className="text-white/40 text-xs truncate">
                            <ArtistLink artistName={sub.artistName} userId={sub.userId} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-white/30">
                          <span>🔥 {sub.fireCount}</span>
                          <span>🗑️ {sub.trashCount}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => requeueFromHistoryMutation.mutate({ id: sub.id })}
                            disabled={requeueFromHistoryMutation.isPending}
                            className="flex items-center gap-1 text-[10px] font-semibold uppercase border border-white/20 text-white/50 hover:border-yellow-500 hover:text-yellow-400 rounded px-2 py-1 transition-colors flex-shrink-0 disabled:opacity-40"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-q
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SUBMIT FORM ── */}
            {tab === "submit" && (
              <div>
                {submitted ? (
                  <div className="text-center py-12 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="text-4xl mb-3">✅</div>
                    <div className="font-['Anton'] text-3xl uppercase mb-2">You're in the Queue!</div>
                    <p className="text-white/50 text-sm mb-5">We'll review your track during the next live session.</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => { setSubmitted(false); setForm({ songTitle: "", youtubeUrl: "", contactInfo: "", wantsSkip: false }); setAudioFile(null); }}
                        className="border border-white/20 text-white/60 hover:text-white px-6 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-colors"
                      >
                        Submit Another
                      </button>
                      <button
                        onClick={() => setTab("queue")}
                        className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all"
                      >
                        View Queue
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File / YouTube toggle */}
                    <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-xl">
                      {(["file", "youtube"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setSubmitType(t)}
                          className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-semibold rounded-lg transition-all ${
                            submitType === t ? "bg-red-600/20 text-red-400" : "text-white/40 hover:text-white/70"
                          }`}>
                          {t === "youtube" ? "YouTube Link" : "Upload File"}
                        </button>
                      ))}
                    </div>

                    {/* Submitting as */}
                    <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white/30 text-[10px] uppercase tracking-wider">Submitting as</span>
                      <span className="text-white font-semibold text-sm">{user?.artistName || user?.name || "Unknown Artist"}</span>
                    </div>

                    {/* Song title */}
                    <div>
                      <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Song Title *</label>
                      <input type="text" value={form.songTitle}
                        onChange={e => setForm(f => ({ ...f, songTitle: e.target.value }))}
                        placeholder="Track name" required
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                    </div>

                    {/* File or YouTube */}
                    {submitType === "youtube" ? (
                      <div>
                        <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">YouTube Link *</label>
                        <input type="url" value={form.youtubeUrl}
                          onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                          placeholder="https://youtube.com/watch?v=..." required
                          className="w-full bg-white/5 border border-white/10 rounded-lg text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                      </div>
                    ) : (
                      <div>
                        <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Audio File * (MP3, WAV, M4A — max 20MB)</label>
                        <div
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
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
                      <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Instagram / Contact (Optional)</label>
                      <input type="text" value={form.contactInfo}
                        onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                        placeholder="@yourinstagram or phone number"
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20 text-sm" />
                    </div>

                    {/* Skip the line */}
                    <div
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${form.wantsSkip ? "border-yellow-500/50 bg-yellow-500/5" : "border-white/10 hover:border-yellow-500/30"}`}
                      onClick={() => setForm(f => ({ ...f, wantsSkip: !f.wantsSkip }))}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${form.wantsSkip ? "border-yellow-500 bg-yellow-500" : "border-white/30"}`}>
                          {form.wantsSkip && <span className="text-black text-xs font-bold">✓</span>}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-yellow-400">⚡ Skip the Line — $10</div>
                          <div className="text-white/40 text-[10px] mt-0.5">
                            Move to the front. Send $10 to {CASHAPP} / PayPal: {PAYPAL} / Apple Pay: {APPLEPAY}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!user && (
                      <a href={getLoginUrl()} className="flex items-center justify-center gap-2 w-full border border-white/20 text-white/60 hover:text-white rounded-lg py-3 text-xs uppercase tracking-widest transition-colors">
                        <LogIn className="w-3.5 h-3.5" /> Login to Submit
                      </a>
                    )}

                    {user && (
                      <button type="submit" disabled={submitting}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(209,0,0,0.2)]">
                        {submitting ? "Submitting..." : "Submit to Queue →"}
                      </button>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* ── LIMIT REACHED / PAYWALL MODAL ── */}
            {limitReachedData && !paidSubmitSuccess && (
              <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-[#111] border border-red-600/60 rounded-xl p-8 max-w-lg w-full my-4">
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-3">🔒</div>
                    <h2 className="font-['Anton'] text-3xl text-red-600 mb-2 uppercase">2 Free Submissions Used</h2>
                    <p className="text-white/60 text-sm">You've hit your daily limit. Submit additional songs for a fee.</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    <button onClick={() => handlePaidSubmit('reentry5')} disabled={submitting}
                      className="w-full bg-red-600/20 border border-red-600 hover:bg-red-600/40 text-white py-4 px-4 rounded-xl transition-all">
                      <div className="font-['Anton'] text-xl text-red-400 mb-1">$5 REENTRY</div>
                      <div className="text-white/60 text-xs">Submit 1 more song — enters queue in normal position</div>
                    </button>
                    <button onClick={() => handlePaidSubmit('reentry10')} disabled={submitting}
                      className="w-full bg-orange-600/20 border border-orange-500 hover:bg-orange-600/40 text-white py-4 px-4 rounded-xl transition-all">
                      <div className="font-['Anton'] text-xl text-orange-400 mb-1">$10 REENTRY</div>
                      <div className="text-white/60 text-xs">Submit 1 more song — enters queue in normal position</div>
                    </button>
                    <button onClick={() => handlePaidSubmit('skip')} disabled={submitting}
                      className="w-full bg-yellow-600/20 border border-yellow-500 hover:bg-yellow-600/40 text-white py-4 px-4 rounded-xl transition-all">
                      <div className="font-['Anton'] text-xl text-yellow-400 mb-1">$15 REENTRY + SKIP THE LINE</div>
                      <div className="text-white/60 text-xs">Submit 1 more song — jumps to front of queue</div>
                    </button>
                  </div>

                  <div className="border border-white/10 bg-white/5 rounded-xl p-4 mb-6">
                    <p className="text-white/50 text-[10px] uppercase tracking-widest mb-3">Send payment to:</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="text-lg mb-1">💸</div>
                        <div className="text-green-400 text-[10px] font-bold">CashApp</div>
                        <div className="text-white text-[10px] mt-1 font-mono">{CASHAPP}</div>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="text-lg mb-1">🅿</div>
                        <div className="text-blue-400 text-[10px] font-bold">PayPal</div>
                        <div className="text-white text-[10px] mt-1 font-mono">{PAYPAL}</div>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="text-lg mb-1">🍎</div>
                        <div className="text-white/80 text-[10px] font-bold">Apple Pay</div>
                        <div className="text-white text-[10px] mt-1 font-mono">{APPLEPAY}</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => { setLimitReachedData(null); setPendingFormData(null); }}
                    className="w-full border border-white/20 text-white/60 hover:text-white py-3 rounded-xl text-xs uppercase tracking-widest transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── PAID SUBMISSION SUCCESS ── */}
            {paidSubmitSuccess && (
              <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                <div className="bg-[#111] border border-green-600/60 rounded-xl p-8 max-w-md w-full text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="font-['Anton'] text-3xl text-green-400 mb-3 uppercase">Submission Received!</h2>
                  <p className="text-white/70 mb-2">Your song is <span className="text-yellow-400 font-semibold">pending payment confirmation</span>.</p>
                  <p className="text-white/50 text-sm mb-6">Once verified, your track will be activated in the queue.</p>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Payment details:</p>
                    <div className="text-white text-sm space-y-1">
                      <div>💸 CashApp: <span className="font-mono text-green-400">{CASHAPP}</span></div>
                      <div>🅿 PayPal: <span className="font-mono text-blue-400">{PAYPAL}</span></div>
                      <div>🍎 Apple Pay: <span className="font-mono text-white/80">{APPLEPAY}</span></div>
                    </div>
                    <p className="text-white/30 text-xs mt-3">Include your artist name in the note.</p>
                  </div>
                  <button
                    onClick={() => { setPaidSubmitSuccess(null); setLimitReachedData(null); refetch(); }}
                    className="w-full bg-green-600 hover:bg-green-500 text-white py-3 px-4 rounded-xl transition-all font-semibold">
                    Got it!
                  </button>
                </div>
              </div>
            )}

            {/* ── SKIP INFO ── */}
            {tab === "skip-info" && (
              <div className="border border-yellow-500/30 bg-gradient-to-b from-yellow-500/5 to-transparent rounded-xl p-8">
                <div className="text-center mb-7">
                  <div className="text-4xl mb-3">⚡</div>
                  <h2 className="font-['Anton'] text-4xl uppercase mb-2">Skip the <span className="text-yellow-400">Line</span></h2>
                  <p className="text-white/50 text-sm">Move your submission to the front for just $10.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mb-7">
                  {[
                    { label: "CashApp", value: CASHAPP, icon: "💸" },
                    { label: "PayPal", value: PAYPAL, icon: "🅿" },
                    { label: "Apple Pay", value: APPLEPAY, icon: "🍎" },
                  ].map(p => (
                    <div key={p.label} className="border border-yellow-500/20 bg-black/30 rounded-xl p-4 text-center">
                      <div className="text-2xl mb-2">{p.icon}</div>
                      <div className="text-yellow-400 text-[10px] uppercase tracking-widest mb-1">{p.label}</div>
                      <div className="font-['Anton'] text-lg text-white">{p.value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setTab("submit"); setForm(f => ({ ...f, wantsSkip: true })); }}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all"
                >
                  Submit & Skip the Line →
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-4 hidden lg:block">

            {/* Judge Broadcast Viewers */}
            {activeBroadcasts.filter((b: any) => b.userId !== user?.id).length > 0 && (
              <div className="space-y-2">
                <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center gap-1.5">
                  <Video className="w-3 h-3" />
                  Live Judges
                </div>
                {activeBroadcasts.filter((b: any) => b.userId !== user?.id).map((b: any) => (
                  <JudgeBroadcastCard key={b.id} broadcast={b} />
                ))}
              </div>
            )}

            {/* Live Chat */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col" style={{ height: '380px' }}>
              {/* Chat header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${chatConnected ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-semibold">Live Chat</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-white/40 text-[10px]">
                    <Eye className="w-3 h-3" />
                    {viewerCount.toLocaleString()}
                  </span>
                  <span className="text-white/20 text-[10px]">{(chatMessages.length + fakeMessages.length)} msg{(chatMessages.length + fakeMessages.length) !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && fakeMessages.length === 0 && (
                  <div className="text-center text-white/20 text-xs py-8">No messages yet — say something!</div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className="text-xs">
                    {msg.type === "system" ? (
                      <div className="text-white/20 text-center text-[10px] py-1">{msg.text}</div>
                    ) : (
                      <div>
                        <span className={`font-semibold ${
                          msg.role === "admin" ? "text-red-400" : msg.role === "judge" ? "text-yellow-400" : "text-white/70"
                        }`}>
                          {msg.username}
                          {msg.role === "admin" && <span className="ml-1 text-[8px] text-red-500 uppercase">Admin</span>}
                          {msg.role === "judge" && <span className="ml-1 text-[8px] text-yellow-500 uppercase">Judge</span>}
                        </span>
                        <span className="text-white/50 ml-1.5">{msg.text}</span>
                      </div>
                    )}
                  </div>
                ))}
                {fakeMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <span className={`font-semibold ${
                      msg.role === "admin" ? "text-red-400" : msg.role === "judge" ? "text-yellow-400" : "text-white/70"
                    }`}>
                      {msg.username}
                      {msg.role === "admin" && <span className="ml-1 text-[8px] text-red-500 uppercase">Admin</span>}
                      {msg.role === "judge" && <span className="ml-1 text-[8px] text-yellow-500 uppercase">Judge</span>}
                    </span>
                    <span className="text-white/50 ml-1.5">{msg.text}</span>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat input */}
              <div className="border-t border-white/10 p-2">
                {user ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendChat()}
                      placeholder="Type a message..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/40 placeholder-white/20"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim()}
                      className="bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 disabled:opacity-30 rounded-lg px-3 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <a href={getLoginUrl()} className="flex items-center justify-center gap-2 w-full border border-white/15 text-white/40 hover:text-white rounded-lg py-2 text-[10px] uppercase tracking-widest transition-colors">
                    <LogIn className="w-3 h-3" /> Login to Chat
                  </a>
                )}
              </div>
            </div>

            {/* Voice Room Panel */}
            {user && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-2">
                    <Mic className="w-3 h-3 text-white/40" />
                    <span className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-semibold">Voice Room</span>
                  </div>
                  {voiceJoined && (
                    <span className="flex items-center gap-1 text-green-400 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Connected
                    </span>
                  )}
                </div>
                <div className="p-3">
                  {!voiceJoined ? (
                    <button
                      onClick={() => setVoiceJoined(true)}
                      className="w-full border border-white/15 text-white/50 hover:text-white hover:border-white/30 rounded-lg py-2.5 text-[10px] uppercase tracking-widest transition-all"
                    >
                      🎤 Join Voice Room
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={audioRoom.toggleMic}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] uppercase tracking-widest font-semibold border transition-all ${
                          audioRoom.isMuted
                            ? "border-white/15 text-white/40 hover:border-white/30"
                            : "border-green-500/50 bg-green-500/10 text-green-400"
                        }`}
                      >
                        {audioRoom.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        {audioRoom.isMuted ? "Unmute" : "Muted"}
                      </button>
                      <button
                        onClick={() => { setVoiceJoined(false); }}
                        className="w-full border border-red-500/30 text-red-400/60 hover:text-red-400 hover:border-red-500/50 rounded-lg py-2 text-[10px] uppercase tracking-widest transition-all"
                      >
                        Leave Voice
                      </button>
                      {/* Participants */}
                      {audioRoom.participants.filter(p => p.role !== "viewer").length > 0 && (
                        <div className="border-t border-white/10 pt-2 mt-2 space-y-1">
                          {audioRoom.participants.filter(p => p.role !== "viewer").map(p => (
                            <div key={p.socketId} className="flex items-center gap-2 text-[10px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${p.micActive ? "bg-green-400" : "bg-white/20"}`} />
                              <span className="text-white/60">{p.username}</span>
                              <span className={`ml-auto uppercase font-bold ${
                                p.role === "admin" ? "text-red-400" : p.role === "judge" ? "text-yellow-400" : "text-white/30"
                              }`}>{p.role}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Line Skip Credits */}
            {user && lineSkipCreditsData && lineSkipCreditsData.credits > 0 && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold">⚡ Line Skip Credits</span>
                  <span className="text-yellow-400 font-['Anton'] text-lg">{lineSkipCreditsData.credits}</span>
                </div>
                <button
                  onClick={() => useLineSkipMutation.mutate()}
                  disabled={useLineSkipMutation.isPending || pendingQueue.filter(s => s.userId === user.id && s.status === "pending").length === 0}
                  className="w-full border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 rounded-lg py-2 text-[10px] uppercase tracking-widest font-semibold transition-all disabled:opacity-30"
                >
                  Use Credit — Skip to Front
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
