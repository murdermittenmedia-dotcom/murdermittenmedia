/* ============================================================
   MURDER MITTEN MEDIA -- Music Review
   Full streamer platform: admin controls, live video/audio room,
   real file upload, persistent player, queue management
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { useChat, type LiveReviewActiveItem, type LiveReviewPlayback } from "@/hooks/useChat";
import { useAudioRoom } from "@/hooks/useAudioRoom";
import { useVideoRoom } from "@/hooks/useVideoRoom";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
// Types inferred from tRPC query
type ReviewSubmission = { id: number; artistName: string; songTitle: string; submissionType: "youtube" | "file"; youtubeUrl: string | null; fileKey: string | null; fileUrl: string | null; contactInfo: string | null; status: "pending" | "playing" | "reviewed" | "removed"; skippedLine: boolean; skipPaymentConfirmed: boolean; position: number; notes: string | null; fireCount: number; trashCount: number; createdAt: Date; updatedAt: Date };
type QueueState = { id: number; isLive: boolean; liveMessage: string | null; streamUrl: string | null; currentPlayingId: number | null; updatedAt: Date };

type QueueAllData = { submissions: ReviewSubmission[]; state: QueueState | null; currentPlaying: ReviewSubmission | null };
import {
  Mic, MicOff, Video, VideoOff, Radio, Play, SkipForward,
  Trash2, CheckCircle, ChevronDown, ChevronUp, Settings, Users,
  ExternalLink, Flame, ThumbsDown, Crown, AlertCircle,
} from "lucide-react";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const CASHAPP = "$joyfuljules";
const PAYPAL = "MurderMittenPromo";
const APPLEPAY = "313-420-9004";

type SubmitTab = "queue" | "submit" | "skip-info";

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

// ── Video grid tile ───────────────────────────────────────────
function VideoTile({
  stream, username, role, avatarUrl, isMuted, isLocal = false,
}: {
  stream?: MediaStream | null;
  username: string;
  role: string;
  avatarUrl?: string;
  isMuted?: boolean;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const roleColor = role === "admin" ? "text-red-400" : role === "judge" ? "text-yellow-400" : "text-white/60";
  const roleLabel = role === "admin" ? "HOST" : role === "judge" ? "JUDGE" : "CONTESTANT";

  return (
    <div className="relative bg-black border border-white/10 rounded overflow-hidden aspect-video">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#111]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-16 h-16 rounded-full object-cover opacity-60" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <span className="font-['Anton'] text-2xl text-red-500">{username[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-xs font-semibold truncate">{username}</span>
          <span className={`text-[10px] font-bold uppercase ${roleColor}`}>{roleLabel}</span>
          {isMuted && <MicOff className="w-3 h-3 text-white/40 ml-auto" />}
        </div>
      </div>
      {isLocal && (
        <div className="absolute top-1 right-1 bg-black/60 text-white/40 text-[10px] px-1 rounded">YOU</div>
      )}
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────
function AdminPanel({
  data, refetch, audioRoom, videoRoom, broadcastReviewActive, broadcastReviewPlayback, broadcastReviewQueueUpdated, playTrack,
}: {
  data: QueueAllData | undefined;
  refetch: () => void;
  audioRoom: ReturnType<typeof useAudioRoom>;
  videoRoom: ReturnType<typeof useVideoRoom>;
  broadcastReviewActive: (item: { submissionId: number | null; artistName?: string; songTitle?: string; audioUrl?: string | null; youtubeUrl?: string | null; submissionType?: string }) => void;
  broadcastReviewPlayback: (data: { action: "play" | "pause" | "replay" | "skip" | "next"; currentTime?: number }) => void;
  broadcastReviewQueueUpdated: () => void;
  playTrack: (sub: ReviewSubmission) => void;
}) {
  const [streamUrlInput, setStreamUrlInput] = useState(data?.state?.streamUrl ?? "");
  const [liveMsg, setLiveMsg] = useState(data?.state?.liveMessage ?? "");
  const [showStreamSettings, setShowStreamSettings] = useState(false);

  const setLive = trpc.queue.setLive.useMutation({ onSuccess: () => refetch() });
  const setPlaying = trpc.queue.setPlaying.useMutation({ onSuccess: () => refetch() });
  const updateStatus = trpc.queue.updateStatus.useMutation({ onSuccess: () => refetch() });
  const confirmSkip = trpc.queue.confirmSkip.useMutation({ onSuccess: () => refetch() });

  const isLive = data?.state?.isLive ?? false;
  const currentPlaying = data?.currentPlaying;
  const queue: ReviewSubmission[] = data?.submissions?.filter((s: ReviewSubmission) => s.status === "pending" || s.status === "playing") ?? [];
  const pendingSkips: ReviewSubmission[] = data?.submissions?.filter((s: ReviewSubmission) => s.skippedLine && !s.skipPaymentConfirmed && s.status === "pending") ?? [];

  const handleGoLive = () => {
    setLive.mutate({ isLive: !isLive, message: liveMsg || undefined, streamUrl: streamUrlInput || undefined });
    toast.success(isLive ? "Stream ended" : "You're now live!");
  };

  const utils = trpc.useUtils();
  const handleSetPlaying = async (id: number) => {
    const sub = queue.find(s => s.id === id);
    if (!sub) return;
    // Resolve presigned URL first so all viewers get a direct playable URL
    let resolvedAudioUrl: string | null = null;
    if (sub.fileKey) {
      try {
        const { url } = await utils.queue.getAudioUrl.fetch({ fileKey: sub.fileKey });
        resolvedAudioUrl = url;
      } catch {
        resolvedAudioUrl = sub.fileUrl ?? null;
      }
    } else if (sub.fileUrl) {
      resolvedAudioUrl = sub.fileUrl;
    }
    setPlaying.mutate({ submissionId: id }, {
      onSuccess: () => {
        // Actually start audio playback in the global player
        playTrack(sub);
        broadcastReviewActive({
          submissionId: sub.id,
          artistName: sub.artistName,
          songTitle: sub.songTitle,
          audioUrl: resolvedAudioUrl,
          youtubeUrl: sub.youtubeUrl ?? null,
          submissionType: sub.submissionType,
        });
        broadcastReviewQueueUpdated();
      }
    });
    toast.success("Now playing track");
  };

  const handleSkip = () => {
    if (!currentPlaying) return;
    updateStatus.mutate({ id: currentPlaying.id, status: "reviewed" });
    const next = queue.find(s => s.status === "pending" && s.id !== currentPlaying.id);
    if (next) {
      setTimeout(() => {
        setPlaying.mutate({ submissionId: next.id }, {
          onSuccess: () => {
            broadcastReviewActive({
              submissionId: next.id,
              artistName: next.artistName,
              songTitle: next.songTitle,
              audioUrl: next.fileUrl ?? null,
              youtubeUrl: next.youtubeUrl ?? null,
              submissionType: next.submissionType,
            });
            broadcastReviewQueueUpdated();
          }
        });
      }, 300);
    } else {
      setPlaying.mutate({ submissionId: null }, { onSuccess: () => { broadcastReviewActive({ submissionId: null }); broadcastReviewQueueUpdated(); } });
    }
    broadcastReviewPlayback({ action: "skip" });
    toast.success("Skipped to next track");
  };

  const handleRemove = (id: number) => {
    updateStatus.mutate({ id, status: "removed" });
    toast.success("Removed from queue");
  };

  const handleMarkReviewed = (id: number) => {
    updateStatus.mutate({ id, status: "reviewed" });
    if (currentPlaying?.id === id) setPlaying.mutate({ submissionId: null });
    toast.success("Marked as reviewed");
  };

  return (
    <div className="border border-red-600/30 bg-red-600/5 rounded">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-600/20">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-red-500" />
          <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Admin Controls</span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Go Live button */}
        <div className="flex gap-2">
          <button
            onClick={handleGoLive}
            disabled={setLive.isPending}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all ${
              isLive
                ? "bg-red-600/20 border border-red-600/60 text-red-400 hover:bg-red-600/30"
                : "bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(209,0,0,0.3)]"
            }`}
          >
            {isLive ? "⏹ End Stream" : "🔴 Go Live"}
          </button>
          <button
            onClick={() => setShowStreamSettings(v => !v)}
            className="border border-white/20 text-white/40 hover:text-white px-3 transition-colors"
            title="Stream settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Stream settings */}
        {showStreamSettings && (
          <div className="border border-white/10 bg-black/30 p-3 space-y-3">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">Stream URL (YouTube Live / HLS)</label>
              <input
                type="url"
                value={streamUrlInput}
                onChange={e => setStreamUrlInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or HLS stream URL"
                className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider block mb-1">Live Message</label>
              <input
                type="text"
                value={liveMsg}
                onChange={e => setLiveMsg(e.target.value)}
                placeholder="e.g. Submitting tracks now — drop yours below!"
                className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/20"
              />
            </div>
            <button
              onClick={() => {
                setLive.mutate({ isLive, message: liveMsg || undefined, streamUrl: streamUrlInput || undefined });
                toast.success("Settings saved");
              }}
              className="w-full border border-white/20 text-white/60 hover:text-white py-2 text-xs uppercase tracking-widest transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}

        {/* Mic + Camera controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={audioRoom.toggleMic}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
              audioRoom.isMuted
                ? "border-white/20 text-white/40 hover:border-white/40"
                : "border-green-500/50 bg-green-500/10 text-green-400"
            }`}
          >
            {audioRoom.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {audioRoom.isMuted ? "Mic Off" : "Mic On"}
          </button>
          <button
            onClick={videoRoom.toggleCamera}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
              videoRoom.cameraActive
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-white/20 text-white/40 hover:border-white/40"
            }`}
          >
            {videoRoom.cameraActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            {videoRoom.cameraActive ? "Cam On" : "Cam Off"}
          </button>
        </div>

        {/* Pending skip payments */}
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

        {/* Now playing controls */}
        {currentPlaying && (
          <div className="border border-red-600/30 bg-red-600/5 p-3">
            <div className="text-red-400 text-xs uppercase tracking-wider font-bold mb-2">Now Playing</div>
            <div className="text-white font-semibold text-sm truncate">{currentPlaying.songTitle}</div>
            <div className="text-white/50 text-xs mb-3">by {currentPlaying.artistName}</div>
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center gap-1.5 border border-white/20 text-white/60 hover:text-white py-2 text-xs uppercase tracking-wider transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
              <button
                onClick={() => handleMarkReviewed(currentPlaying.id)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-green-500/40 text-green-400 hover:bg-green-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Reviewed
              </button>
              <button
                onClick={() => handleRemove(currentPlaying.id)}
                className="border border-red-600/30 text-red-400/60 hover:text-red-400 px-3 py-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Queue management */}
        <div>
          <div className="text-white/40 text-xs uppercase tracking-wider mb-2">Queue ({queue.length})</div>
          {queue.length === 0 ? (
            <div className="text-white/20 text-xs text-center py-4">Queue is empty</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {queue.map((sub, i) => (
                <div
                  key={sub.id}
                  className={`flex items-center gap-2 p-2 border text-xs ${
                    sub.status === "playing"
                      ? "border-red-600/40 bg-red-600/10"
                      : sub.skipPaymentConfirmed
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <span className="text-white/30 w-4 text-center flex-shrink-0">
                    {sub.status === "playing" ? "▶" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{sub.songTitle}</div>
                    <div className="text-white/40 truncate">{sub.artistName}</div>
                  </div>
                  {sub.skippedLine && (
                    <span className={`text-[10px] font-bold px-1 flex-shrink-0 ${sub.skipPaymentConfirmed ? "text-yellow-400" : "text-yellow-600"}`}>
                      ⚡
                    </span>
                  )}
                  {sub.submissionType === "file" && sub.fileUrl && (
                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-white/30 hover:text-white transition-colors flex-shrink-0" title="Open audio file">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {sub.submissionType === "youtube" && sub.youtubeUrl && (
                    <a href={sub.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0" title="Open YouTube">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    {sub.status !== "playing" && (
                      <button onClick={() => handleSetPlaying(sub.id)}
                        className="text-white/30 hover:text-green-400 transition-colors p-0.5" title="Set as playing">
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => handleRemove(sub.id)}
                      className="text-white/30 hover:text-red-400 transition-colors p-0.5" title="Remove">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants mic control */}
        {audioRoom.participants.filter(p => p.role !== "viewer").length > 0 && (
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Room Participants
            </div>
            <div className="space-y-1.5">
              {audioRoom.participants.filter(p => p.role !== "viewer").map(p => (
                <div key={p.socketId} className="flex items-center gap-2 p-2 border border-white/10 bg-white/[0.02] text-xs">
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

// ── Main page ─────────────────────────────────────────────────
export default function MusicReview() {
  const [tab, setTab] = useState<SubmitTab>("queue");
  const [submitType, setSubmitType] = useState<"youtube" | "file">("file");
  const [form, setForm] = useState({
    songTitle: "",
    youtubeUrl: "",
    contactInfo: "",
    wantsSkip: false,
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showVideoGrid, setShowVideoGrid] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const audioPlayer = useAudioPlayer();

  const { data, refetch, isLoading } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const submitMutation = trpc.queue.submit.useMutation({
    onSuccess: () => { setSubmitted(true); setSubmitting(false); refetch(); },
    onError: (err) => { toast.error("Submission failed: " + err.message); setSubmitting(false); },
  });

  const uploadAudioMutation = trpc.queue.uploadAudio.useMutation({
    onSuccess: () => { setSubmitted(true); setSubmitting(false); refetch(); },
    onError: (err) => { toast.error("Upload failed: " + err.message); setSubmitting(false); },
  });

  const reactMutation = trpc.queue.react.useMutation({ onSuccess: () => refetch() });
  const updateStatusMutation = trpc.queue.updateStatus.useMutation({ onSuccess: () => refetch() });

  // Auto-mark as reviewed when a queued track finishes playing
  useEffect(() => {
    const unsubscribe = audioPlayer.onEnded((finishedTrack) => {
      const queue = data?.submissions ?? [];
      const match = queue.find(
        s => (s.status === "pending" || s.status === "playing") &&
          s.songTitle === finishedTrack.title &&
          s.artistName === finishedTrack.artist
      );
      if (match) {
        updateStatusMutation.mutate({ id: match.id, status: "reviewed" });
      }
    });
    return unsubscribe;
  }, [audioPlayer, data, updateStatusMutation]);

  const chatUsername = user?.artistName || user?.name || "Guest";

  const audioRoom = useAudioRoom({
    enabled: isAdmin,
    room: "music_review",
    username: chatUsername,
    role: isAdmin ? "admin" : "viewer",
    userId: user?.id,
  });

  const videoRoom = useVideoRoom({
    enabled: isAdmin || false,
    room: "music_review",
    username: chatUsername,
    role: isAdmin ? "admin" : "viewer",
    userId: user?.id,
    avatarUrl: user?.avatarUrl ?? undefined,
  });

  const { data: chatHistory } = trpc.chat.getHistory.useQuery({ room: "music_review" });
  // Live review state — synced via socket for all viewers
  const [liveReviewActive, setLiveReviewActive] = useState<LiveReviewActiveItem | null>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

  const { messages: chatMessages, isConnected: chatConnected, sendMessage, broadcastReviewActive, broadcastReviewPlayback, broadcastReviewQueueUpdated } = useChat({
    room: "music_review",
    username: chatUsername,
    userId: user?.id,
    isAdmin,
    initialMessages: (chatHistory || []).map(m => ({
      id: m.id, username: m.username, message: m.message,
      room: m.room, isAdmin: m.isAdmin, createdAt: new Date(m.createdAt),
    })),
    onReviewActiveChanged: (item: LiveReviewActiveItem) => {
      setLiveReviewActive(item.submissionId === null ? null : item);
    },
    onReviewPlayback: (data: LiveReviewPlayback) => {
      if (!liveAudioRef.current) return;
      if (data.action === "play") liveAudioRef.current.play().catch(() => {});
      else if (data.action === "pause") liveAudioRef.current.pause();
      else if (data.action === "replay") { liveAudioRef.current.currentTime = 0; liveAudioRef.current.play().catch(() => {}); }
    },
    onReviewQueueUpdated: () => { refetch(); },
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
    if (!user) {
      toast.error("Please login to submit your track");
      return;
    }
    if (!form.songTitle) {
      toast.error("Please fill in song title");
      return;
    }
    if (submitType === "youtube" && !form.youtubeUrl) {
      toast.error("Please enter a YouTube link");
      return;
    }
    if (submitType === "file" && !audioFile) {
      toast.error("Please select an audio file");
      return;
    }
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

  const utils = trpc.useUtils();
  const playTrack = useCallback(async (sub: typeof pendingQueue[0]) => {
    if (sub.fileKey) {
      try {
        const { url } = await utils.queue.getAudioUrl.fetch({ fileKey: sub.fileKey });
        audioPlayer.play({ url, title: sub.songTitle, artist: sub.artistName, isStream: false, submissionId: sub.id });
      } catch {
        if (sub.fileUrl) {
          audioPlayer.play({ url: sub.fileUrl, title: sub.songTitle, artist: sub.artistName, isStream: false, submissionId: sub.id });
        } else {
          toast.error("Could not load audio file");
        }
      }
    } else if (sub.youtubeUrl) {
      window.open(sub.youtubeUrl, "_blank");
    } else {
      toast.error("No audio available");
    }
  }, [audioPlayer, utils]);

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

  const videoParticipants = videoRoom.participants.filter(p => p.cameraActive);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden pb-24">
      <SiteNav />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="pt-20 pb-8 border-b border-white/10">
        <div className="container">
          <div className="flex items-center gap-3 mb-4">
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
          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase mb-3">
            MUSIC <span className="text-red-600">REVIEW</span>
          </h1>
          <p className="text-white/50 text-base max-w-xl mb-6">
            Submit your track for a live review by Murder Mitten Media. Get in line, or skip to the front for $10.
          </p>

          {/* Stream section */}
          {isLive && streamUrl ? (
            <div className="mb-6">
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
                <div className="border border-red-600/30 bg-red-600/5 p-6 max-w-3xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center flex-shrink-0">
                      <Radio className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-['Anton'] text-xl uppercase">Murder Mitten Media — LIVE</div>
                      {liveMessage && <div className="text-white/50 text-sm mt-0.5">{liveMessage}</div>}
                    </div>
                    <button
                      onClick={playStream}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 text-sm font-semibold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Listen Live
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isLive ? (
            <div className="border border-red-600/30 bg-red-600/5 p-4 max-w-3xl mb-6 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div>
                <div className="text-red-400 text-sm font-semibold">Session is Live</div>
                {liveMessage && <div className="text-white/40 text-xs mt-0.5">{liveMessage}</div>}
              </div>
            </div>
          ) : (
            <div className="border border-white/10 bg-white/[0.02] p-6 max-w-3xl mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Radio className="w-5 h-5 text-white/20" />
                </div>
                <div>
                  <div className="text-white/40 text-sm font-semibold uppercase tracking-wider">Stream Offline</div>
                  <div className="text-white/20 text-xs mt-0.5">Submit your track below — we'll review it next session</div>
                </div>
              </div>
            </div>
          )}

          {/* Video grid */}
          {(videoParticipants.length > 0 || videoRoom.cameraActive) && (
            <div className="mb-6 max-w-3xl">
              <button
                onClick={() => setShowVideoGrid(v => !v)}
                className="flex items-center gap-2 text-white/40 hover:text-white text-xs uppercase tracking-wider mb-3 transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                Live Video ({videoParticipants.length + (videoRoom.cameraActive ? 1 : 0)})
                {showVideoGrid ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showVideoGrid && (
                <div className={`grid gap-2 ${
                  videoParticipants.length + (videoRoom.cameraActive ? 1 : 0) === 1
                    ? "grid-cols-1 max-w-sm"
                    : "grid-cols-2 md:grid-cols-3"
                }`}>
                  {videoRoom.cameraActive && (
                    <VideoTile
                      stream={null}
                      username={chatUsername}
                      role={isAdmin ? "admin" : "viewer"}
                      avatarUrl={user?.avatarUrl ?? undefined}
                      isMuted={audioRoom.isMuted}
                      isLocal={true}
                    />
                  )}
                  {videoRoom.remoteStreams.map(rs => {
                    const participant = videoRoom.participants.find(p => p.socketId === rs.socketId);
                    return (
                      <VideoTile
                        key={rs.socketId}
                        stream={rs.stream}
                        username={rs.username}
                        role={rs.role}
                        avatarUrl={rs.avatarUrl}
                        isMuted={!participant?.micActive}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="container py-8">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* Left: Queue + Submit */}
          <div>
            {/* Admin panel */}
            {isAdmin && (
              <div className="mb-8">
                <AdminPanel
                  data={data}
                  refetch={refetch}
                  audioRoom={audioRoom}
                  videoRoom={videoRoom}
                  broadcastReviewActive={broadcastReviewActive}
                  broadcastReviewPlayback={broadcastReviewPlayback}
                  broadcastReviewQueueUpdated={broadcastReviewQueueUpdated}
                  playTrack={playTrack}
                />
              </div>
            )}

            {/* Live Review Banner — shown to all viewers when admin is reviewing a track */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="mb-6 border border-red-600/50 bg-red-600/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent animate-pulse" />
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Being Reviewed</span>
                </div>
                <div className="font-['Anton'] text-2xl uppercase">{liveReviewActive.songTitle}</div>
                <div className="text-white/60 text-sm mb-3">by {liveReviewActive.artistName}</div>
                {liveReviewActive.audioUrl && (
                  <button
                    onClick={() => audioPlayer.play({
                      url: liveReviewActive.audioUrl!,
                      title: liveReviewActive.songTitle ?? "Live Review",
                      artist: liveReviewActive.artistName,
                      isStream: false,
                      sourcePage: "Music Review",
                      sourceUrl: "/music-review",
                    })}
                    className="flex items-center gap-2 mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Play in Player
                  </button>
                )}
                {liveReviewActive.youtubeUrl && (
                  <a
                    href={liveReviewActive.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open on YouTube
                  </a>
                )}
              </div>
            )}

            {/* Currently playing banner (fallback when no live socket active) */}
            {!liveReviewActive && currentPlaying && (
              <div className="mb-6 border border-red-600/50 bg-red-600/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent" />
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Playing</span>
                </div>
                <div className="font-['Anton'] text-2xl uppercase">{currentPlaying.songTitle}</div>
                <div className="text-white/60 text-sm">by {currentPlaying.artistName}</div>
                {(currentPlaying.fileKey || currentPlaying.fileUrl) && (
                  <button
                    onClick={() => playTrack(currentPlaying)}
                    className="mt-3 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Play in background
                  </button>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-0 mb-6 border border-white/10">
              {(["queue", "submit", "skip-info"] as SubmitTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-all border-r last:border-r-0 border-white/10 ${
                    tab === t
                      ? "bg-red-600 text-white"
                      : t === "skip-info"
                      ? "text-yellow-500/70 hover:text-yellow-400"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {t === "queue" ? `View Queue (${pendingQueue.length})` : t === "submit" ? "Submit Track" : "⚡ Skip Line ($10)"}
                </button>
              ))}
            </div>

            {/* Queue view */}
            {tab === "queue" && (
              <div>
                {isLoading ? (
                  <div className="text-center py-16 text-white/30">Loading queue...</div>
                ) : pendingQueue.length === 0 ? (
                  <div className="text-center py-16 border border-white/10 bg-white/[0.02]">
                    <div className="font-['Anton'] text-2xl uppercase mb-2">Queue is Empty</div>
                    <p className="text-white/40 text-sm mb-6">Be the first to submit your track!</p>
                    <button
                      onClick={() => setTab("submit")}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-xs font-semibold uppercase tracking-widest transition-all"
                    >
                      Submit Your Track →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingQueue.map((sub, i) => (
                      <div
                        key={sub.id}
                        className={`flex items-center gap-4 p-4 border transition-all ${
                          sub.status === "playing"
                            ? "border-red-600/60 bg-red-600/10"
                            : sub.skipPaymentConfirmed
                            ? "border-yellow-500/40 bg-yellow-500/5"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className={`w-10 h-10 flex items-center justify-center font-['Anton'] text-xl flex-shrink-0 ${
                          sub.status === "playing" ? "text-red-500" : "text-white/30"
                        }`}>
                          {sub.status === "playing" ? "▶" : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{sub.songTitle}</div>
                          <div className="text-white/50 text-xs truncate">
                            {sub.artistName}
                            {sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-400 font-bold">⚡ Skip Confirmed</span>}
                            {sub.skippedLine && !sub.skipPaymentConfirmed && <span className="ml-2 text-yellow-600">⚡ Pending Payment</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={sub.status} />
                          <button
                            onClick={() => user ? reactMutation.mutate({ submissionId: sub.id, reaction: "fire" }) : toast.error("Login to react")}
                            className="flex items-center gap-1 text-xs text-white/30 hover:text-orange-400 transition-colors"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>{sub.fireCount}</span>
                          </button>
                          <button
                            onClick={() => user ? reactMutation.mutate({ submissionId: sub.id, reaction: "trash" }) : toast.error("Login to react")}
                            className="flex items-center gap-1 text-xs text-white/30 hover:text-blue-400 transition-colors"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            <span>{sub.trashCount}</span>
                          </button>
                          {(sub.fileKey || sub.fileUrl) && (
                            <button onClick={() => playTrack(sub)}
                              className="text-white/30 hover:text-red-400 transition-colors" title="Play track">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {sub.youtubeUrl && (
                            <a href={sub.youtubeUrl} target="_blank" rel="noopener noreferrer"
                              className="text-white/30 hover:text-red-400 transition-colors" title="Open YouTube">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submit form */}
            {tab === "submit" && (
              <div>
                {submitted ? (
                  <div className="text-center py-16 border border-green-500/30 bg-green-500/5">
                    <div className="text-4xl mb-4">✅</div>
                    <div className="font-['Anton'] text-3xl uppercase mb-2">You're in the Queue!</div>
                    <p className="text-white/50 text-sm mb-6">We'll review your track during the next live session.</p>
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
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="flex gap-0 border border-white/10">
                      {(["youtube", "file"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setSubmitType(t)}
                          className={`flex-1 py-3 text-xs uppercase tracking-widest font-semibold transition-all ${
                            submitType === t ? "bg-red-600 text-white" : "text-white/40 hover:text-white"
                          }`}>
                          {t === "youtube" ? "YouTube Link" : "Upload File"}
                        </button>
                      ))}
                    </div>

                    {/* Artist name auto-filled from registered profile */}
                    <div className="bg-white/5 border border-white/10 px-4 py-3">
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Submitting as</div>
                      <div className="text-white font-semibold text-sm">{user?.artistName || user?.name || "Unknown Artist"}</div>
                    </div>

                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Song Title *</label>
                      <input type="text" value={form.songTitle}
                        onChange={e => setForm(f => ({ ...f, songTitle: e.target.value }))}
                        placeholder="Track name" required
                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20" />
                    </div>

                    {submitType === "youtube" ? (
                      <div>
                        <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">YouTube Link *</label>
                        <input type="url" value={form.youtubeUrl}
                          onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                          placeholder="https://youtube.com/watch?v=..." required
                          className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20" />
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
                              <div className="text-white/30 text-sm mb-1">Tap to select audio file</div>
                              <div className="text-white/20 text-xs">MP3, WAV, M4A, OGG — max 20MB</div>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,audio/*" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > 20 * 1024 * 1024) { toast.error("File must be under 20MB"); return; }
                            setAudioFile(f);
                          }} />
                      </div>
                    )}

                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Instagram / Contact (Optional)</label>
                      <input type="text" value={form.contactInfo}
                        onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))}
                        placeholder="@yourinstagram or phone number"
                        className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/20" />
                    </div>

                    <div
                      className={`border p-4 cursor-pointer transition-all ${form.wantsSkip ? "border-yellow-500/50 bg-yellow-500/10" : "border-white/10 bg-white/[0.02] hover:border-yellow-500/30"}`}
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

                    <button type="submit" disabled={submitting}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]">
                      {submitting ? "Submitting..." : "Submit to Queue →"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Skip info */}
            {tab === "skip-info" && (
              <div className="border border-yellow-500/30 bg-yellow-500/5 p-8">
                <div className="text-center mb-8">
                  <div className="text-4xl mb-3">⚡</div>
                  <h2 className="font-['Anton'] text-4xl uppercase mb-2">Skip the <span className="text-yellow-400">Line</span></h2>
                  <p className="text-white/50">Move your submission to the front of the review queue for just $10.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mb-8">
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
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 text-sm font-bold uppercase tracking-widest transition-all"
                >
                  Submit & Skip the Line →
                </button>
              </div>
            )}
          </div>

          {/* Right: Live Chat */}
          <div className="flex flex-col">
            <div className="border border-white/10 bg-white/[0.02] flex flex-col" style={{ height: "520px" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                <span className="text-white/60 text-xs uppercase tracking-widest font-semibold">Live Chat</span>
                <span className={`flex items-center gap-1.5 text-xs ${chatConnected ? "text-green-400" : "text-white/20"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${chatConnected ? "bg-green-400" : "bg-white/20"}`} />
                  {chatConnected ? "Live" : "Connecting..."}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {chatMessages.length === 0 && (
                  <p className="text-white/20 text-xs text-center py-6">No messages yet</p>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className="text-xs leading-relaxed">
                    <span className={`font-semibold ${msg.isAdmin ? "text-red-400" : "text-white/60"}`}>
                      {msg.isAdmin && "[ADMIN] "}{msg.username}:
                    </span>{" "}
                    <span className="text-white/80">{msg.message}</span>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="border-t border-white/10 flex gap-1.5 p-2 flex-shrink-0">
                <input
                  type="text" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  placeholder={user ? "Chat..." : "Login to chat"}
                  disabled={!user} maxLength={500}
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-red-600/50 placeholder-white/20 disabled:opacity-40"
                />
                <button onClick={handleSendChat} disabled={!user || !chatInput.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-semibold uppercase transition-colors">
                  Send
                </button>
              </div>
            </div>

            {/* On-air participants (public view) */}
            {audioRoom.participants.filter(p => p.role !== "viewer").length > 0 && !isAdmin && (
              <div className="mt-4 border border-white/10 bg-white/[0.02] p-3">
                <div className="text-white/40 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  On Air
                </div>
                <div className="flex flex-wrap gap-2">
                  {audioRoom.participants.filter(p => p.role !== "viewer").map(p => (
                    <div key={p.socketId} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${p.micActive ? "bg-green-400" : "bg-white/20"}`} />
                      <span className="text-white/60">{p.username}</span>
                      <span className={`text-[10px] uppercase font-bold ${p.role === "judge" ? "text-yellow-400" : "text-red-400"}`}>
                        {p.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 mt-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs">© 2022-{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI</div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
