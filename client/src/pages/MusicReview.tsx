/* ============================================================
   MURDER MITTEN MEDIA -- Music Review
   Full streamer platform: admin controls, live video/audio room,
   real file upload, persistent player, queue management
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { ArtistLink } from "@/components/ArtistLink";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { useChat, type LiveReviewActiveItem, type LiveReviewPlayback } from "@/hooks/useChat";
import { useAudioRoom } from "@/hooks/useAudioRoom";
import { useVideoRoom } from "@/hooks/useVideoRoom";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { usePlayTrack } from "@/hooks/usePlayTrack";
// Types inferred from tRPC query
type ReviewSubmission = { id: number; userId?: number | null; artistName: string; songTitle: string; submissionType: "youtube" | "file"; youtubeUrl: string | null; fileKey: string | null; fileUrl: string | null; contactInfo: string | null; status: "pending" | "playing" | "reviewed" | "removed"; skippedLine: boolean; skipPaymentConfirmed: boolean; position: number; notes: string | null; fireCount: number; trashCount: number; createdAt: Date; updatedAt: Date };
type QueueState = { id: number; isLive: boolean; liveMessage: string | null; streamUrl: string | null; currentPlayingId: number | null; updatedAt: Date };

type QueueAllData = { submissions: ReviewSubmission[]; state: QueueState | null; currentPlaying: ReviewSubmission | null };
import {
  Mic, MicOff, Video, VideoOff, Radio, Play, Pause, SkipForward,
  Trash2, CheckCircle, ChevronDown, ChevronUp, Settings, Users,
  ExternalLink, Flame, ThumbsDown, Crown, AlertCircle, RotateCcw, Music,
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
  data, refetch, audioRoom, videoRoom, broadcastReviewActive, broadcastRadioPause, broadcastRadioResume, broadcastRadioSeek, broadcastReviewPlayback, broadcastReviewQueueUpdated, playTrack, setSelectedYouTube,
}: {
  data: QueueAllData | undefined;
  refetch: () => void;
  audioRoom: ReturnType<typeof useAudioRoom>;
  videoRoom: ReturnType<typeof useVideoRoom>;
  broadcastReviewActive: (item: { submissionId: number | null; artistName?: string; songTitle?: string; audioUrl?: string | null; youtubeUrl?: string | null; submissionType?: string; fileKey?: string | null; fileUrl?: string | null }) => void;
  broadcastRadioPause: (currentTime: number) => void;
  broadcastRadioResume: (currentTime: number) => void;
  broadcastRadioSeek: (currentTime: number) => void;
  broadcastReviewPlayback: (data: { action: "play" | "pause" | "replay" | "skip" | "next"; currentTime?: number }) => void;
  broadcastReviewQueueUpdated: () => void;
  playTrack: (sub: ReviewSubmission) => void;
  setSelectedYouTube: (val: { url: string; title: string; artist: string } | null) => void;
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

    setPlaying.mutate({ submissionId: id }, {
      onSuccess: () => {
        // For admin's own player: play locally
        playTrack(sub);
        // Broadcast via radio:load — server resolves presigned URL and emits to ALL clients
        broadcastReviewActive({
          submissionId: sub.id,
          artistName: sub.artistName,
          songTitle: sub.songTitle,
          audioUrl: null, // server will resolve this
          youtubeUrl: sub.youtubeUrl ?? null,
          submissionType: sub.submissionType,
          fileKey: sub.fileKey ?? null,
          fileUrl: sub.fileUrl ?? null,
        });
        broadcastReviewQueueUpdated();
        toast.success(`Now playing: ${sub.songTitle}`);
      },
      onError: (err) => {
        toast.error("Failed to set playing: " + err.message);
      }
    });
  };

  const handleSkip = async () => {
    if (!currentPlaying) return;
    updateStatus.mutate({ id: currentPlaying.id, status: "reviewed" });
    const next = queue.find(s => s.status === "pending" && s.id !== currentPlaying.id);
    if (next) {
      setTimeout(() => {
        setPlaying.mutate({ submissionId: next.id }, {
          onSuccess: () => {
            playTrack(next);
            // Server resolves presigned URL via radio:load
            broadcastReviewActive({
              submissionId: next.id,
              artistName: next.artistName,
              songTitle: next.songTitle,
              audioUrl: null,
              youtubeUrl: next.youtubeUrl ?? null,
              submissionType: next.submissionType,
              fileKey: next.fileKey ?? null,
              fileUrl: next.fileUrl ?? null,
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
            <div className="flex items-center justify-between mb-2">
              <div className="text-red-400 text-xs uppercase tracking-wider font-bold">Now Playing</div>
              <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="text-white font-semibold text-sm truncate">{currentPlaying.songTitle}</div>
            <div className="text-white/50 text-xs mb-3">by <ArtistLink artistName={currentPlaying.artistName} userId={currentPlaying.userId} /></div>
            {/* Transport controls — Pause/Resume, Rewind, Skip */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <button
                onClick={() => broadcastRadioPause(0)}
                className="flex items-center justify-center gap-1 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
                title="Pause for all listeners"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
              <button
                onClick={() => broadcastRadioResume(0)}
                className="flex items-center justify-center gap-1 border border-green-500/40 text-green-400 hover:bg-green-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
                title="Resume for all listeners"
              >
                <Play className="w-3.5 h-3.5" />
                Play
              </button>
              <button
                onClick={() => broadcastRadioSeek(0)}
                className="flex items-center justify-center gap-1 border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
                title="Rewind to start for all listeners"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rewind
              </button>
              <button
                onClick={handleSkip}
                className="flex items-center justify-center gap-1 border border-white/20 text-white/60 hover:text-white py-2 text-xs uppercase tracking-wider transition-colors"
                title="Skip to next track"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Next
              </button>
            </div>
            <div className="flex gap-2">
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
                    <div className="text-white/40 truncate"><ArtistLink artistName={sub.artistName} userId={sub.userId} /></div>
                  </div>
                  {sub.skippedLine && (
                    <span className={`text-[10px] font-bold px-1 flex-shrink-0 ${sub.skipPaymentConfirmed ? "text-yellow-400" : "text-yellow-600"}`}>
                      ⚡
                    </span>
                  )}
                  {sub.submissionType === "youtube" && sub.youtubeUrl && (
                    <button
                      onClick={() => setSelectedYouTube({ url: sub.youtubeUrl!, title: sub.songTitle, artist: sub.artistName })}
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0" title="Preview YouTube inline">
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {sub.fileUrl && (
                    <AudioPlayButton
                      url={sub.fileUrl}
                      urlSource="queue"
                      title={sub.songTitle}
                      artist={sub.artistName}
                      submissionId={sub.id}
                      sourcePage="Music Review"
                      sourceUrl="/review"
                      size="sm"
                    />
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    {sub.status !== "playing" && (
                      <button onClick={() => handleSetPlaying(sub.id)}
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border border-green-500/40 text-green-400 hover:bg-green-500/10 px-2 py-0.5 transition-colors" title="Load to Now Playing — broadcasts to all viewers">
                        <Play className="w-2.5 h-2.5" />
                        Load
                      </button>
                    )}
                    {sub.status === "playing" && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border border-red-500/40 text-red-400 px-2 py-0.5">
                        ▶ Live
                      </span>
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
  // Inline YouTube embed state — set when a YouTube submission is "played"
  const [selectedYouTube, setSelectedYouTube] = useState<{ url: string; title: string; artist: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const audioPlayer = useAudioPlayer();
  const { playTrack: resolveAndPlay } = usePlayTrack();

  const { data, refetch, isLoading } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 15000,
  });

  // Previously reviewed tracks — the ONLY place on the site with independent playback
  const { data: reviewedTracks } = trpc.queue.getReviewed.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const submitMutation = trpc.queue.submit.useMutation({
    onSuccess: () => { setSubmitted(true); setSubmitting(false); refetch(); },
    onError: (err) => { toast.error("Submission failed: " + err.message); setSubmitting(false); },
  });

  const uploadAudioMutation = trpc.queue.uploadAudio.useMutation({
    onSuccess: () => { setSubmitted(true); setSubmitting(false); refetch(); },
    onError: (err) => { toast.error("Upload failed: " + err.message); setSubmitting(false); },
  });

  const reactMutation = trpc.queue.react.useMutation({
    onSuccess: () => {
      refetch();
      refetchMyReaction();
      refetchReactions();
    },
    onError: (err) => {
      if (err.message.includes("Already voted")) {
        toast.error("You already voted on this track!");
      } else {
        toast.error(err.message);
      }
    },
  });
  const updateStatusMutation = trpc.queue.updateStatus.useMutation({ onSuccess: () => refetch() });

  // Poll queries for the currently playing submission
  const currentPlayingId = data?.currentPlaying?.id ?? null;
  const { data: myReaction, refetch: refetchMyReaction } = trpc.queue.getMyReaction.useQuery(
    { submissionId: currentPlayingId! },
    { enabled: !!user && !!currentPlayingId, refetchInterval: 5000 }
  );
  const { data: reactionCounts, refetch: refetchReactions } = trpc.queue.getReactions.useQuery(
    { submissionId: currentPlayingId! },
    { enabled: !!currentPlayingId, refetchInterval: 5000 }
  );

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

  const [voiceJoined, setVoiceJoined] = useState(false);
  const audioRoom = useAudioRoom({
    enabled: voiceJoined || isAdmin,
    room: "music_review",
    username: chatUsername,
    role: isAdmin ? "admin" : "user",
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

  const { messages: chatMessages, isConnected: chatConnected, sendMessage, broadcastReviewActive, broadcastRadioPause, broadcastRadioResume, broadcastRadioSeek, broadcastReviewPlayback, broadcastReviewQueueUpdated } = useChat({
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
  // Play a submission: resolves presigned URL for files, embeds YouTube inline
  const playTrack = useCallback(async (sub: ReviewSubmission) => {
    if (sub.submissionType === "youtube" && sub.youtubeUrl) {
      // Show inline YouTube embed instead of opening new tab
      setSelectedYouTube({ url: sub.youtubeUrl, title: sub.songTitle, artist: sub.artistName });
      return;
    }
    if (sub.fileUrl) {
      // Use fileUrl (has hash suffix) not fileKey (original key without hash)
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
                  broadcastRadioPause={broadcastRadioPause}
                  broadcastRadioResume={broadcastRadioResume}
                  broadcastRadioSeek={broadcastRadioSeek}
                  broadcastReviewPlayback={broadcastReviewPlayback}
                  broadcastReviewQueueUpdated={broadcastReviewQueueUpdated}
                  playTrack={playTrack}
                  setSelectedYouTube={setSelectedYouTube}
                />
              </div>
            )}

            {/* Inline YouTube embed — shown when user clicks play on a YouTube submission */}
            {selectedYouTube && (() => {
              const ytId = selectedYouTube.url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)(\w[\w-]{10})/)?.[1];
              return (
                <div className="mb-6 border border-white/20 bg-black/60 p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-['Anton'] text-lg uppercase">{selectedYouTube.title}</div>
                      <div className="text-white/50 text-xs">by {selectedYouTube.artist}</div>
                    </div>
                    <button
                      onClick={() => setSelectedYouTube(null)}
                      className="text-white/30 hover:text-white text-xl leading-none px-2"
                      title="Close"
                    >
                      ✕
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
                      Could not parse YouTube ID.{" "}
                      <a href={selectedYouTube.url} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
                        Open on YouTube →
                      </a>
                    </div>
                  )}
                  <a
                    href={selectedYouTube.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors mt-3"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open on YouTube
                  </a>
                </div>
              );
            })()}

            {/* Live Review Banner — shown to all viewers when admin is reviewing a track */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="mb-6 border border-red-600/50 bg-red-600/10 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent animate-pulse" />
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Being Reviewed</span>
                </div>
                <div className="font-['Anton'] text-2xl uppercase">{liveReviewActive.songTitle}</div>
                <div className="text-white/60 text-sm mb-3">by <ArtistLink artistName={liveReviewActive.artistName ?? ''} userId={null} /></div>
                {liveReviewActive.audioUrl && (
                  <div className="mt-3">
                    {isAdmin ? (
                      <AudioPlayButton
                        url={liveReviewActive.audioUrl}
                        urlSource="queue"
                        title={liveReviewActive.songTitle ?? "Live Review"}
                        artist={liveReviewActive.artistName}
                        submissionId={liveReviewActive.submissionId ?? undefined}
                        sourcePage="Music Review"
                        sourceUrl="/review"
                        size="lg"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span className="font-semibold">Playing Live — synced to admin</span>
                      </div>
                    )}
                  </div>
                )}
                {liveReviewActive.youtubeUrl && (() => {
                  const ytId = liveReviewActive.youtubeUrl?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)(\w[\w-]{10})/)?.[1];
                  return ytId ? (
                    <div className="mt-3">
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}?autoplay=0&rel=0`}
                          className="absolute inset-0 w-full h-full border border-white/10"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={liveReviewActive.songTitle ?? 'YouTube'}
                        />
                      </div>
                      <a
                        href={liveReviewActive.youtubeUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open on YouTube
                      </a>
                    </div>
                  ) : (
                    <a
                      href={liveReviewActive.youtubeUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open on YouTube
                    </a>
                  );
                })()}
              </div>
            )}

            {/* ── BIG FIRE / TRASH POLL ─────────────────────────────────────────
               Shown to ALL viewers when admin is reviewing a track live.
               This is the main interactive element — big, unmissable, full-width.
            ─────────────────────────────────────────────────────────────────── */}
            {liveReviewActive && liveReviewActive.submissionId !== null && (
              <div className="mb-6 border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="px-5 pt-4 pb-2 border-b border-white/10 flex items-center gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-widest font-semibold">Rate This Track</span>
                  <span className="text-white/20 text-xs">— Your vote is live</span>
                </div>
                <div className="grid grid-cols-2">
                  {/* FIRE */}
                  <button
                    onClick={() => {
                      if (!user) { toast.error("Login to vote"); return; }
                      reactMutation.mutate({ submissionId: liveReviewActive.submissionId!, reaction: "fire" });
                    }}
                    className="group flex flex-col items-center justify-center gap-3 py-10 border-r border-white/10 hover:bg-orange-500/10 active:bg-orange-500/20 transition-all duration-200"
                  >
                    <span className="text-7xl group-hover:scale-125 group-active:scale-110 transition-transform duration-200 select-none">🔥</span>
                    <div className="text-center">
                      <div className="font-['Anton'] text-3xl text-orange-400 group-hover:text-orange-300 transition-colors">FIRE</div>
                      <div className="text-white/30 text-xs uppercase tracking-widest mt-0.5">This a banger</div>
                    </div>
                  </button>
                  {/* TRASH */}
                  <button
                    onClick={() => {
                      if (!user) { toast.error("Login to vote"); return; }
                      reactMutation.mutate({ submissionId: liveReviewActive.submissionId!, reaction: "trash" });
                    }}
                    className="group flex flex-col items-center justify-center gap-3 py-10 hover:bg-blue-500/10 active:bg-blue-500/20 transition-all duration-200"
                  >
                    <span className="text-7xl group-hover:scale-125 group-active:scale-110 transition-transform duration-200 select-none">🗑️</span>
                    <div className="text-center">
                      <div className="font-['Anton'] text-3xl text-blue-400 group-hover:text-blue-300 transition-colors">TRASH</div>
                      <div className="text-white/30 text-xs uppercase tracking-widest mt-0.5">Next track please</div>
                    </div>
                  </button>
                </div>
                {/* Live vote counts */}
                {(() => {
                  const sub = data?.submissions?.find(s => s.id === liveReviewActive.submissionId);
                  if (!sub) return null;
                  const total = (sub.fireCount ?? 0) + (sub.trashCount ?? 0);
                  const firePct = total > 0 ? Math.round(((sub.fireCount ?? 0) / total) * 100) : 50;
                  const trashPct = total > 0 ? 100 - firePct : 50;
                  return (
                    <div className="border-t border-white/10">
                      <div className="flex">
                        <div
                          className="h-2 bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700"
                          style={{ width: `${firePct}%` }}
                        />
                        <div
                          className="h-2 bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-700"
                          style={{ width: `${trashPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between px-5 py-2 text-xs">
                        <span className="text-orange-400 font-bold">🔥 {sub.fireCount ?? 0} Fire ({firePct}%)</span>
                        <span className="text-white/30">{total} votes</span>
                        <span className="text-blue-400 font-bold">{trashPct}% Trash 🗑️ {sub.trashCount ?? 0}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Currently playing banner with Fire/Trash poll */}
            {!liveReviewActive && currentPlaying && (() => {
              const fire = reactionCounts?.fire ?? currentPlaying.fireCount ?? 0;
              const trash = reactionCounts?.trash ?? currentPlaying.trashCount ?? 0;
              const total = fire + trash;
              const firePct = total > 0 ? Math.round((fire / total) * 100) : 50;
              const trashPct = total > 0 ? 100 - firePct : 50;
              const hasVoted = !!myReaction;
              const myVote = myReaction?.reaction ?? null;
              return (
                <div className="mb-6 border border-red-600/50 bg-red-600/10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-transparent animate-pulse" />
                  {/* Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Now Playing</span>
                    </div>
                    <div className="font-['Anton'] text-2xl uppercase">{currentPlaying.songTitle}</div>
                    <div className="text-white/60 text-sm mb-3">by <ArtistLink artistName={currentPlaying.artistName} userId={currentPlaying.userId} /></div>
                    {currentPlaying.fileUrl && (
                      <div className="inline-flex items-center gap-2 text-xs text-red-400 font-semibold uppercase tracking-widest border border-red-600/40 px-3 py-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Playing Live — Synced to Admin
                      </div>
                    )}
                    {currentPlaying.youtubeUrl && !currentPlaying.fileUrl && (
                      <a href={currentPlaying.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Open on YouTube
                      </a>
                    )}
                  </div>
                  {/* Poll divider */}
                  <div className="border-t border-white/10 mx-5" />
                  {/* Poll label */}
                  <div className="px-5 pt-4 pb-2 text-center">
                    <span className="text-white/40 text-xs uppercase tracking-[0.2em] font-semibold">
                      {hasVoted ? (myVote === "fire" ? "🔥 You voted Fire" : "🗑️ You voted Trash") : "Cast Your Vote"}
                    </span>
                  </div>
                  {/* Vote buttons */}
                  <div className="grid grid-cols-2 divide-x divide-white/10">
                    <button
                      onClick={() => {
                        if (!user) { toast.error("Login to vote"); return; }
                        if (hasVoted) { toast.error("You already voted!"); return; }
                        reactMutation.mutate({ submissionId: currentPlaying.id, reaction: "fire" });
                      }}
                      disabled={hasVoted || reactMutation.isPending}
                      className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
                        myVote === "fire"
                          ? "bg-orange-500/20 cursor-default"
                          : hasVoted
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-orange-500/10 active:bg-orange-500/20 cursor-pointer"
                      }`}
                    >
                      <span className={`text-6xl transition-transform duration-200 select-none ${
                        myVote === "fire" ? "scale-125" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
                      }`}>🔥</span>
                      <div className="text-center">
                        <div className={`font-['Anton'] text-2xl transition-colors ${
                          myVote === "fire" ? "text-orange-300" : "text-orange-400 group-hover:text-orange-300"
                        }`}>FIRE</div>
                        <div className="text-white/30 text-xs uppercase tracking-widest">This a banger</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (!user) { toast.error("Login to vote"); return; }
                        if (hasVoted) { toast.error("You already voted!"); return; }
                        reactMutation.mutate({ submissionId: currentPlaying.id, reaction: "trash" });
                      }}
                      disabled={hasVoted || reactMutation.isPending}
                      className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
                        myVote === "trash"
                          ? "bg-blue-500/20 cursor-default"
                          : hasVoted
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-blue-500/10 active:bg-blue-500/20 cursor-pointer"
                      }`}
                    >
                      <span className={`text-6xl transition-transform duration-200 select-none ${
                        myVote === "trash" ? "scale-125" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
                      }`}>🗑️</span>
                      <div className="text-center">
                        <div className={`font-['Anton'] text-2xl transition-colors ${
                          myVote === "trash" ? "text-blue-300" : "text-blue-400 group-hover:text-blue-300"
                        }`}>TRASH</div>
                        <div className="text-white/30 text-xs uppercase tracking-widest">Next track please</div>
                      </div>
                    </button>
                  </div>
                  {/* Live results bar */}
                  <div className="border-t border-white/10">
                    <div className="flex">
                      <div className="h-2 bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700" style={{ width: `${firePct}%` }} />
                      <div className="h-2 bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-700" style={{ width: `${trashPct}%` }} />
                    </div>
                    <div className="flex justify-between px-5 py-2.5 text-xs">
                      <span className="text-orange-400 font-bold">🔥 {fire} Fire ({firePct}%)</span>
                      <span className="text-white/30">{total} vote{total !== 1 ? "s" : ""} · updates live</span>
                      <span className="text-blue-400 font-bold">{trashPct}% Trash 🗑️ {trash}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                            <ArtistLink artistName={sub.artistName} userId={sub.userId} />
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
                          {sub.submissionType === "youtube" && sub.youtubeUrl ? (
                            <button
                              onClick={() => setSelectedYouTube({ url: sub.youtubeUrl!, title: sub.songTitle, artist: sub.artistName })}
                              className="flex items-center gap-1 text-white/30 hover:text-red-400 transition-colors"
                              title="Watch on page"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : sub.fileUrl ? (
                            sub.status === "playing" ? (
                              <div className="inline-flex items-center gap-1 text-[10px] text-red-400 font-bold uppercase tracking-widest border border-red-600/40 px-2 py-1">
                                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                Live
                              </div>
                            ) : null
                          ) : null}
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
                      {msg.isAdmin && "[ADMIN] "}
                      <ArtistStatModal artistName={msg.username}>
                        <button className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</button>
                      </ArtistStatModal>:
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

            {/* Voice Chat Panel — open to all logged-in users */}
            <div className="mt-4 border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/60 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Mic className="w-3 h-3" />
                  Voice Chat
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${audioRoom.isConnected ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                  <span className="text-xs text-white/30">{audioRoom.participants.length} in room</span>
                </div>
              </div>
              {audioRoom.error && (
                <div className="text-red-400 text-xs bg-red-900/20 border border-red-600/20 p-2 mb-2">{audioRoom.error}</div>
              )}
              {!user ? (
                <a href={getLoginUrl()} className="block w-full text-center text-xs bg-red-600 hover:bg-red-700 text-white py-2 uppercase tracking-widest transition-colors">Login to Join Voice</a>
              ) : !voiceJoined && !isAdmin ? (
                <button onClick={() => setVoiceJoined(true)} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 text-xs font-semibold uppercase tracking-widest transition-colors">
                  Join Voice Chat
                </button>
              ) : (
                <>
                  <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
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
                  <div className="flex gap-2">
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PREVIOUSLY REVIEWED TRACKS — Only place with independent playback ── */}
      {reviewedTracks && reviewedTracks.length > 0 && (
        <section className="border-t border-white/10 py-12">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
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
                  {/* Independent play button — ONLY allowed here */}
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
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
