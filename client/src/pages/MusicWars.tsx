/* ============================================================
   MUSIC WARS — Murder Mitten Media
   Features: animated spin wheel, live stream, real-time chat,
   audio battle room, submission form, admin panel,
   battle leaderboard with clickable artist stat popups
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteNav } from "@/components/SiteNav";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { TuneInButton } from "@/components/TuneInButton";
import { useChat } from "@/hooks/useChat";
import { useWarsRadio, type WarsRadioTrack } from "@/hooks/useWarsRadio";
import { ArtistLink } from "@/components/ArtistLink";
import { Play, Pause, SkipForward, SkipBack, Rewind, FastForward, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAudioRoom, type AudioParticipant } from "@/hooks/useAudioRoom";
import { getLoginUrl } from "@/const";
import { AudioPlayButton } from "@/components/AudioPlayButton";
// ─── Live Stream Panel (offline-aware) ────────────────────────────────
interface EventData {
  title: string | null;
  date: Date | null;
  streamUrl: string | null;
  isLive: boolean;
}
function LiveStreamPanel({
  eventData,
  isAdmin,
  onSetLive,
  onScheduleEvent,
}: {
  eventData?: EventData | null;
  isAdmin: boolean;
  onSetLive: (isLive: boolean, streamUrl?: string) => Promise<any>;
  onScheduleEvent: (title: string, date: string, streamUrl?: string) => Promise<any>;
}) {
  const isLive = eventData?.isLive ?? false;
  const streamUrl = eventData?.streamUrl ?? "";
  const nextDate = eventData?.date ? new Date(eventData.date) : null;
  const nextTitle = eventData?.title ?? "";

  // Countdown state
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    if (!nextDate || isLive) return;
    const tick = () => {
      const diff = nextDate.getTime() - Date.now();
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown({ days, hours, minutes, seconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextDate, isLive]);

  // Admin form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedTitle, setSchedTitle] = useState(nextTitle);
  const [schedDate, setSchedDate] = useState("");
  const [schedUrl, setSchedUrl] = useState(streamUrl);
  const [liveUrl, setLiveUrl] = useState(streamUrl);
  const [saving, setSaving] = useState(false);

  const handleGoLive = async () => {
    setSaving(true);
    await onSetLive(true, liveUrl || undefined);
    setSaving(false);
  };
  const handleGoOffline = async () => {
    setSaving(true);
    await onSetLive(false);
    setSaving(false);
  };
  const handleSchedule = async () => {
    if (!schedTitle || !schedDate) return;
    setSaving(true);
    await onScheduleEvent(schedTitle, schedDate, schedUrl || undefined);
    setSaving(false);
    setShowScheduleForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-white/20"}`} />
          <span className="text-xs text-red-400 uppercase tracking-widest font-semibold">
            {isLive ? "Live Stream" : "Stream Offline"}
          </span>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {isLive ? (
              <button onClick={handleGoOffline} disabled={saving}
                className="text-xs border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 px-3 py-1 uppercase tracking-widest transition-colors">
                End Stream
              </button>
            ) : (
              <button onClick={handleGoLive} disabled={saving}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 uppercase tracking-widest transition-colors">
                Go Live
              </button>
            )}
            <button onClick={() => setShowScheduleForm(v => !v)}
              className="text-xs border border-white/20 text-white/50 hover:border-white/50 hover:text-white px-3 py-1 uppercase tracking-widest transition-colors">
              Schedule
            </button>
          </div>
        )}
      </div>

      {/* Admin: Go Live URL input */}
      {isAdmin && !isLive && (
        <div className="mb-3 flex gap-2">
          <input
            type="url"
            placeholder="YouTube stream URL (for when going live)"
            value={liveUrl}
            onChange={e => setLiveUrl(e.target.value)}
            className="flex-1 bg-[#0d0d0d] border border-white/10 text-white/80 text-xs px-3 py-2 focus:outline-none focus:border-red-600/50"
          />
        </div>
      )}

      {/* Admin: Schedule form */}
      {isAdmin && showScheduleForm && (
        <div className="mb-3 bg-[#0d0d0d] border border-white/10 p-4 space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-widest">Schedule Next Event</p>
          <input type="text" placeholder="Event title (e.g. Music Wars Season 3 Ep. 1)"
            value={schedTitle} onChange={e => setSchedTitle(e.target.value)}
            className="w-full bg-black border border-white/10 text-white/80 text-xs px-3 py-2 focus:outline-none focus:border-red-600/50" />
          <input type="datetime-local"
            value={schedDate} onChange={e => setSchedDate(e.target.value)}
            className="w-full bg-black border border-white/10 text-white/80 text-xs px-3 py-2 focus:outline-none focus:border-red-600/50" />
          <input type="url" placeholder="YouTube stream URL (optional, set now or later)"
            value={schedUrl} onChange={e => setSchedUrl(e.target.value)}
            className="w-full bg-black border border-white/10 text-white/80 text-xs px-3 py-2 focus:outline-none focus:border-red-600/50" />
          <button onClick={handleSchedule} disabled={saving || !schedTitle || !schedDate}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs uppercase tracking-widest py-2 transition-colors">
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      )}

      {/* Stream area */}
      {isLive && streamUrl ? (
        <div>
          <div className="relative w-full bg-black border border-white/10" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={streamUrl.includes("youtube.com/watch?v=")
                ? streamUrl.replace("watch?v=", "embed/") + "?autoplay=1"
                : streamUrl.includes("youtu.be/")
                ? `https://www.youtube.com/embed/${streamUrl.split("youtu.be/")[1]}?autoplay=1`
                : streamUrl}
              title="Murder Mitten Media Live"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/30">
            <span>Murder Mitten Media on YouTube</span>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer"
              className="hover:text-red-400 transition-colors">Open on YouTube</a>
          </div>
        </div>
      ) : isLive ? (
        // Live but no URL set yet
        <div className="relative w-full bg-black border border-white/10" style={{ paddingTop: "56.25%" }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <p className="font-['Anton'] text-2xl text-white uppercase tracking-widest">LIVE NOW</p>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer"
              className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors">
              Watch on YouTube →
            </a>
          </div>
        </div>
      ) : (
        // OFFLINE screen
        <div className="relative w-full bg-[#080808] border border-white/10" style={{ paddingTop: "56.25%" }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
            {/* Offline badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="text-xs text-white/30 uppercase tracking-[0.3em]">Offline</span>
            </div>
            <p className="font-['Anton'] text-3xl md:text-4xl text-white uppercase tracking-widest text-center">
              MUSIC WARS <span className="text-red-600">OFFLINE</span>
            </p>
            {nextDate && nextDate.getTime() > Date.now() ? (
              <>
                <p className="text-white/40 text-xs uppercase tracking-widest text-center">
                  {nextTitle || "Next Event"}
                </p>
                {/* Countdown */}
                <div className="grid grid-cols-4 gap-3 mt-2">
                  {[{ v: countdown.days, l: "Days" }, { v: countdown.hours, l: "Hrs" }, { v: countdown.minutes, l: "Min" }, { v: countdown.seconds, l: "Sec" }].map(({ v, l }) => (
                    <div key={l} className="flex flex-col items-center">
                      <span className="font-['Anton'] text-3xl text-red-500">{String(v).padStart(2, "0")}</span>
                      <span className="text-white/30 text-xs uppercase tracking-widest">{l}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-white/30 text-xs text-center">
                No event scheduled yet. Follow us on Instagram for updates.
              </p>
            )}
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
              className="mt-2 text-xs border border-white/20 text-white/40 hover:border-red-600 hover:text-red-400 px-4 py-2 uppercase tracking-widest transition-colors">
              @murdermittenmedia
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spin Wheel ────────────────────────────────────────────────
interface WheelEntry {
  id: number;
  artistName: string;
  songTitle: string;
  songUrl: string | null;
  status: string;
  userId?: number | null;
  contactInfo?: string | null;
  paid?: boolean;
  paymentConfirmed?: boolean;
  wheelPosition?: number;
  roundNumber?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const WHEEL_COLORS = [
  "#D10000", "#8B0000", "#B22222", "#C41E3A",
  "#FF4444", "#990000", "#CC0000", "#E60000",
];

function SpinWheel({
  entries,
  isSpinning,
  winner,
  winnerLabel,
  onSpin,
  isAdmin,
  onSpinComplete,
  spinCount,
}: {
  entries: WheelEntry[];
  isSpinning: boolean;
  winner: string | null;
  winnerLabel?: string;
  onSpin: () => void;
  isAdmin: boolean;
  onSpinComplete?: (winnerName: string) => void;
  spinCount?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(0);
  const spinningRef = useRef(false);

  // Determine which entry the pointer (at top, angle = -PI/2 in canvas coords) is pointing at
  const getWinnerFromRotation = useCallback((rot: number): string | null => {
    if (!entries.length) return null;
    const slice = (Math.PI * 2) / entries.length;
    // Pointer is at the top of the canvas (angle = -Math.PI/2 from positive x-axis)
    // Normalize the pointer angle relative to the wheel rotation
    const pointerAngle = -Math.PI / 2;
    // Find which slice the pointer falls in
    // Each slice i starts at rot + i * slice and ends at rot + (i+1) * slice
    // Normalize to [0, 2PI)
    const normalizeAngle = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normalizedPointer = normalizeAngle(pointerAngle - rot);
    const idx = Math.floor(normalizedPointer / slice) % entries.length;
    return entries[idx]?.artistName ?? null;
  }, [entries]);

  const draw = useCallback((rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sz = canvas.width;
    const cx = sz / 2, cy = sz / 2, r = sz / 2 - 8;
    ctx.clearRect(0, 0, sz, sz);

    if (!entries.length) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff33";
      ctx.font = "14px Anton, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No entries yet", cx, cy + 5);
      return;
    }

    const slice = (Math.PI * 2) / entries.length;
    entries.forEach((e, i) => {
      const s = rot + i * slice, end = s + slice;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, end); ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill();
      ctx.strokeStyle = "#080808"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + slice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.min(13, 110 / entries.length)}px DM Sans, sans-serif`;
      const label = e.artistName.length > 14 ? e.artistName.slice(0, 14) + ".." : e.artistName;
      ctx.fillText(label, r - 10, 4);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#080808"; ctx.fill();
    ctx.strokeStyle = "#D10000"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#D10000"; ctx.font = "bold 9px Anton, sans-serif";
    ctx.textAlign = "center"; ctx.fillText("SPIN", cx, cy + 3);

    // Pointer (at top center)
    ctx.beginPath(); ctx.moveTo(cx - 9, 3); ctx.lineTo(cx + 9, 3); ctx.lineTo(cx, 26); ctx.closePath();
    ctx.fillStyle = "#fff"; ctx.fill();
  }, [entries]);

  useEffect(() => { draw(rotRef.current); }, [entries, draw]);

  useEffect(() => {
    if (!isSpinning || spinningRef.current) return;
    spinningRef.current = true;
    velRef.current = 0.22 + Math.random() * 0.18;
    const animate = () => {
      rotRef.current += velRef.current;
      velRef.current *= 0.9925;
      draw(rotRef.current);
      if (velRef.current > 0.003) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        spinningRef.current = false;
        // Determine winner from actual final rotation position
        const winnerName = getWinnerFromRotation(rotRef.current);
        if (winnerName && onSpinComplete) {
          onSpinComplete(winnerName);
        }
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpinning, draw, getWinnerFromRotation, onSpinComplete]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef} width={300} height={300}
        className="rounded-full shadow-[0_0_40px_rgba(209,0,0,0.3)]"
      />
      {winner && (
        <div className="text-center">
          <div className="text-xs text-red-400 uppercase tracking-widest mb-1">{winnerLabel ?? "Selected"}</div>
          <div className="font-['Anton'] text-2xl text-white animate-pulse">{winner}</div>
        </div>
      )}
      {isAdmin && (
        <>
          {entries.length === 0 ? (
            <p className="text-white/40 text-xs uppercase tracking-widest text-center">
              All contestants have been picked.
            </p>
          ) : (
            <button
              onClick={onSpin}
              disabled={isSpinning || (entries.length < 2 && (spinCount ?? 0) === 0)}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 font-['Anton'] text-base uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.5)]"
            >
              {isSpinning
                ? "Spinning..."
                : entries.length === 1 && (spinCount ?? 0) === 1
                ? "SPIN FOR CONTESTANT 2"
                : "SPIN THE WHEEL"}
            </button>
          )}
        </>
      )}
      {!isAdmin && (
        <p className="text-white/30 text-xs uppercase tracking-widest">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} on the wheel
        </p>
      )}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────
function ChatPanel({
  messages, isConnected, onSend, username,
}: {
  messages: Array<{ id: number; username: string; message: string; isAdmin: boolean; createdAt: Date }>;
  isConnected: boolean;
  onSend: (msg: string) => void;
  username: string;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col bg-[#0d0d0d] border border-white/10" style={{ height: "380px" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <span className="font-['Anton'] text-sm uppercase tracking-widest">Live Chat</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-white/40">{isConnected ? "Live" : "Connecting..."}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-white/30 text-xs text-center py-8">No messages yet. Be the first!</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-2 text-sm flex-wrap">
            <span className={`font-semibold flex-shrink-0 ${msg.isAdmin ? "text-red-400" : "text-white/70"}`}>
              {msg.isAdmin && "[ADMIN] "}
              <ArtistStatModal artistName={msg.username}>
                <button className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</button>
              </ArtistStatModal>:
            </span>
            <span className="text-white/80 break-words min-w-0">{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={username ? "Type a message..." : "Login to chat"}
          disabled={!username} maxLength={500}
          className="flex-1 bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30 disabled:opacity-40"
        />
        <button
          onClick={send} disabled={!username || !input.trim()}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Audio Room Panel ─────────────────────────────────────────
function AudioRoomPanel({
  participants, micActive, isConnected, error, role,
  onToggleMic, onActivateContestant, onKick, isJoined, onJoin, onLeave,
}: {
  participants: AudioParticipant[];
  micActive: boolean;
  isConnected: boolean;
  error: string | null;
  role: string;
  onToggleMic: () => void;
  onActivateContestant: (socketId: string, active: boolean) => void;
  onKick: (socketId: string) => void;
  isJoined: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const roleColor: Record<string, string> = {
    admin: "text-red-400", judge: "text-yellow-400",
    contestant: "text-blue-400", viewer: "text-white/30",
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-['Anton'] text-sm uppercase tracking-widest">Audio Room</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
          <span className="text-xs text-white/40">{participants.length} in room</span>
        </div>
      </div>
      {error && <div className="bg-red-900/30 border border-red-600/30 text-red-400 text-xs p-2 mb-3">Mic: {error}</div>}
      {!isJoined ? (
        <button onClick={onJoin} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors">
          Join Audio Room
        </button>
      ) : (
        <>
          <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
            {participants.length === 0 && <p className="text-white/30 text-xs text-center py-3">No one in the room</p>}
            {participants.map(p => (
              <div key={p.socketId} className="flex items-center justify-between py-1.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase ${roleColor[p.role] || "text-white/30"}`}>[{p.role.slice(0, 4)}]</span>
                  <span className="text-sm text-white/80">{p.username}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${p.micActive ? "text-green-400" : "text-white/20"}`}>
                    {p.micActive ? "ON" : "off"}
                  </span>
                  {(role === "admin" || role === "judge") && p.role === "contestant" && (
                    <button
                      onClick={() => onActivateContestant(p.socketId, !p.micActive)}
                      className={`text-xs px-2 py-0.5 border transition-colors ${p.micActive ? "border-red-600/50 text-red-400 hover:bg-red-600/20" : "border-green-600/50 text-green-400 hover:bg-green-600/20"}`}
                    >
                      {p.micActive ? "Mute" : "Unmute"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onToggleMic}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors ${micActive ? "border-green-600 text-green-400 hover:bg-green-600/20" : "border-white/20 text-white/40 hover:border-green-600 hover:text-green-400"}`}
            >
              {micActive ? "Mic On" : "Mic Off"}
            </button>
            <button onClick={onLeave} className="flex-1 py-2 text-xs font-semibold uppercase tracking-wider border border-white/20 text-white/40 hover:border-red-600 hover:text-red-400 transition-colors">
              Leave
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Submission Form ──────────────────────────────────────────
function SubmissionForm({
  isPaid, entryFee, isOpen, onSubmit, isLoading, success, requiresPayment, user,
}: {
  isPaid: boolean; entryFee: string; isOpen: boolean;
  onSubmit: (d: { songTitle: string; songUrl: string; contactInfo: string; mp3Url?: string }) => void;
  isLoading: boolean; success: boolean; requiresPayment: boolean;
  user?: { artistName?: string | null; name?: string | null } | null;
}) {
  const [songTitle, setSongTitle] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [mp3File, setMp3File] = useState<File | null>(null);
  const [mp3Uploading, setMp3Uploading] = useState(false);
  const [mp3Url, setMp3Url] = useState("");
  const uploadSongMutation = trpc.songs.uploadAudio.useMutation();
  const displayName = user?.artistName || user?.name || "Unknown Artist";

  const handleMp3Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15_000_000) { alert("File must be under 15MB"); return; }
    setMp3File(file);
    setMp3Uploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        const result = await uploadSongMutation.mutateAsync({
          title: songTitle || file.name.replace(/\.mp3$/i, ""),
          artistName: displayName,
          fileName: file.name,
          fileBase64: base64,
          mimeType: "audio/mpeg",
          isPublic: true,
        });
        setMp3Url(result.url);
        setMp3Uploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setMp3Uploading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="bg-[#0d0d0d] border border-white/10 p-6 text-center">
        <div className="text-red-500 font-['Anton'] text-xl mb-1">SUBMISSIONS CLOSED</div>
        <p className="text-white/40 text-sm">Check back when the next battle opens.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-[#0d0d0d] border border-green-600/30 p-5 text-center">
        <div className="text-green-400 font-['Anton'] text-xl mb-2">SUBMITTED!</div>
        {requiresPayment ? (
          <div className="text-white/60 text-sm space-y-2">
            <p>Your entry is pending payment confirmation.</p>
            <p className="text-red-400 font-semibold">Send ${entryFee} to get on the wheel:</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div className="border border-white/10 p-2"><div className="text-white/40 mb-0.5">CashApp</div><div className="text-white font-semibold">$joyfuljules</div></div>
              <div className="border border-white/10 p-2"><div className="text-white/40 mb-0.5">PayPal</div><div className="text-white font-semibold">MurderMittenPromo</div></div>
            </div>
            <p className="text-white/30 text-xs mt-1">Include your artist name in the note.</p>
          </div>
        ) : (
          <p className="text-white/60 text-sm">You are on the wheel! Watch the stream.</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Anton'] text-sm uppercase tracking-widest">Enter the Battle</h3>
        <span className={`text-xs border px-2 py-0.5 uppercase tracking-wider ${isPaid ? "border-red-600/50 text-red-400" : "border-green-600/50 text-green-400"}`}>
          {isPaid ? `$${entryFee} Entry` : "Free Entry"}
        </span>
      </div>
      <form onSubmit={e => { e.preventDefault(); onSubmit({ songTitle, songUrl: mp3Url || songUrl, contactInfo, mp3Url: mp3Url || undefined }); }} className="space-y-3">
        {/* Artist name auto-filled from registered profile */}
        <div className="bg-white/5 border border-white/10 px-3 py-2.5">
          <div className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Submitting as</div>
          <div className="text-white font-semibold text-sm">{displayName}</div>
        </div>
        <input type="text" placeholder="Song Title *" value={songTitle} onChange={e => setSongTitle(e.target.value)} required maxLength={128}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        <input type="url" placeholder="YouTube / SoundCloud link (optional)" value={songUrl} onChange={e => setSongUrl(e.target.value)}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        {/* MP3 upload */}
        <div>
          <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Or Upload MP3 File (max 15MB)</label>
          <label className={`flex items-center gap-3 border ${mp3File ? "border-green-600/50 bg-green-900/10" : "border-white/10 bg-white/5"} px-3 py-2.5 cursor-pointer hover:border-red-600/30 transition-colors`}>
            <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-sm text-white/50 truncate flex-1">
              {mp3Uploading ? "Uploading..." : mp3File ? mp3File.name : "Choose .mp3 or .wav file"}
            </span>
            {mp3Url && <span className="text-green-400 text-xs flex-shrink-0">✓ Ready</span>}
            <input type="file" accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav" className="hidden" onChange={handleMp3Change} />
          </label>
        </div>
        <input type="text" placeholder="Email or Instagram handle (optional)" value={contactInfo} onChange={e => setContactInfo(e.target.value)} maxLength={256}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        {isPaid && (
          <div className="bg-red-900/20 border border-red-600/20 p-3 text-xs text-white/60">
            <span className="text-red-400 font-semibold">Paid entry: </span>
            After submitting, send ${entryFee} to CashApp <span className="text-white">$joyfuljules</span> or PayPal <span className="text-white">MurderMittenPromo</span> with your artist name.
          </div>
        )}
        <button type="submit" disabled={isLoading || mp3Uploading || !songTitle.trim()}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 font-['Anton'] uppercase tracking-widest transition-all">
          {mp3Uploading ? "Uploading MP3..." : isLoading ? "Submitting..." : isPaid ? `Submit ($${entryFee})` : "Submit Free Entry"}
        </button>
      </form>
    </div>
  );
}

// ─── Record Battle Result (admin) ─────────────────────────────
function RecordBattleForm({
  entries, onRecord,
}: {
  entries: Array<{ id: number; artistName: string; songTitle: string; songUrl?: string | null; userId?: number | null }>;
  onRecord: () => void;
}) {
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [notes, setNotes] = useState("");
  const [round, setRound] = useState("1");
  const recordMutation = trpc.battles.record.useMutation({ onSuccess: onRecord });

  const handleRecord = async () => {
    const winner = entries.find(e => String(e.id) === winnerId);
    const loser = entries.find(e => String(e.id) === loserId);
    if (!winner || !loser || winner.id === loser.id) return;
    await recordMutation.mutateAsync({
      roundNumber: parseInt(round) || 1,
      winnerArtistName: winner.artistName,
      winnerSongTitle: winner.songTitle,
      winnerSongUrl: winner.songUrl ?? undefined,
      winnerId: winner.userId ?? undefined,
      loserArtistName: loser.artistName,
      loserSongTitle: loser.songTitle,
      loserSongUrl: loser.songUrl ?? undefined,
      loserId: loser.userId ?? undefined,
      notes: notes || undefined,
    });
    setWinnerId(""); setLoserId(""); setNotes("");
  };

  return (
    <div className="bg-[#0d0d0d] border border-yellow-600/20 p-4 mt-3">
      <div className="text-xs text-yellow-400 uppercase tracking-widest font-semibold mb-3">Record Battle Result</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-white/40 mb-1 block">Winner</label>
          <select value={winnerId} onChange={e => setWinnerId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-white text-xs px-2 py-2 focus:outline-none">
            <option value="">Select winner...</option>
            {entries.map(e => <option key={e.id} value={String(e.id)}>{e.artistName} — {e.songTitle}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Loser</label>
          <select value={loserId} onChange={e => setLoserId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-white text-xs px-2 py-2 focus:outline-none">
            <option value="">Select loser...</option>
            {entries.map(e => <option key={e.id} value={String(e.id)}>{e.artistName} — {e.songTitle}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="number" placeholder="Round #" value={round} onChange={e => setRound(e.target.value)} min={1}
          className="bg-white/5 border border-white/10 text-white text-xs px-2 py-2 focus:outline-none" />
        <input type="text" placeholder="Judge notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
          className="bg-white/5 border border-white/10 text-white text-xs px-2 py-2 focus:outline-none placeholder-white/30" />
      </div>
      <button onClick={handleRecord} disabled={!winnerId || !loserId || recordMutation.isPending}
        className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white py-2 text-xs font-semibold uppercase tracking-wider transition-colors">
        {recordMutation.isPending ? "Saving..." : "Record Result"}
      </button>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────

// Helper: extract YouTube video ID from any YouTube URL format
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|watch\?v=)([\w-]{11})/);
  return match ? match[1] : null;
}

// Helper: check if a URL is a YouTube link
function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

// ─── Contestant Now Playing Card ──────────────────────────────
function ContestantNowPlayingCard({
  name, songTitle, songUrl, contestantNumber, color, userId, isAdmin, onLoadToRadio,
}: {
  name: string;
  songTitle?: string | null;
  songUrl?: string | null;
  contestantNumber: number;
  color: "green" | "red" | "yellow";
  userId?: number;
  isAdmin?: boolean;
  onLoadToRadio?: (contestantName: string, songTitle: string, songUrl: string, contestantNumber: number) => void;
}) {
  const borderColor = color === "green" ? "border-green-600/30" : color === "red" ? "border-red-600/30" : "border-yellow-600/30";
  const bgColor = color === "green" ? "bg-green-600/5" : color === "red" ? "bg-red-600/5" : "bg-yellow-600/5";
  const labelColor = color === "green" ? "text-green-400" : color === "red" ? "text-red-400" : "text-yellow-400";
  const badgeColor = color === "green" ? "border-green-600/40 text-green-500" : color === "red" ? "border-red-600/40 text-red-500" : "border-yellow-600/40 text-yellow-500";

  const ytId = songUrl && isYouTubeUrl(songUrl) ? extractYouTubeId(songUrl) : null;
  const isAudioFile = songUrl && !isYouTubeUrl(songUrl);

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] uppercase tracking-widest font-bold border px-1.5 py-0.5 ${badgeColor}`}>
            C{contestantNumber}
          </span>
          {isAdmin && songUrl && onLoadToRadio && (
            <button
              onClick={() => onLoadToRadio(name, songTitle ?? name, songUrl, contestantNumber)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 px-2 py-0.5 transition-colors"
            >
              <Play className="w-2.5 h-2.5" /> Load
            </button>
          )}
        </div>
        {/* Artist name — clickable to profile */}
        <div className={`font-['Anton'] text-sm uppercase leading-tight ${labelColor}`}>
          <ArtistLink artistName={name} userId={userId} className={labelColor} />
        </div>
        {songTitle && (
          <div className="text-white/50 text-[11px] mt-0.5 truncate">{songTitle}</div>
        )}
      </div>

      {/* Media: YouTube embed or audio play button */}
      {ytId ? (
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
            title={`${name} — ${songTitle ?? "Battle Track"}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      ) : isAudioFile ? (
        <div className="px-3 pb-3 flex items-center gap-2">
          <AudioPlayButton
            url={songUrl}
            title={songTitle ?? name}
            artist={name}
            artistUserId={userId}
            sourcePage="Music Wars"
            size="sm"
          />
          <span className="text-white/30 text-[10px] uppercase tracking-wider">Preview</span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Voting Panel ─────────────────────────────────────────────
function VotingPanel({
  activeBattle, voteResults, myVote, user, isJudge, isAdmin,
  onVote, onSetActiveBattle, onClearVotes, entries, onLoadToRadio,
  tripleTheatMode, onToggleTripleThreat,
}: {
  activeBattle: { id: number; contestant1Name: string; contestant1SongTitle?: string | null; contestant1SongUrl?: string | null; contestant2Name: string; contestant2SongTitle?: string | null; contestant2SongUrl?: string | null; contestant3Name?: string | null; contestant3SongTitle?: string | null; contestant3SongUrl?: string | null; isTripleThreat?: boolean | null } | null | undefined;
  voteResults: { contestant1: number; contestant2: number; contestant3?: number; total: number; judgeVotes: Array<{ name: string; role: string; candidate: string }>; audienceContestant1: number; audienceContestant2: number; audienceContestant3?: number; } | null | undefined;
  myVote: { candidate: string } | null | undefined;
  user: { id: number; name: string; role: string } | null | undefined;
  isJudge: boolean; isAdmin: boolean;
  onVote: (candidate: "contestant1" | "contestant2" | "contestant3") => void;
  onSetActiveBattle: (c1: string, c2: string, c3?: string, isTriple?: boolean) => void;
  onClearVotes: () => void;
  entries: Array<{ id: number; artistName: string; status: string; userId?: number | null }>;
  onLoadToRadio?: (contestantName: string, songTitle: string, songUrl: string, contestantNumber: number) => void;
  tripleTheatMode?: boolean;
  onToggleTripleThreat?: () => void;
}) {
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const activeEntries = entries.filter(e => e.status === "active");
  const isTriple = !!(activeBattle?.isTripleThreat && activeBattle?.contestant3Name);
  const total = (voteResults?.contestant1 ?? 0) + (voteResults?.contestant2 ?? 0) + (isTriple ? (voteResults?.contestant3 ?? 0) : 0);
  const c1Pct = total > 0 ? Math.round(((voteResults?.contestant1 ?? 0) / total) * 100) : isTriple ? 33 : 50;
  const c2Pct = total > 0 ? Math.round(((voteResults?.contestant2 ?? 0) / total) * 100) : isTriple ? 33 : 50;
  const c3Pct = isTriple ? (100 - c1Pct - c2Pct) : 0;

  // Look up userId from entries list for profile linking
  const getUserId = (name: string) => entries.find(e => e.artistName === name)?.userId ?? undefined;

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      <h3 className="font-['Anton'] text-sm uppercase tracking-widest mb-3">
        Live <span className="text-red-600">Vote</span>
      </h3>

      {/* Admin: battle setup controls */}
      {isAdmin && (
        <div className="mb-4 p-3 border border-red-600/20 bg-red-900/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-red-400 uppercase tracking-widest font-semibold">Set Active Battle</div>
            {/* Triple Threat toggle — co-located with battle setup */}
            <button
              onClick={onToggleTripleThreat}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-widest font-bold border transition-all duration-200 ${
                tripleTheatMode ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-white/20 text-white/40 hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3" />
              Triple Threat {tripleTheatMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className={`grid gap-2 ${tripleTheatMode ? "grid-cols-3" : "grid-cols-2"}`}>
            <select value={c1} onChange={e => setC1(e.target.value)}
              className="bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 focus:outline-none">
              <option value="">Contestant 1...</option>
              {activeEntries.map(e => <option key={e.id} value={e.artistName}>{e.artistName}</option>)}
            </select>
            <select value={c2} onChange={e => setC2(e.target.value)}
              className="bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 focus:outline-none">
              <option value="">Contestant 2...</option>
              {activeEntries.map(e => <option key={e.id} value={e.artistName}>{e.artistName}</option>)}
            </select>
            {tripleTheatMode && (
              <select value={c3} onChange={e => setC3(e.target.value)}
                className="bg-white/5 border border-yellow-600/30 text-yellow-300 text-xs px-2 py-1.5 focus:outline-none">
                <option value="">Contestant 3...</option>
                {activeEntries.map(e => <option key={e.id} value={e.artistName}>{e.artistName}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const valid = tripleTheatMode ? (c1 && c2 && c3 && c1 !== c2 && c1 !== c3 && c2 !== c3) : (c1 && c2 && c1 !== c2);
                if (valid) onSetActiveBattle(c1, c2, tripleTheatMode ? c3 : undefined, tripleTheatMode);
              }}
              disabled={tripleTheatMode ? (!c1 || !c2 || !c3 || c1 === c2 || c1 === c3 || c2 === c3) : (!c1 || !c2 || c1 === c2)}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors">
              Start Voting
            </button>
            <button onClick={onClearVotes}
              className="border border-white/20 text-white/50 hover:border-white/40 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      {activeBattle ? (
        <div>
          {/* Now Playing cards — one per contestant */}
          <div className={`grid gap-3 mb-4 ${isTriple ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            <ContestantNowPlayingCard
              name={activeBattle.contestant1Name}
              songTitle={activeBattle.contestant1SongTitle}
              songUrl={activeBattle.contestant1SongUrl}
              contestantNumber={1}
              color="green"
              userId={getUserId(activeBattle.contestant1Name)}
              isAdmin={isAdmin}
              onLoadToRadio={onLoadToRadio}
            />
            <ContestantNowPlayingCard
              name={activeBattle.contestant2Name}
              songTitle={activeBattle.contestant2SongTitle}
              songUrl={activeBattle.contestant2SongUrl}
              contestantNumber={2}
              color="red"
              userId={getUserId(activeBattle.contestant2Name)}
              isAdmin={isAdmin}
              onLoadToRadio={onLoadToRadio}
            />
            {isTriple && activeBattle.contestant3Name && (
              <ContestantNowPlayingCard
                name={activeBattle.contestant3Name}
                songTitle={activeBattle.contestant3SongTitle}
                songUrl={activeBattle.contestant3SongUrl}
                contestantNumber={3}
                color="yellow"
                userId={getUserId(activeBattle.contestant3Name)}
                isAdmin={isAdmin}
                onLoadToRadio={onLoadToRadio}
              />
            )}
          </div>

          {/* Vote buttons */}
          {user && !myVote && (
            <div className={`grid gap-3 mb-4 ${isTriple ? "grid-cols-3" : "grid-cols-2"}`}>
              <button onClick={() => onVote("contestant1")}
                className="py-3 border border-green-600/50 text-green-400 hover:bg-green-600/20 font-['Anton'] uppercase tracking-wide text-sm transition-colors">
                {activeBattle.contestant1Name}
              </button>
              <button onClick={() => onVote("contestant2")}
                className="py-3 border border-red-600/50 text-red-400 hover:bg-red-600/20 font-['Anton'] uppercase tracking-wide text-sm transition-colors">
                {activeBattle.contestant2Name}
              </button>
              {isTriple && activeBattle.contestant3Name && (
                <button onClick={() => onVote("contestant3")}
                  className="py-3 border border-yellow-600/50 text-yellow-400 hover:bg-yellow-600/20 font-['Anton'] uppercase tracking-wide text-sm transition-colors">
                  {activeBattle.contestant3Name}
                </button>
              )}
            </div>
          )}
          {myVote && (
            <div className="text-center text-xs text-white/40 mb-4">
              You voted: <span className="text-white font-semibold">
                {myVote.candidate === "contestant1" ? activeBattle.contestant1Name
                  : myVote.candidate === "contestant2" ? activeBattle.contestant2Name
                  : activeBattle.contestant3Name ?? myVote.candidate}
              </span>
            </div>
          )}
          {!user && (
            <p className="text-white/30 text-xs text-center mb-4">Login to vote</p>
          )}

          {/* Live tally */}
          <div className="space-y-2 mb-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white font-semibold">{activeBattle.contestant1Name}</span>
                <span className="text-white/60">{voteResults?.contestant1 ?? 0} votes ({c1Pct}%)</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${c1Pct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white font-semibold">{activeBattle.contestant2Name}</span>
                <span className="text-white/60">{voteResults?.contestant2 ?? 0} votes ({c2Pct}%)</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${c2Pct}%` }} />
              </div>
            </div>
            {isTriple && activeBattle.contestant3Name && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white font-semibold">{activeBattle.contestant3Name}</span>
                  <span className="text-white/60">{voteResults?.contestant3 ?? 0} votes ({c3Pct}%)</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${c3Pct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Judge votes — visible to all viewers */}
          {voteResults?.judgeVotes && voteResults.judgeVotes.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Judge Votes</p>
              <div className="space-y-1">
                {voteResults.judgeVotes.map((jv: { name: string; role: string; candidate: string }, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="border border-yellow-600/50 text-yellow-400 px-1.5 py-0.5 text-[10px] uppercase tracking-wider flex-shrink-0">JUDGE</span>
                    <span className="text-white/60">{jv.name}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white font-semibold">
                      {jv.candidate === "contestant1" ? activeBattle?.contestant1Name
                        : jv.candidate === "contestant2" ? activeBattle?.contestant2Name
                        : activeBattle?.contestant3Name ?? jv.candidate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-white/30 text-xs text-center py-4">No active battle. Admin will start voting when ready.</p>
      )}
    </div>
  );
}

function AdminPanel({
  entries, onConfirmPayment, onUpdateStatus, onTogglePaid, onToggleOpen,
  isPaid, isOpen, isUpdating, onRecord, onRemoveEntry, onResetWar,
}: {
  entries: Array<{ id: number; artistName: string; songTitle: string; paid: boolean; paymentConfirmed: boolean; status: string; songUrl?: string | null; userId?: number | null }>;
  onConfirmPayment: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onTogglePaid: () => void;
  onToggleOpen: () => void;
  isPaid: boolean; isOpen: boolean; isUpdating: boolean;
  onRecord: () => void;
  onRemoveEntry: (id: number) => void;
  onResetWar: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="bg-[#0d0d0d] border border-red-600/20 p-5">
      <h3 className="font-['Anton'] text-sm uppercase tracking-widest text-red-400 mb-4">Admin Controls</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={onTogglePaid} disabled={isUpdating}
          className={`py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${isPaid ? "border-red-600 text-red-400 bg-red-600/10" : "border-green-600 text-green-400 bg-green-600/10"}`}>
          Mode: {isPaid ? "Paid ($)" : "Free"}
        </button>
        <button onClick={onToggleOpen} disabled={isUpdating}
          className={`py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${isOpen ? "border-green-600 text-green-400 bg-green-600/10" : "border-red-600 text-red-400 bg-red-600/10"}`}>
          {isOpen ? "Open" : "Closed"}
        </button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto mb-2">
        {entries.length === 0 && <p className="text-white/30 text-xs text-center py-3">No entries yet</p>}
        {entries.map(entry => (
          <div key={entry.id} className="flex items-center gap-2 py-2 border-b border-white/5 text-xs">
            <div className="flex-1 min-w-0">
              <div className="text-white/80 font-semibold truncate">
                <ArtistStatModal artistName={entry.artistName} userId={entry.userId ?? undefined}>
                  <button className="hover:text-red-400 transition-colors">{entry.artistName}</button>
                </ArtistStatModal>
              </div>
              <div className="text-white/40 truncate">{entry.songTitle}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {entry.paid && !entry.paymentConfirmed && (
                <button onClick={() => onConfirmPayment(entry.id)} className="border border-yellow-600/50 text-yellow-400 px-2 py-1 hover:bg-yellow-600/20 transition-colors">Confirm $</button>
              )}
              {entry.status === "pending" && (
                <button onClick={() => onUpdateStatus(entry.id, "active")} className="border border-green-600/50 text-green-400 px-2 py-1 hover:bg-green-600/20 transition-colors">Activate</button>
              )}
              {entry.status === "active" && (
                <button onClick={() => onUpdateStatus(entry.id, "eliminated")} className="border border-red-600/50 text-red-400 px-2 py-1 hover:bg-red-600/20 transition-colors">Eliminate</button>
              )}
              <span className={`px-1.5 py-0.5 text-xs uppercase ${entry.status === "active" ? "text-green-400" : entry.status === "winner" ? "text-yellow-400" : entry.status === "eliminated" ? "text-red-400" : "text-white/30"}`}>
                {entry.status}
              </span>
              {/* Remove from wheel */}
              <button
                onClick={() => onRemoveEntry(entry.id)}
                className="text-white/20 hover:text-red-500 transition-colors ml-1"
                title="Remove from wheel"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <RecordBattleForm entries={entries} onRecord={onRecord} />
      {/* Reset current war */}
      <div className="mt-4 pt-4 border-t border-white/10">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)}
            className="w-full border border-orange-600/40 text-orange-400 hover:bg-orange-600/10 py-2 text-xs font-semibold uppercase tracking-wider transition-colors">
            Reset Current War
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-orange-400 text-center">This clears all wheel entries and current votes. Battle records are kept.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmReset(false)}
                className="border border-white/20 text-white/50 py-2 text-xs uppercase tracking-wider transition-colors hover:border-white/40">
                Cancel
              </button>
              <button onClick={() => { onResetWar(); setConfirmReset(false); }}
                className="bg-orange-600 hover:bg-orange-700 text-white py-2 text-xs font-semibold uppercase tracking-wider transition-colors">
                Confirm Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────
function Leaderboard() {
  const { data: lb } = trpc.battles.leaderboard.useQuery();
  if (!lb || lb.length === 0) return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      <h3 className="font-['Anton'] text-sm uppercase tracking-widest mb-3">Leaderboard</h3>
      <p className="text-white/30 text-xs text-center py-4">No battles recorded yet. First battle coming soon!</p>
    </div>
  );

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      <h3 className="font-['Anton'] text-sm uppercase tracking-widest mb-3">
        Battle <span className="text-red-600">Leaderboard</span>
      </h3>
      <div className="space-y-2">
        {lb.slice(0, 10).map((entry, i) => (
          <div key={entry.artistName} className="flex items-center gap-3 py-2 border-b border-white/5">
            <span className={`font-['Anton'] text-lg w-6 text-center flex-shrink-0 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-white/60" : i === 2 ? "text-orange-400" : "text-white/30"}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <ArtistStatModal artistName={entry.artistName} userId={entry.userId ?? undefined}>
                <button className="text-sm font-semibold text-white hover:text-red-400 transition-colors text-left">{entry.artistName}</button>
              </ArtistStatModal>
              {entry.latestWinSong && (
                <div className="text-white/30 text-xs truncate mt-0.5">
                  {entry.latestWinSongUrl ? (
                    <a href={entry.latestWinSongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">
                      🎵 {entry.latestWinSong}
                    </a>
                  ) : (
                    <span>🎵 {entry.latestWinSong}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs flex-shrink-0">
              <span className="text-green-400 font-bold">{entry.wins}W</span>
              <span className="text-red-400">{entry.losses}L</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Past Battles ───────────────────────────────────────────
function PastBattles() {
  const { data: records, isLoading } = trpc.battles.getAll.useQuery();

  return (
    <div className="bg-[#0d0d0d] border border-white/10 p-5">
      <h3 className="font-['Anton'] text-xl uppercase tracking-widest mb-4">
        Past <span className="text-red-600">Battles</span>
      </h3>

      {isLoading && (
        <div className="text-white/30 text-xs text-center py-6">Loading battle history...</div>
      )}

      {!isLoading && (!records || records.length === 0) && (
        <div className="text-center py-8">
          <div className="text-white/20 text-4xl mb-3">🥊</div>
          <p className="text-white/40 text-sm">No battles recorded yet.</p>
          <p className="text-white/20 text-xs mt-1">Results are logged by the admin after each live battle.</p>
        </div>
      )}

      {records && records.length > 0 && (
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {records.map(r => (
            <div key={r.id} className="border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-colors">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/30 uppercase tracking-widest">Round {r.roundNumber}</span>
                <span className="text-xs text-white/20">{new Date(r.battleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>

              {/* Battle matchup */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                {/* Winner */}
                <div className="text-center">
                  <div className="text-xs text-green-500 uppercase tracking-widest font-bold mb-1">Winner 🏆</div>
                  <ArtistStatModal artistName={r.winnerArtistName} userId={r.winnerId ?? undefined}>
                    <button className="font-['Anton'] text-base text-white hover:text-green-400 transition-colors">{r.winnerArtistName}</button>
                  </ArtistStatModal>
                  {r.winnerSongTitle && (
                    <div className="text-xs text-white/30 mt-1 truncate">
                      {r.winnerSongUrl ? (
                        <a href={r.winnerSongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">
                          🎵 {r.winnerSongTitle}
                        </a>
                      ) : (
                        <span>🎵 {r.winnerSongTitle}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* VS divider */}
                <div className="font-['Anton'] text-red-600 text-lg">VS</div>

                {/* Loser */}
                <div className="text-center">
                  <div className="text-xs text-red-400/70 uppercase tracking-widest font-bold mb-1">Eliminated</div>
                  <ArtistStatModal artistName={r.loserArtistName} userId={r.loserId ?? undefined}>
                    <button className="font-['Anton'] text-base text-white/60 hover:text-red-400 transition-colors">{r.loserArtistName}</button>
                  </ArtistStatModal>
                  {r.loserSongTitle && (
                    <div className="text-xs text-white/20 mt-1 truncate">
                      {r.loserSongUrl ? (
                        <a href={r.loserSongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">
                          🎵 {r.loserSongTitle}
                        </a>
                      ) : (
                        <span>🎵 {r.loserSongTitle}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {r.notes && (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/30 italic">"{r.notes}"</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function MusicWars() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isJudge = user?.role === "judge";
  const isContestant = user?.role === "contestant";
  const username = user?.artistName || user?.name || "Guest";
  const audioRole = isAdmin ? "admin" : isJudge ? "judge" : isContestant ? "contestant" : "user";

   const { data: wheelData, refetch: refetchWheel } = trpc.wheel.getEntries.useQuery();
  const { data: allEntries, refetch: refetchAllEntries } = trpc.wheel.getAllEntries.useQuery(undefined, { enabled: isAdmin });
  const { data: chatHistory } = trpc.chat.getHistory.useQuery({ room: "music_wars" });
  const { data: eventData, refetch: refetchEvent } = trpc.events.getNext.useQuery();
  const { data: activeBattle, refetch: refetchActiveBattle } = trpc.voting.getActiveBattle.useQuery();
  const { data: voteResults, refetch: refetchVotes } = trpc.voting.getResults.useQuery(
    { battleId: activeBattle?.id ?? 0 },
    { enabled: !!activeBattle?.id, refetchInterval: 3000 }
  );
  const { data: myVote } = trpc.voting.getMyVote.useQuery(
    { battleId: activeBattle?.id ?? 0 },
    { enabled: !!activeBattle?.id && !!user }
  );
  const castVoteMutation = trpc.voting.cast.useMutation({ onSuccess: () => { refetchVotes(); } });
  const setActiveBattleMutation = trpc.voting.setActiveBattle.useMutation({ onSuccess: () => { refetchActiveBattle(); refetchVotes(); } });
  const clearVotesMutation = trpc.voting.clearVotes.useMutation({ onSuccess: () => refetchVotes() });
  const setEventMutation = trpc.events.setNext.useMutation({ onSuccess: () => refetchEvent() });
  const setLiveMutation = trpc.events.setLive.useMutation({ onSuccess: () => refetchEvent() });
  const submitMutation = trpc.wheel.submit.useMutation();
  const updateStatusMutation = trpc.wheel.updateStatus.useMutation();
  const confirmPaymentMutation = trpc.wheel.confirmPayment.useMutation();
  const setSettingsMutation = trpc.wheel.setSettings.useMutation();
  const removeEntryMutation = trpc.wheel.removeEntry.useMutation();
  const resetWarMutation = trpc.wheel.resetCurrentWar.useMutation();
  const markCalledMutation = trpc.wheel.markCalled.useMutation();
  const markCalledAndSaveStateMutation = trpc.wheel.markCalledAndSaveState.useMutation();
  const saveSpinStateMutation = trpc.wheel.saveSpinState.useMutation();
  const resetSpinStateMutation = trpc.wheel.resetSpinState.useMutation();
  const setBattleContestantsMutation = trpc.wheel.setBattleContestants.useMutation({
    onSuccess: () => { refetchActiveBattle(); refetchVotes(); refetchWheel(); if (isAdmin) refetchAllEntries(); },
  });

  // Persistent wheel spin state — loaded from DB on mount, synced via socket
  const { data: persistedSpinState, refetch: refetchSpinState } = trpc.wheel.getSpinState.useQuery();
  const [spinCount, setSpinCount] = useState<0 | 1 | 2>(0);
  const [contestant1Entry, setContestant1Entry] = useState<WheelEntry | null>(null);
  const [contestant2Entry, setContestant2Entry] = useState<WheelEntry | null>(null);

  // Helper to restore contestant1 from entry list
  const restoreContestant1 = useCallback((id: number, name: string, entries: WheelEntry[]) => {
    const found = entries.find(e => e.id === id);
    if (found) setContestant1Entry(found);
    else setContestant1Entry({ id, artistName: name, songTitle: "", status: "eliminated", wheelPosition: 0, roundNumber: 1, createdAt: new Date(), updatedAt: new Date(), userId: null, songUrl: null, contactInfo: null, paid: false, paymentConfirmed: false } as WheelEntry);
  }, []);

  // Hydrate spin state from DB on load
  useEffect(() => {
    if (!persistedSpinState) return;
    setSpinCount(persistedSpinState.spinCount as 0 | 1 | 2);
    if (persistedSpinState.spinCount >= 1 && persistedSpinState.contestant1Id) {
      restoreContestant1(persistedSpinState.contestant1Id, persistedSpinState.contestant1Name ?? "", wheelData?.entries ?? []);
    } else {
      setContestant1Entry(null);
    }
  }, [persistedSpinState, wheelData?.entries, restoreContestant1]);

  const { messages, isConnected: chatConnected, sendMessage, wheelWinner, wheelSpinning, broadcastSpin, broadcastWinner, socket: chatSocket } = useChat({
    room: "music_wars",
    username,
    userId: user?.id,
    isAdmin,
    initialMessages: (chatHistory || []).map(m => ({
      id: m.id, username: m.username, message: m.message,
      room: m.room, isAdmin: m.isAdmin, createdAt: new Date(m.createdAt),
    })),
    onSpinStateChange: (state) => {
      setSpinCount(state.spinCount);
      if (state.spinCount === 1 && state.contestant1Id) {
        restoreContestant1(state.contestant1Id, state.contestant1Name ?? "", wheelData?.entries ?? []);
      } else {
        setContestant1Entry(null);
      }
    },
  });

  // Refetch wheel and vote data when war is reset by admin
  useEffect(() => {
    if (!chatSocket) return;
    const handleWarReset = () => {
      refetchWheel();
      refetchActiveBattle();
      refetchVotes();
      refetchSpinState();
      if (isAdmin) refetchAllEntries();
      setSpinCount(0);
      setContestant1Entry(null);
      setContestant2Entry(null);
    };
    chatSocket.on("war:reset", handleWarReset);
    return () => { chatSocket.off("war:reset", handleWarReset); };
  }, [chatSocket, refetchWheel, refetchActiveBattle, refetchVotes, isAdmin, refetchAllEntries, refetchSpinState]);

  const [audioJoined, setAudioJoined] = useState(false);
  const { participants, micActive, isConnected: audioConnected, error: audioError, toggleMic, activateContestantMic, kickParticipant } = useAudioRoom({
    room: "music_wars", username, role: audioRole, userId: user?.id, enabled: audioJoined,
  });
  // ─── Wars Radio Feed ───────────────────────────────────────────────────
  const warsRadio = useWarsRadio({ enabled: true });
  const { state: warsRadioState, tripleTheatMode, loadTracks, adminPause, adminResume, adminSeek, adminSkip, adminStop, adminLastSong, setTripleTheat } = warsRadio;

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);

  const maxSpins = tripleTheatMode ? 3 : 2;

  const handleSpin = useCallback(() => {
    if (!isAdmin || !wheelData?.entries.length) return;
    // Only allow spinning if we haven't picked all contestants yet
    if (spinCount >= maxSpins) return;
    broadcastSpin();
  }, [isAdmin, wheelData, broadcastSpin, spinCount, maxSpins]);

  const handleSpinComplete = useCallback(async (winnerName: string) => {
    // Only the admin's wheel determines the result — broadcast to all clients
    if (!isAdmin) return;
    broadcastWinner(winnerName);

    // Find the entry by artist name in the current active entries
    const currentEntries = (wheelData?.entries ?? []).filter(e => e.status === "active");
    const entry = currentEntries.find(e => e.artistName === winnerName);
    if (!entry) return;

    if (spinCount === 0) {
      // First spin → Contestant 1
      setContestant1Entry(entry);
      setSpinCount(1);
      try {
        await markCalledAndSaveStateMutation.mutateAsync({ id: entry.id, artistName: entry.artistName });
      } catch {}
      refetchWheel();
      if (isAdmin) refetchAllEntries();
    } else if (spinCount === 1 && contestant1Entry) {
      if (tripleTheatMode) {
        // Second spin in Triple Threat → Contestant 2, wait for third spin
        setContestant2Entry(entry);
        setSpinCount(2);
        try {
          await markCalledAndSaveStateMutation.mutateAsync({ id: entry.id, artistName: entry.artistName });
        } catch {}
        refetchWheel();
        if (isAdmin) refetchAllEntries();
      } else {
        // Second spin in 1v1 → Contestant 2: set battle and clear spin state
        try {
          await setBattleContestantsMutation.mutateAsync({
            contestant1Id: contestant1Entry.id,
            contestant2Id: entry.id,
          });
          await resetSpinStateMutation.mutateAsync();
          const tracks: WarsRadioTrack[] = [];
          if (contestant1Entry.songUrl) tracks.push({ contestantName: contestant1Entry.artistName, songTitle: contestant1Entry.songTitle, songUrl: contestant1Entry.songUrl, contestantNumber: 1 });
          if (entry.songUrl) tracks.push({ contestantName: entry.artistName, songTitle: entry.songTitle, songUrl: entry.songUrl, contestantNumber: 2 });
          if (tracks.length > 0) loadTracks(tracks);
        } catch {}
        setSpinCount(0);
        setContestant1Entry(null);
        setContestant2Entry(null);
      }
    } else if (spinCount === 2 && contestant1Entry && contestant2Entry && tripleTheatMode) {
      // Third spin in Triple Threat → Contestant 3: set battle with all 3
      try {
        await setBattleContestantsMutation.mutateAsync({
          contestant1Id: contestant1Entry.id,
          contestant2Id: contestant2Entry.id,
          contestant3Id: entry.id,
          isTripleThreat: true,
        });
        await resetSpinStateMutation.mutateAsync();
        const tracks: WarsRadioTrack[] = [];
        if (contestant1Entry.songUrl) tracks.push({ contestantName: contestant1Entry.artistName, songTitle: contestant1Entry.songTitle, songUrl: contestant1Entry.songUrl, contestantNumber: 1 });
        if (contestant2Entry.songUrl) tracks.push({ contestantName: contestant2Entry.artistName, songTitle: contestant2Entry.songTitle, songUrl: contestant2Entry.songUrl, contestantNumber: 2 });
        if (entry.songUrl) tracks.push({ contestantName: entry.artistName, songTitle: entry.songTitle, songUrl: entry.songUrl, contestantNumber: 3 });
        if (tracks.length > 0) loadTracks(tracks);
      } catch {}
      setSpinCount(0);
      setContestant1Entry(null);
      setContestant2Entry(null);
    }
  }, [isAdmin, broadcastWinner, spinCount, wheelData, contestant1Entry, contestant2Entry, tripleTheatMode, markCalledAndSaveStateMutation, setBattleContestantsMutation, resetSpinStateMutation, refetchWheel, refetchAllEntries, loadTracks]);

  const handleSubmit = async (data: { songTitle: string; songUrl: string; contactInfo: string }) => {
    try {
      const result = await submitMutation.mutateAsync({
        songTitle: data.songTitle,
        songUrl: data.songUrl || undefined, contactInfo: data.contactInfo || undefined,
      });
      setSubmitSuccess(true);
      setRequiresPayment(result.requiresPayment);
      refetchWheel();
      if (isAdmin) refetchAllEntries();
    } catch (e) { console.error(e); }
  };

  const activeEntries = wheelData?.entries.filter(e => e.status === "active") || [];

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <OnboardingModal />

      {/* Hero */}
      <div className="pt-16 bg-gradient-to-b from-red-950/30 to-[#080808]">
        <div className="container py-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 uppercase tracking-[0.3em] font-semibold">Live Battle Event</span>
          </div>
          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase leading-none mb-2">
            MUSIC <span className="text-red-600">WARS</span>
          </h1>
          <p className="text-white/50 text-sm max-w-xl">
            Michigan's hardest rap battle competition. Spin the wheel, battle live, get judged by the culture. Presented by Murder Mitten Media.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
              className="text-xs border border-white/20 text-white/50 hover:border-white/50 hover:text-white px-4 py-2 uppercase tracking-widest transition-colors">
              @murdermittenmedia
            </a>
            {!user && (
              <a href={getLoginUrl()}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 uppercase tracking-widest transition-colors">
                Login to Participate
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="container py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT: Stream + Wheel + Submission */}
          <div className="xl:col-span-2 space-y-6">

            {/* Live Stream — offline-aware */}
            <LiveStreamPanel eventData={eventData} isAdmin={isAdmin}
              onSetLive={(isLive: boolean, streamUrl?: string) => setLiveMutation.mutateAsync({ isLive, streamUrl })}
              onScheduleEvent={(title: string, date: string, streamUrl?: string) => setEventMutation.mutateAsync({ title, date, streamUrl })}
            />

            {/* Wheel + Submission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0d0d0d] border border-white/10 p-5 flex flex-col items-center">
                <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-4 self-start">
                  Battle <span className="text-red-600">Wheel</span>
                </h2>
                <SpinWheel
                  entries={activeEntries}
                  isSpinning={wheelSpinning}
                  winner={wheelWinner}
                  winnerLabel={spinCount === 0 ? "Contestant 1" : spinCount === 1 ? (tripleTheatMode ? "Contestant 2" : "Contestant 2") : "Contestant 3"}
                  onSpin={handleSpin}
                  isAdmin={isAdmin}
                  onSpinComplete={handleSpinComplete}
                  spinCount={spinCount}
                />
                {/* Contestant selection status */}
                {isAdmin && (contestant1Entry || spinCount > 0) && (
                  <div className="w-full mt-3 space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-2 border text-sm ${
                      contestant1Entry ? "border-red-600/50 bg-red-950/20" : "border-white/10 bg-white/5"
                    }`}>
                      <span className="text-red-400 text-xs uppercase tracking-widest w-28 shrink-0">Contestant 1</span>
                      <span className="text-white font-semibold">{contestant1Entry?.artistName ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 border border-white/10 bg-white/5 text-sm">
                      <span className="text-red-400 text-xs uppercase tracking-widest w-28 shrink-0">Contestant 2</span>
                      <span className="text-white font-semibold">{contestant2Entry?.artistName ?? (spinCount === 1 ? "Pending spin…" : "—")}</span>
                    </div>
                    {tripleTheatMode && (
                      <div className="flex items-center gap-2 px-3 py-2 border border-yellow-600/30 bg-yellow-950/10 text-sm">
                        <span className="text-yellow-400 text-xs uppercase tracking-widest w-28 shrink-0">Contestant 3</span>
                        <span className="text-white font-semibold">{spinCount === 2 ? "Pending spin…" : "—"}</span>
                      </div>
                    )}
                    {spinCount < maxSpins && (
                      <p className="text-white/40 text-xs text-center">Spin again to pick Contestant {spinCount + 1}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-4">
                  Enter <span className="text-red-600">Battle</span>
                </h2>
                <SubmissionForm
                  isPaid={wheelData?.isPaid ?? false}
                  entryFee={wheelData?.entryFee ?? "10"}
                  isOpen={wheelData?.isOpen ?? true}
                  onSubmit={handleSubmit}
                  isLoading={submitMutation.isPending}
                  success={submitSuccess}
                  requiresPayment={requiresPayment}
                  user={user}
                />
              </div>
            </div>

            {/* Leaderboard */}
            <Leaderboard />

            {/* Past Battles */}
            <PastBattles />
          </div>

          {/* RIGHT: Chat + Audio Room + Admin */}
          <div className="space-y-4">
            <div>
              <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                Live <span className="text-red-600">Chat</span>
              </h2>
              <ChatPanel messages={messages} isConnected={chatConnected} onSend={sendMessage} username={user ? username : ""} />
              {!user && (
                <p className="text-white/30 text-xs mt-2 text-center">
                  <a href={getLoginUrl()} className="text-red-400 hover:underline">Login</a> to chat
                </p>
              )}
            </div>

            {/* Wars Radio — Now Playing + Admin Controls */}
            {warsRadioState && warsRadioState.tracks.length > 0 && (
              <div className="border border-red-600/30 bg-red-600/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-['Anton'] text-lg uppercase tracking-widest">
                    Now <span className="text-red-600">Playing</span>
                  </h2>
                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                {/* Current track info */}
                {(() => {
                  const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
                  if (!currentTrack) return null;
                  return (
                    <div className="mb-3">
                      <div className="text-white font-semibold text-sm truncate">{currentTrack.songTitle}</div>
                      <div className="text-white/50 text-xs">
                        by <ArtistLink artistName={currentTrack.contestantName} />
                        <span className="ml-2 text-white/30">• Contestant {currentTrack.contestantNumber}</span>
                      </div>
                    </div>
                  );
                })()}
                {/* Track list */}
                <div className="flex gap-2 mb-3">
                  {warsRadioState.tracks.map((t, i) => (
                    <div key={i} className={`flex-1 text-center py-1.5 text-xs uppercase tracking-wider border ${i === warsRadioState.currentIndex ? "border-red-600 bg-red-600/20 text-red-400" : "border-white/10 text-white/30"}`}>
                      {t.contestantName}
                    </div>
                  ))}
                </div>
                {/* Admin transport controls */}
                {isAdmin && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                      <button onClick={() => adminSeek(0)} className="flex items-center justify-center gap-1 border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 py-2 text-xs transition-colors" title="Rewind to start">
                        <Rewind className="w-3.5 h-3.5" />
                      </button>
                      {warsRadioState.isPlaying ? (
                        <button onClick={() => adminPause(0)} className="flex items-center justify-center gap-1 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 py-2 text-xs transition-colors" title="Pause">
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => adminResume(0)} className="flex items-center justify-center gap-1 border border-green-500/40 text-green-400 hover:bg-green-500/10 py-2 text-xs transition-colors" title="Play">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => adminSeek(30)} className="flex items-center justify-center gap-1 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 py-2 text-xs transition-colors" title="Fast Forward +30s">
                        <FastForward className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={adminSkip} className="flex items-center justify-center gap-1 border border-white/20 text-white/60 hover:text-white py-2 text-xs transition-colors" title="Skip to next contestant">
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={adminStop} className="flex items-center justify-center gap-1 border border-red-600/30 text-red-400 hover:bg-red-600/10 py-2 text-xs transition-colors" title="Stop radio">
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Last Song button */}
                    <button
                      onClick={() => { adminLastSong(); toast.success("Restoring last battle to radio..."); }}
                      className="w-full flex items-center justify-center gap-1.5 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
                      title="Restore previous battle to radio"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                      Last Battle
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Live Voting Panel */}
            <div>
              <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                Live <span className="text-red-600">Voting</span>
              </h2>
              <VotingPanel
                activeBattle={activeBattle}
                voteResults={voteResults}
                myVote={myVote}
                user={user ? { id: user.id, name: user.name ?? "Anonymous", role: user.role } : undefined}
                isJudge={isJudge}
                isAdmin={isAdmin}
                onVote={async (candidate) => { if (activeBattle?.id) await castVoteMutation.mutateAsync({ battleId: activeBattle.id, candidate }); }}
                onSetActiveBattle={async (c1, c2, c3, isTriple) => {
                  await setActiveBattleMutation.mutateAsync({
                    contestant1Name: c1,
                    contestant2Name: c2,
                    contestant3Name: c3,
                    isTripleThreat: isTriple,
                  });
                }}
                onClearVotes={async () => { if (activeBattle?.id) await clearVotesMutation.mutateAsync({ battleId: activeBattle.id }); }}
                entries={allEntries ?? []}
                onLoadToRadio={(contestantName, songTitle, songUrl, contestantNumber) => {
                  const existing = warsRadioState?.tracks ?? [];
                  const updated = existing.filter(t => t.contestantNumber !== contestantNumber);
                  loadTracks([...updated, { contestantName, songTitle, songUrl, contestantNumber }]);
                }}
                tripleTheatMode={tripleTheatMode}
                onToggleTripleThreat={() => setTripleTheat(!tripleTheatMode)}
              />
            </div>
            <div>
              <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                Audio <span className="text-red-600">Room</span>
              </h2>
              {user ? (
                <AudioRoomPanel
                  participants={participants} micActive={micActive} isConnected={audioConnected}
                  error={audioError} role={audioRole} onToggleMic={toggleMic}
                  onActivateContestant={activateContestantMic}
                  onKick={kickParticipant}
                  isJoined={audioJoined} onJoin={() => setAudioJoined(true)} onLeave={() => setAudioJoined(false)}
                />
              ) : (
                <div className="bg-[#0d0d0d] border border-white/10 p-5 text-center">
                  <p className="text-white/40 text-sm mb-3">Login to join the audio battle room</p>
                  <a href={getLoginUrl()} className="text-xs bg-red-600 hover:bg-red-700 text-white px-6 py-2 uppercase tracking-widest transition-colors inline-block">Login</a>
                </div>
              )}
            </div>

            {isAdmin && allEntries && (
              <div>
                <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                  Admin <span className="text-red-600">Panel</span>
                </h2>
                <AdminPanel
                  entries={allEntries}
                  onConfirmPayment={async (id) => { await confirmPaymentMutation.mutateAsync({ id }); refetchAllEntries(); refetchWheel(); }}
                  onUpdateStatus={async (id, status) => { await updateStatusMutation.mutateAsync({ id, status: status as any }); refetchAllEntries(); refetchWheel(); }}
                  onTogglePaid={async () => { await setSettingsMutation.mutateAsync({ isPaid: !wheelData?.isPaid }); refetchWheel(); }}
                  onToggleOpen={async () => { await setSettingsMutation.mutateAsync({ isOpen: !wheelData?.isOpen }); refetchWheel(); }}
                  isPaid={wheelData?.isPaid ?? false}
                  isOpen={wheelData?.isOpen ?? true}
                  isUpdating={setSettingsMutation.isPending}
                  onRecord={() => { refetchAllEntries(); }}
                  onRemoveEntry={async (id) => { await removeEntryMutation.mutateAsync({ id }); refetchAllEntries(); refetchWheel(); }}
                  onResetWar={async () => { await resetWarMutation.mutateAsync(); refetchAllEntries(); refetchWheel(); }}
                />
              </div>
            )}

            {/* How it works */}
            <div className="bg-[#0d0d0d] border border-white/10 p-5">
              <h3 className="font-['Anton'] text-sm uppercase tracking-widest mb-3">How It Works</h3>
              <ol className="space-y-2 text-xs text-white/50">
                {[
                  "Submit your song to enter the battle",
                  "Admin adds confirmed entries to the wheel",
                  "Wheel spins live on stream to pick matchups",
                  "Contestants battle in the audio room",
                  "Judges vote, winner advances up the leaderboard",
                  "Click any artist name to view their record and songs",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-500 font-bold flex-shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 py-8 mt-8">
        <div className="container text-center text-white/30 text-xs">
          <p>Murder Mitten Media Music Wars &copy; {new Date().getFullYear()} &middot; Michigan</p>
          <p className="mt-1">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Instagram</a>
            {" "}&middot;{" "}
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">YouTube</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
