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

type SubmitTab = "queue" | "history" | "submit" | "skip-info" | "apply-judge";

// ── Apply As Judge Tab ────────────────────────────────────────
function ApplyAsJudgeTab({ user, getLoginUrl }: { user: any; getLoginUrl: () => string }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const myApp = trpc.judgeApps.getMine.useQuery(undefined, { enabled: !!user });
  const applyMutation = trpc.judgeApps.submitApplication.useMutation({
    onSuccess: () => { setSubmitted(true); myApp.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="text-center py-12 border border-white/10 bg-white/[0.02] rounded-2xl">
        <div className="text-4xl mb-3">⚖️</div>
        <div className="font-['Anton'] text-2xl uppercase mb-2">Apply as Judge</div>
        <p className="text-white/40 text-sm mb-5">Login to apply to become a judge on Murder Mitten Media.</p>
        <a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all">
          Login to Apply
        </a>
      </div>
    );
  }

  if (myApp.data?.status === "pending") {
    return (
      <div className="text-center py-12 border border-yellow-500/30 bg-yellow-500/5 rounded-2xl max-w-lg mx-auto">
        <div className="text-4xl mb-3">⏳</div>
        <div className="font-['Anton'] text-2xl uppercase mb-2 text-yellow-400">Application Pending</div>
        <p className="text-white/50 text-sm">Your judge application is under review. We'll notify you when a decision is made.</p>
      </div>
    );
  }

  if (myApp.data?.status === "approved") {
    return (
      <div className="text-center py-12 border border-green-500/30 bg-green-500/5 rounded-2xl max-w-lg mx-auto">
        <div className="text-4xl mb-3">✅</div>
        <div className="font-['Anton'] text-2xl uppercase mb-2 text-green-400">You're a Judge!</div>
        <p className="text-white/50 text-sm">Your application was approved. You can now broadcast as a judge during live sessions.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-12 border border-green-500/30 bg-green-500/5 rounded-2xl max-w-lg mx-auto">
        <div className="text-4xl mb-3">🎉</div>
        <div className="font-['Anton'] text-2xl uppercase mb-2">Application Submitted!</div>
        <p className="text-white/50 text-sm">We'll review your application and get back to you soon.</p>
      </div>
    );
  }

  return (
    <div className="border border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent rounded-2xl p-8 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">⚖️</div>
        <h2 className="font-['Anton'] text-3xl uppercase mb-2">Apply as <span className="text-purple-400">Judge</span></h2>
        <p className="text-white/50 text-sm">Think you have what it takes to judge tracks on Murder Mitten Media? Apply below.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Why should you be a judge? (Optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Tell us about your music background, taste, and why you'd make a great judge..."
            rows={4}
            maxLength={512}
            className="w-full bg-white/5 border border-white/10 rounded-xl text-white px-4 py-3 focus:outline-none focus:border-purple-500/50 placeholder-white/20 resize-none text-sm"
          />
          <div className="text-white/20 text-xs text-right mt-1">{reason.length}/512</div>
        </div>
        <button
          onClick={() => applyMutation.mutate({ reason: reason.trim() || undefined })}
          disabled={applyMutation.isPending}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-white py-4 rounded-xl font-semibold uppercase tracking-widest transition-all"
        >
          {applyMutation.isPending ? "Submitting..." : "Submit Application →"}
        </button>
      </div>
    </div>
  );
}

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
  commentIntervalMs, setCommentIntervalMs, viewerMin, setViewerMin, viewerMax, setViewerMax,
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
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);
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
  const {
    viewerCount, fakeMessages, triggerReaction,
    commentIntervalMs, setCommentIntervalMs,
    viewerMin, setViewerMin, viewerMax, setViewerMax,
  } = useFakeLiveChat();

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

  // ── Merged chat messages (real + fake) sorted by timestamp ───
  const allMessages = [...chatMessages, ...fakeMessages].sort((a, b) => {
    const ta = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
    const tb = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
    return ta - tb;
  });

  const activeEntries = activeBroadcasts ?? [];

  // ── Expanded judge state ──────────────────────────────────────
  const expandedBroadcast = expandedJudge ? activeEntries.find((b: any) => String(b.id) === expandedJudge) : null;

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
          {/* LIVE VIEWER COUNT — super visible */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/30 rounded-full px-5 py-2.5">
              <Eye className="w-5 h-5 text-red-400" />
              <span className="font-['Anton'] text-2xl text-white tabular-nums">{viewerCount.toLocaleString()}</span>
              <span className="text-red-400 text-xs uppercase tracking-widest font-semibold">Watching</span>
            </div>
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
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── ADMIN PANEL (admin/judge only) ─────────────────── */}
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
            reviewedTracks={reviewedTracks}
            triggerReaction={triggerReaction}
            commentIntervalMs={commentIntervalMs}
            setCommentIntervalMs={setCommentIntervalMs}
            viewerMin={viewerMin}
            setViewerMin={setViewerMin}
            viewerMax={viewerMax}
            setViewerMax={setViewerMax}
          />
        )}

        {/* ── NOW PLAYING (large, prominent) ─────────────────── */}
        {liveReviewActive ? (
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
              </div>

              {/* Track info */}
              <div className="flex items-start gap-5 mb-5">
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-red-900/40 to-red-950/60 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                  <Music className="w-8 h-8 text-red-400/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-['Anton'] text-3xl md:text-4xl uppercase leading-tight truncate">
                    {liveReviewActive.songTitle}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {liveReviewActive.userId ? (
                      <Link href={`/profile/${liveReviewActive.userId}`} className="text-red-400 text-lg font-semibold hover:text-red-300 transition-colors truncate">
                        {liveReviewActive.artistName}
                      </Link>
                    ) : (
                      <span className="text-red-400 text-lg font-semibold truncate">{liveReviewActive.artistName}</span>
                    )}
                  </div>
                  {liveReviewActive.submissionType === "youtube" && liveReviewActive.youtubeUrl && (
                    <a href={liveReviewActive.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-white/30 text-xs hover:text-white/60 transition-colors mt-1">
                      <ExternalLink className="w-3 h-3" />
                      YouTube Link
                    </a>
                  )}
                </div>
              </div>

              {/* Audio/YouTube player */}
              {liveReviewActive.submissionType === "youtube" && liveReviewActive.youtubeUrl ? (
                <div className="rounded-xl overflow-hidden mb-5">
                  <SyncedYouTubePlayer
                    videoUrl={liveReviewActive.youtubeUrl}
                    ytSyncState={ytSyncState}
                    isAdmin={isAdmin}
                    onSeek={isAdmin ? (t) => broadcastRadioSeek(t) : undefined}
                    onPause={isAdmin ? (t) => broadcastRadioPause(t) : undefined}
                    onResume={isAdmin ? (t) => broadcastRadioResume(t) : undefined}
                  />
                </div>
              ) : liveReviewActive.submissionType === "file" && liveReviewActive.fileUrl ? (
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-5 py-4 mb-5">
                  <AudioPlayButton
                    url={liveReviewActive.fileUrl}
                    songTitle={liveReviewActive.songTitle}
                    artistName={liveReviewActive.artistName}
                    size="lg"
                  />
                  <div>
                    <div className="text-white/70 text-sm font-medium">{liveReviewActive.songTitle}</div>
                    <div className="text-white/30 text-xs">{liveReviewActive.artistName}</div>
                  </div>
                </div>
              ) : null}

              {/* Fire/Trash voting */}
              {currentPlaying && (
                <FireTrashPoll
                  submissionId={currentPlaying.id}
                  fireCount={currentPlaying.fireCount}
                  trashCount={currentPlaying.trashCount}
                  isAdmin={isAdmin}
                  onVote={() => refetch()}
                />
              )}
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

        {/* ── JUDGE CAMERAS ──────────────────────────────────── */}
        {activeEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-4 h-4 text-white/40" />
              <span className="text-white/40 text-xs uppercase tracking-widest font-semibold">Judge Cameras</span>
              <span className="text-white/20 text-xs">— click to expand</span>
            </div>

            {/* Expanded judge view */}
            {expandedBroadcast && (
              <div className="mb-4 rounded-2xl overflow-hidden border border-green-500/40 bg-black/60 relative">
                <button
                  onClick={() => setExpandedJudge(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
                <JudgeBroadcastCard broadcast={expandedBroadcast} />
              </div>
            )}

            {/* Judge camera thumbnails */}
            <div className={`grid gap-3 ${activeEntries.length === 1 ? "grid-cols-1 max-w-sm" : activeEntries.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {activeEntries.map((broadcast: any) => (
                <button
                  key={broadcast.id}
                  onClick={() => setExpandedJudge(expandedJudge === String(broadcast.id) ? null : String(broadcast.id))}
                  className={`relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer group ${expandedJudge === String(broadcast.id) ? "border-green-500/60 ring-1 ring-green-500/30" : "border-green-500/20 hover:border-green-500/50"}`}
                >
                  <JudgeBroadcastCard broadcast={broadcast} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1 text-white/80 text-xs font-semibold">
                      {expandedJudge === String(broadcast.id) ? "Collapse" : "Expand"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
            <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/20 rounded-full px-4 py-1.5">
              <Eye className="w-4 h-4 text-red-400" />
              <span className="font-['Anton'] text-lg text-white tabular-nums">{viewerCount.toLocaleString()}</span>
              <span className="text-red-400 text-[10px] uppercase tracking-widest">watching</span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {allMessages.length === 0 ? (
              <div className="text-center text-white/20 text-sm py-8">No messages yet — say something!</div>
            ) : (
              allMessages.map((msg) => {
                const isFake = "isFake" in msg && msg.isFake;
                const hasRealUsername = isFake && msg.username && !msg.username.match(/^User\d+$/);
                return (
                  <div key={msg.id} className="flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1.5 mr-2">
                        {hasRealUsername ? (
                          <Link href={`/profile/${msg.userId}`} className="text-red-400 text-xs font-semibold hover:text-red-300 transition-colors cursor-pointer">
                            {msg.username}
                          </Link>
                        ) : (
                          <span className={`text-xs font-semibold ${isFake ? "text-white/50" : "text-red-400"}`}>
                            {msg.username}
                          </span>
                        )}
                        {!isFake && msg.role && msg.role !== "user" && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${msg.role === "admin" ? "bg-red-600/20 text-red-400 border-red-600/30" : msg.role === "judge" ? "bg-purple-600/20 text-purple-400 border-purple-600/30" : "bg-white/10 text-white/40 border-white/20"}`}>
                            {msg.role}
                          </span>
                        )}
                      </span>
                      <span className="text-white/70 text-sm break-words">{msg.content}</span>
                    </div>
                  </div>
                );
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

        {/* ── BOTTOM MENU TABS ────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
          {/* Tab navigation */}
          <div className="flex overflow-x-auto scrollbar-none border-b border-white/10">
            {([
              { id: "submit", label: "Submit Now", icon: "🎵" },
              { id: "queue", label: "Queue", icon: "📋" },
              { id: "history", label: "History", icon: "📜" },
              { id: "skip-info", label: "Skip Track", icon: "⏭️" },
              { id: "apply-judge", label: "Apply as Judge", icon: "⚖️" },
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
                </div>

                {!user ? (
                  <div className="text-center py-8 border border-white/10 rounded-2xl">
                    <p className="text-white/40 text-sm mb-4">Login to submit your track</p>
                    <a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all">
                      <LogIn className="w-4 h-4" />
                      Login to Submit
                    </a>
                  </div>
                ) : submitted ? (
                  <div className="text-center py-10 border border-green-500/30 bg-green-500/5 rounded-2xl">
                    <div className="text-4xl mb-3">🎉</div>
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Submitted!</div>
                    <p className="text-white/50 text-sm">Your track is in the queue. Stay tuned!</p>
                    <button onClick={() => setSubmitted(false)} className="mt-4 text-red-400 text-xs hover:text-red-300 transition-colors">Submit another</button>
                  </div>
                ) : (
                  <>
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
                      {submitting ? "Submitting..." : "Submit Track →"}
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
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">⏭️</div>
                  <h2 className="font-['Anton'] text-3xl uppercase mb-2">Skip the <span className="text-red-600">Line</span></h2>
                  <p className="text-white/40 text-sm">Pay to jump ahead in the queue and get your track reviewed sooner</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "5 Spots Up", price: "$5", type: "reentry5" as const },
                    { label: "10 Spots Up", price: "$10", type: "reentry10" as const },
                    { label: "Skip to Front", price: "$20", type: "skip" as const },
                  ].map(opt => (
                    <div key={opt.type} className="flex items-center justify-between p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all">
                      <div>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-white/40 text-xs mt-0.5">CashApp: {CASHAPP} · PayPal: {PAYPAL}</div>
                      </div>
                      <div className="font-['Anton'] text-2xl text-red-500">{opt.price}</div>
                    </div>
                  ))}
                </div>
                <p className="text-white/20 text-xs text-center mt-4">After payment, contact us with your submission ID to confirm your skip.</p>
              </div>
            )}

            {/* ── APPLY AS JUDGE TAB ── */}
            {tab === "apply-judge" && (
              <ApplyAsJudgeTab user={user} getLoginUrl={getLoginUrl} />
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
