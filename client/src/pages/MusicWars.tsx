/* ============================================================
   MUSIC WARS — Murder Mitten Media
   Features: animated spin wheel, live stream, real-time chat,
   audio battle room, submission form, admin panel,
   battle leaderboard with clickable artist stat popups
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteNav } from "@/components/SiteNav";
import { LiveRadioBanner } from "@/components/LiveRadioBanner";
import { ArtistStatModal } from "@/components/ArtistStatModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { TuneInButton } from "@/components/TuneInButton";
import { useChat } from "@/hooks/useChat";
import LabelBadge from "@/components/LabelBadge";
import { useWarsRadio, type WarsRadioTrack } from "@/hooks/useWarsRadio";
import { ArtistLink } from "@/components/ArtistLink";
import { Play, Pause, SkipForward, SkipBack, Rewind, FastForward, Square, Zap, Mic, MicOff, ChevronDown, ChevronUp } from "lucide-react";
import { useAdminMicBroadcast } from "@/hooks/useAdminMicBroadcast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useAudioRoom, type AudioParticipant } from "@/hooks/useAudioRoom";
import { getLoginUrl } from "@/const";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
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
              <>
                <button onClick={handleGoOffline} disabled={saving}
                  className="text-xs border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 px-3 py-1 uppercase tracking-widest transition-colors">
                  End Stream
                </button>
                <button onClick={handleGoOffline} disabled={saving}
                  className="text-xs bg-red-900/40 border border-red-600/60 text-red-300 hover:bg-red-900/60 px-3 py-1 uppercase tracking-widest transition-colors">
                  Admin End
                </button>
              </>
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
                : (spinCount ?? 0) === 0
                ? "SPIN FOR CONTESTANT 1"
                : (spinCount ?? 0) === 1
                ? "SPIN FOR CONTESTANT 2"
                : "SPIN FOR CONTESTANT 3"}
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
  messages: Array<{ id: number; username: string; message: string; isAdmin: boolean; accountLabels?: string[] | null; userId?: number | null; createdAt: Date }>;
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
              {msg.userId ? (
                <Link href={`/profile/${msg.userId}`} className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</Link>
              ) : (
                <ArtistStatModal artistName={msg.username}>
                  <button className="hover:text-red-400 transition-colors cursor-pointer">{msg.username}</button>
                </ArtistStatModal>
              )}
              {msg.accountLabels && msg.accountLabels.length > 0 && <span className="ml-1"><LabelBadge labels={msg.accountLabels} size="xs" /></span>}:
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
  voiceVolume, onVoiceVolumeChange,
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
  voiceVolume: number;
  onVoiceVolumeChange: (v: number) => void;
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
          {/* Voice Chat Mix Volume */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/40 uppercase tracking-widest">Voice Mix</span>
              <span className="text-xs text-white/60 font-mono">{Math.round(voiceVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={voiceVolume}
              onChange={e => onVoiceVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 accent-red-600 cursor-pointer"
              title="Voice chat volume (does not affect radio)"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
              <span>Quiet</span>
              <span>Loud</span>
            </div>
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
              <div className="border border-white/10 p-2"><div className="text-white/40 mb-0.5">CashApp</div><div className="text-white font-semibold">$MittenMedia</div></div>
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
        <input type="url" placeholder="YouTube link (optional)" value={songUrl} onChange={e => setSongUrl(e.target.value)}
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
            After submitting, send ${entryFee} to CashApp <span className="text-white">$MittenMedia</span> or PayPal <span className="text-white">MurderMittenPromo</span> with your artist name.
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

          {/* Audience vs Judge vote breakdown */}
          {(voteResults?.total ?? 0) > 0 && (
            <div className="border-t border-white/10 pt-3 mb-3">
              <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-widest mb-1">
                <span>Audience</span>
                <span>Judges</span>
              </div>
              <div className="flex justify-between text-xs text-white/50">
                <span>
                  {activeBattle?.contestant1Name}: {voteResults?.audienceContestant1 ?? 0} &nbsp;·&nbsp; {activeBattle?.contestant2Name}: {voteResults?.audienceContestant2 ?? 0}
                  {isTriple && activeBattle?.contestant3Name ? ` · ${activeBattle.contestant3Name}: ${voteResults?.audienceContestant3 ?? 0}` : ""}
                </span>
                <span className="text-yellow-400/70">{voteResults?.judgeVotes?.length ?? 0} vote{(voteResults?.judgeVotes?.length ?? 0) !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}
          {/* Judge votes — visible to all viewers */}
          {voteResults?.judgeVotes && voteResults.judgeVotes.length > 0 && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Judge Votes (public)</p>
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

// ─── Music Wars Admin Hub ────────────────────────────────────
function MusicWarsAdminHub({
  // Radio tab
  warsRadioState,
  adminPause, adminResume, adminSeek, adminSkip, adminStop, adminLastSong,
  adminMicBroadcast,
  // Battle tab
  tripleTheatMode, onToggleTripleThreat,
  onSetActiveBattle, onClearVotes,
  entries,
  onLoadToRadio,
  // Entries tab
  onConfirmPayment, onUpdateStatus, onRemoveEntry,
  // Settings tab
  isPaid, isOpen, isUpdating, onTogglePaid, onToggleOpen, onRecord, onResetWar,
}: {
  warsRadioState: ReturnType<typeof import("@/hooks/useWarsRadio").useWarsRadio>["state"];
  adminPause: (currentTime: number) => void;
  adminResume: (currentTime: number) => void;
  adminSeek: (currentTime: number) => void;
  adminSkip: () => void;
  adminStop: () => void;
  adminLastSong: () => void;
  adminMicBroadcast: ReturnType<typeof useAdminMicBroadcast>;
  tripleTheatMode: boolean;
  onToggleTripleThreat: () => void;
  onSetActiveBattle: (c1: string, c2: string, c3?: string, isTriple?: boolean) => void;
  onClearVotes: () => void;
  entries: Array<{ id: number; artistName: string; songTitle: string; paid: boolean; paymentConfirmed: boolean; status: string; songUrl?: string | null; userId?: number | null }>;
  onLoadToRadio: (contestantName: string, songTitle: string, songUrl: string, contestantNumber: number) => void;
  onConfirmPayment: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onRemoveEntry: (id: number) => void;
  isPaid: boolean;
  isOpen: boolean;
  isUpdating: boolean;
  onTogglePaid: () => void;
  onToggleOpen: () => void;
  onRecord: () => void;
  onResetWar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const audioPlayer = useAudioPlayer();
  const activeEntries = entries.filter(e => e.status === "active");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
          open ? "bg-red-600 text-white" : "bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30"
        }`}>
          <span className="flex items-center gap-2">
            <span>⚙</span>
            Admin Hub
            {adminMicBroadcast.isBroadcasting && (
              <span className="flex items-center gap-1 text-[10px] border border-red-300/60 bg-red-500/20 px-1.5 py-0.5 animate-pulse">
                <Mic className="w-2.5 h-2.5" /> MIC LIVE
              </span>
            )}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-red-600/20 border-t-0 bg-[#0d0d0d]">
          <Tabs defaultValue="radio" className="w-full">
            <TabsList className="w-full rounded-none bg-black/40 border-b border-white/10 h-auto p-0 gap-0">
              {["radio", "battle", "entries", "settings"].map(tab => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="flex-1 rounded-none text-[10px] uppercase tracking-widest py-2.5 data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400 data-[state=active]:border-b-2 data-[state=active]:border-red-600 text-white/40 hover:text-white/70 transition-colors"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── RADIO TAB ── */}
            <TabsContent value="radio" className="p-4 space-y-3">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Wars Radio Transport</div>
              {warsRadioState && warsRadioState.tracks.length > 0 ? (
                <>
                  {/* Current track info */}
                  {(() => {
                    const t = warsRadioState.tracks[warsRadioState.currentIndex];
                    if (!t) return null;
                    return (
                      <div className="px-3 py-2 border border-white/10 bg-white/5 mb-2">
                        <div className="text-white text-xs font-semibold truncate">{t.songTitle}</div>
                        <div className="text-white/40 text-[10px]">{t.contestantName} · C{t.contestantNumber}</div>
                      </div>
                    );
                  })()}
                  {/* Transport grid */}
                  <div className="grid grid-cols-5 gap-2">
                    <button onClick={() => adminSeek(0)} className="flex items-center justify-center border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 py-2 text-xs transition-colors" title="Rewind">
                      <Rewind className="w-3.5 h-3.5" />
                    </button>
                    {warsRadioState.isPlaying ? (
                      <button onClick={() => adminPause(audioPlayer.currentTime)} className="flex items-center justify-center border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 py-2 text-xs transition-colors" title="Pause">
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => adminResume(audioPlayer.currentTime)} className="flex items-center justify-center border border-green-500/40 text-green-400 hover:bg-green-500/10 py-2 text-xs transition-colors" title="Play">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => adminSeek(30)} className="flex items-center justify-center border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 py-2 text-xs transition-colors" title="+30s">
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={adminSkip} className="flex items-center justify-center border border-white/20 text-white/60 hover:text-white py-2 text-xs transition-colors" title="Skip">
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={adminStop} className="flex items-center justify-center border border-red-600/30 text-red-400 hover:bg-red-600/10 py-2 text-xs transition-colors" title="Stop">
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => { adminLastSong(); toast.success("Restoring last battle to radio..."); }}
                    className="w-full flex items-center justify-center gap-1.5 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 py-2 text-xs uppercase tracking-wider transition-colors"
                  >
                    <SkipBack className="w-3.5 h-3.5" /> Last Battle
                  </button>
                </>
              ) : (
                <p className="text-white/30 text-xs text-center py-2">No tracks loaded. Use Battle tab → Load to Radio.</p>
              )}
              {/* Mic → Radio */}
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={async () => {
                    try {
                      await adminMicBroadcast.toggleBroadcast();
                      if (!adminMicBroadcast.isBroadcasting) {
                        toast.success("🎙 Mic is now broadcasting to the radio feed");
                      } else {
                        toast("Mic broadcast stopped");
                      }
                    } catch {
                      toast.error("Could not access microphone — check browser permissions");
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
                    adminMicBroadcast.isBroadcasting
                      ? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
                      : "border-white/20 text-white/40 hover:border-red-500/40 hover:text-red-400"
                  }`}
                  title={adminMicBroadcast.isBroadcasting ? "Stop broadcasting mic to radio" : "Broadcast your mic to all radio listeners"}
                >
                  {adminMicBroadcast.isBroadcasting ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  {adminMicBroadcast.isBroadcasting ? "🔴 Mic → Radio (Live)" : "Mic → Radio"}
                </button>
              </div>
            </TabsContent>

            {/* ── BATTLE TAB ── */}
            <TabsContent value="battle" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-white/30 uppercase tracking-widest">Set Active Battle</div>
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
                    if (valid) { onSetActiveBattle(c1, c2, tripleTheatMode ? c3 : undefined, tripleTheatMode); setC1(""); setC2(""); setC3(""); }
                  }}
                  disabled={tripleTheatMode ? (!c1 || !c2 || !c3 || c1 === c2 || c1 === c3 || c2 === c3) : (!c1 || !c2 || c1 === c2)}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors">
                  Start Voting
                </button>
                <button onClick={onClearVotes}
                  className="border border-white/20 text-white/50 hover:border-white/40 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors">
                  Clear Votes
                </button>
              </div>
              {/* Load to Radio section */}
              {entries.filter(e => e.status === "active" && e.songUrl).length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Load Track to Radio</div>
                  <div className="space-y-1.5">
                    {entries.filter(e => e.status === "active" && e.songUrl).map((entry, idx) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white/70 truncate flex-1">{entry.artistName} — {entry.songTitle}</span>
                        <button
                          onClick={() => onLoadToRadio(entry.artistName, entry.songTitle, entry.songUrl!, idx + 1)}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-wider border border-white/20 text-white/50 hover:border-red-600 hover:text-red-400 px-2 py-0.5 transition-colors flex-shrink-0"
                        >
                          <Play className="w-2.5 h-2.5" /> C{idx + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Record Battle Result */}
              <div className="pt-2 border-t border-white/10">
                <RecordBattleForm entries={entries} onRecord={onRecord} />
              </div>
            </TabsContent>

            {/* ── ENTRIES TAB ── */}
            <TabsContent value="entries" className="p-4">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Wheel Entries ({entries.length})</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
                      {entry.songUrl && (
                        <button
                          onClick={() => onLoadToRadio(entry.artistName, entry.songTitle, entry.songUrl!, entries.indexOf(entry) + 1)}
                          className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider border border-white/20 text-white/40 hover:border-red-600 hover:text-red-400 px-1.5 py-0.5 transition-colors"
                          title="Load to Radio"
                        >
                          <Play className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs uppercase ${
                        entry.status === "active" ? "text-green-400" : entry.status === "winner" ? "text-yellow-400" : entry.status === "eliminated" ? "text-red-400" : "text-white/30"
                      }`}>{entry.status}</span>
                      <button onClick={() => onRemoveEntry(entry.id)} className="text-white/20 hover:text-red-500 transition-colors ml-1" title="Remove">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── SETTINGS TAB ── */}
            <TabsContent value="settings" className="p-4 space-y-3">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">War Settings</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={onTogglePaid} disabled={isUpdating}
                  className={`py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                    isPaid ? "border-red-600 text-red-400 bg-red-600/10" : "border-green-600 text-green-400 bg-green-600/10"
                  }`}>
                  Mode: {isPaid ? "Paid ($)" : "Free"}
                </button>
                <button onClick={onToggleOpen} disabled={isUpdating}
                  className={`py-2.5 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                    isOpen ? "border-green-600 text-green-400 bg-green-600/10" : "border-red-600 text-red-400 bg-red-600/10"
                  }`}>
                  {isOpen ? "Open" : "Closed"}
                </button>
              </div>
              <div className="pt-2 border-t border-white/10">
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
                        className="border border-white/20 text-white/50 py-2 text-xs uppercase tracking-wider transition-colors hover:border-white/40">Cancel</button>
                      <button onClick={() => { onResetWar(); setConfirmReset(false); }}
                        className="bg-orange-600 hover:bg-orange-700 text-white py-2 text-xs font-semibold uppercase tracking-wider transition-colors">Confirm Reset</button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
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

   const { data: wheelData, refetch: refetchWheel } = trpc.warsWheel.getEntries.useQuery();
  const { data: allEntries, refetch: refetchAllEntries } = trpc.warsWheel.getAllEntries.useQuery(undefined, { enabled: isAdmin });
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
  const submitMutation = trpc.warsWheel.submit.useMutation();
  const updateStatusMutation = trpc.warsWheel.updateStatus.useMutation();
  const confirmPaymentMutation = trpc.warsWheel.confirmPayment.useMutation();
  const setSettingsMutation = trpc.warsWheel.setSettings.useMutation();
  const removeEntryMutation = trpc.warsWheel.removeEntry.useMutation();
  const resetWarMutation = trpc.warsWheel.resetCurrentWar.useMutation();
  const markCalledMutation = trpc.warsWheel.markCalled.useMutation();
  const markCalledAndSaveStateMutation = trpc.warsWheel.markCalledAndSaveState.useMutation();
  const saveSpinStateMutation = trpc.warsWheel.saveSpinState.useMutation();
  const resetSpinStateMutation = trpc.warsWheel.resetSpinState.useMutation();
  const setBattleContestantsMutation = trpc.warsWheel.setBattleContestants.useMutation({
    onSuccess: () => { refetchActiveBattle(); refetchVotes(); refetchWheel(); if (isAdmin) refetchAllEntries(); },
  });

  // Persistent wheel spin state — loaded from DB on mount, synced via socket
  const { data: persistedSpinState, refetch: refetchSpinState } = trpc.warsWheel.getSpinState.useQuery();
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
    accountLabels: (() => { const raw = (user as { accountLabels?: string | null } | null)?.accountLabels; if (!raw) return []; try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })(),
    initialMessages: (chatHistory || []).map(m => ({
      id: m.id, username: m.username, message: m.message,
      room: m.room, isAdmin: m.isAdmin, accountLabels: null, createdAt: new Date(m.createdAt),
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
  const { participants, micActive, isConnected: audioConnected, error: audioError, toggleMic, activateContestantMic, kickParticipant, voiceVolume, setVoiceVolume } = useAudioRoom({
    room: "music_wars", username, role: audioRole, userId: user?.id, enabled: audioJoined,
  });
  // ─── Wars Radio Feed ─────────────────────────────────────────────────────────
  const warsRadio = useWarsRadio({ enabled: true });
  const { state: warsRadioState, tripleTheatMode, loadTracks, adminPause, adminResume, adminSeek, adminSkip, adminStop, adminLastSong, setTripleTheat } = warsRadio;
  // ─── Admin Mic Broadcast ─────────────────────────────────────────────────────────
  const adminMicBroadcast = useAdminMicBroadcast({ room: "music_wars", isAdmin, enabled: true, username, userId: user?.id });

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
  const isTripleActive = !!(activeBattle?.isTripleThreat && activeBattle?.contestant3Name);

  // ── Live Battle Banner — shown when a battle is active ──────────────────────
  const LiveBattleBanner = () => {
    if (!activeBattle) return null;
    const total = (voteResults?.contestant1 ?? 0) + (voteResults?.contestant2 ?? 0) + (isTripleActive ? (voteResults?.contestant3 ?? 0) : 0);
    const c1Pct = total > 0 ? Math.round(((voteResults?.contestant1 ?? 0) / total) * 100) : isTripleActive ? 33 : 50;
    const c2Pct = total > 0 ? Math.round(((voteResults?.contestant2 ?? 0) / total) * 100) : isTripleActive ? 33 : 50;
    const c3Pct = isTripleActive ? (100 - c1Pct - c2Pct) : 0;
    const getUserId = (name: string) => (wheelData?.entries ?? []).find(e => e.artistName === name)?.userId ?? undefined;

    return (
      <div className="relative overflow-hidden border-b border-red-600/40 bg-gradient-to-r from-red-950/60 via-[#0d0d0d] to-red-950/60">
        {/* Animated glow lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />
        </div>
        <div className="container py-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(209,0,0,0.8)]" />
              <span className="font-['Anton'] text-sm uppercase tracking-[0.3em] text-red-400">
                {isTripleActive ? "⚡ Triple Threat — Live Now" : "🥊 Battle — Live Now"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>{total} vote{total !== 1 ? "s" : ""}</span>
              {activeBattle.status === "voting" && <span className="text-green-400 font-semibold">Voting Open</span>}
            </div>
          </div>

          {/* Contestant cards */}
          <div className={`grid gap-3 items-stretch ${isTripleActive ? "grid-cols-3" : "grid-cols-[1fr_auto_1fr]"}`}>
            {/* Contestant 1 */}
            <div className={`relative rounded-lg border p-4 transition-all ${myVote?.candidate === "contestant1" ? "border-red-500 bg-red-950/30" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
              <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-2">Contestant 1</div>
              <ArtistStatModal artistName={activeBattle.contestant1Name} userId={getUserId(activeBattle.contestant1Name)}>
                <button className="font-['Anton'] text-xl text-white hover:text-red-400 transition-colors leading-tight text-left w-full">
                  {activeBattle.contestant1Name}
                </button>
              </ArtistStatModal>
              {activeBattle.contestant1SongTitle && (
                <div className="text-xs text-white/40 mt-1 truncate">
                  {activeBattle.contestant1SongUrl
                    ? <a href={activeBattle.contestant1SongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">🎵 {activeBattle.contestant1SongTitle}</a>
                    : <span>🎵 {activeBattle.contestant1SongTitle}</span>}
                </div>
              )}
              {/* Vote bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{voteResults?.contestant1 ?? 0} votes</span>
                  <span className="font-bold text-white">{c1Pct}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 rounded-full transition-all duration-700" style={{ width: `${c1Pct}%` }} />
                </div>
              </div>
              {/* Vote button */}
              {user && !myVote && activeBattle.status === "voting" && (
                <button
                  onClick={() => castVoteMutation.mutate({ battleId: activeBattle.id, candidate: "contestant1" })}
                  className="mt-3 w-full bg-red-600/20 hover:bg-red-600 border border-red-600/40 hover:border-red-600 text-red-400 hover:text-white text-xs py-2 uppercase tracking-widest transition-all font-semibold"
                >
                  Vote
                </button>
              )}
              {myVote?.candidate === "contestant1" && (
                <div className="mt-3 text-center text-xs text-red-400 font-semibold">✓ Your Vote</div>
              )}
            </div>

            {/* VS divider (1v1) or Contestant 2 (triple) */}
            {!isTripleActive ? (
              <div className="flex items-center justify-center">
                <div className="font-['Anton'] text-3xl text-red-600 drop-shadow-[0_0_20px_rgba(209,0,0,0.6)]">VS</div>
              </div>
            ) : (
              <div className={`relative rounded-lg border p-4 transition-all ${myVote?.candidate === "contestant2" ? "border-yellow-500 bg-yellow-950/20" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
                <div className="text-[10px] text-yellow-400 uppercase tracking-widest font-bold mb-2">Contestant 2</div>
                <ArtistStatModal artistName={activeBattle.contestant2Name} userId={getUserId(activeBattle.contestant2Name)}>
                  <button className="font-['Anton'] text-xl text-white hover:text-yellow-400 transition-colors leading-tight text-left w-full">
                    {activeBattle.contestant2Name}
                  </button>
                </ArtistStatModal>
                {activeBattle.contestant2SongTitle && (
                  <div className="text-xs text-white/40 mt-1 truncate">
                    {activeBattle.contestant2SongUrl
                      ? <a href={activeBattle.contestant2SongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">🎵 {activeBattle.contestant2SongTitle}</a>
                      : <span>🎵 {activeBattle.contestant2SongTitle}</span>}
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">{voteResults?.contestant2 ?? 0} votes</span>
                    <span className="font-bold text-white">{c2Pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full transition-all duration-700" style={{ width: `${c2Pct}%` }} />
                  </div>
                </div>
                {user && !myVote && activeBattle.status === "voting" && (
                  <button
                    onClick={() => castVoteMutation.mutate({ battleId: activeBattle.id, candidate: "contestant2" })}
                    className="mt-3 w-full bg-yellow-600/20 hover:bg-yellow-600 border border-yellow-600/40 hover:border-yellow-600 text-yellow-400 hover:text-white text-xs py-2 uppercase tracking-widest transition-all font-semibold"
                  >
                    Vote
                  </button>
                )}
                {myVote?.candidate === "contestant2" && (
                  <div className="mt-3 text-center text-xs text-yellow-400 font-semibold">✓ Your Vote</div>
                )}
              </div>
            )}

            {/* Contestant 2 (1v1) or Contestant 3 (triple) */}
            {!isTripleActive ? (
              <div className={`relative rounded-lg border p-4 transition-all ${myVote?.candidate === "contestant2" ? "border-red-500 bg-red-950/30" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
                <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-2">Contestant 2</div>
                <ArtistStatModal artistName={activeBattle.contestant2Name} userId={getUserId(activeBattle.contestant2Name)}>
                  <button className="font-['Anton'] text-xl text-white hover:text-red-400 transition-colors leading-tight text-left w-full">
                    {activeBattle.contestant2Name}
                  </button>
                </ArtistStatModal>
                {activeBattle.contestant2SongTitle && (
                  <div className="text-xs text-white/40 mt-1 truncate">
                    {activeBattle.contestant2SongUrl
                      ? <a href={activeBattle.contestant2SongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">🎵 {activeBattle.contestant2SongTitle}</a>
                      : <span>🎵 {activeBattle.contestant2SongTitle}</span>}
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/50">{voteResults?.contestant2 ?? 0} votes</span>
                    <span className="font-bold text-white">{c2Pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 rounded-full transition-all duration-700" style={{ width: `${c2Pct}%` }} />
                  </div>
                </div>
                {user && !myVote && activeBattle.status === "voting" && (
                  <button
                    onClick={() => castVoteMutation.mutate({ battleId: activeBattle.id, candidate: "contestant2" })}
                    className="mt-3 w-full bg-red-600/20 hover:bg-red-600 border border-red-600/40 hover:border-red-600 text-red-400 hover:text-white text-xs py-2 uppercase tracking-widest transition-all font-semibold"
                  >
                    Vote
                  </button>
                )}
                {myVote?.candidate === "contestant2" && (
                  <div className="mt-3 text-center text-xs text-red-400 font-semibold">✓ Your Vote</div>
                )}
              </div>
            ) : (
              activeBattle.contestant3Name && (
                <div className={`relative rounded-lg border p-4 transition-all ${myVote?.candidate === "contestant3" ? "border-orange-500 bg-orange-950/20" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
                  <div className="text-[10px] text-orange-400 uppercase tracking-widest font-bold mb-2">Contestant 3</div>
                  <ArtistStatModal artistName={activeBattle.contestant3Name} userId={getUserId(activeBattle.contestant3Name)}>
                    <button className="font-['Anton'] text-xl text-white hover:text-orange-400 transition-colors leading-tight text-left w-full">
                      {activeBattle.contestant3Name}
                    </button>
                  </ArtistStatModal>
                  {activeBattle.contestant3SongTitle && (
                    <div className="text-xs text-white/40 mt-1 truncate">
                      {activeBattle.contestant3SongUrl
                        ? <a href={activeBattle.contestant3SongUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">🎵 {activeBattle.contestant3SongTitle}</a>
                        : <span>🎵 {activeBattle.contestant3SongTitle}</span>}
                    </div>
                  )}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/50">{voteResults?.contestant3 ?? 0} votes</span>
                      <span className="font-bold text-white">{c3Pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-700" style={{ width: `${c3Pct}%` }} />
                    </div>
                  </div>
                  {user && !myVote && activeBattle.status === "voting" && (
                    <button
                      onClick={() => castVoteMutation.mutate({ battleId: activeBattle.id, candidate: "contestant3" })}
                      className="mt-3 w-full bg-orange-600/20 hover:bg-orange-600 border border-orange-600/40 hover:border-orange-600 text-orange-400 hover:text-white text-xs py-2 uppercase tracking-widest transition-all font-semibold"
                    >
                      Vote
                    </button>
                  )}
                  {myVote?.candidate === "contestant3" && (
                    <div className="mt-3 text-center text-xs text-orange-400 font-semibold">✓ Your Vote</div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Login to vote prompt */}
          {!user && activeBattle.status === "voting" && (
            <div className="mt-4 text-center">
              <a href={getLoginUrl()} className="text-xs text-red-400 hover:underline">Login to cast your vote →</a>
            </div>
          )}
          {myVote && (
            <div className="mt-4 text-center text-xs text-white/40">
              Vote locked in. Results update live.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <LiveRadioBanner filter="wars" />
      <OnboardingModal />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="pt-16 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-[#080808]/80 to-[#080808]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(209,0,0,0.15)_0%,transparent_60%)]" />
        <div className="container relative z-10 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(209,0,0,0.8)]" />
                <span className="text-xs text-red-400 uppercase tracking-[0.3em] font-semibold">Live Battle Event</span>
                {tripleTheatMode && (
                  <span className="text-xs bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-2 py-0.5 uppercase tracking-wider font-bold">
                    ⚡ Triple Threat Mode
                  </span>
                )}
              </div>
              <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase leading-none mb-2">
                MUSIC <span className="text-red-600">WARS</span>
              </h1>
              <p className="text-white/50 text-sm max-w-xl">
                Michigan's hardest rap battle. Spin the wheel, battle live, get judged by the culture.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              {!user ? (
                <a href={getLoginUrl()} className="bg-red-600 hover:bg-red-700 text-white text-xs px-5 py-2.5 uppercase tracking-widest font-semibold transition-colors">
                  Login to Enter
                </a>
              ) : (
                <span className="text-xs border border-green-600/40 text-green-400 px-3 py-2 uppercase tracking-widest">
                  ✓ Logged in as {username}
                </span>
              )}
              <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
                className="text-xs border border-white/20 text-white/50 hover:border-white/50 hover:text-white px-4 py-2 uppercase tracking-widest transition-colors">
                @murdermittenmedia
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE BATTLE QUEUE (shown when battle is active) ──── */}
      <LiveBattleBanner />

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="container py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN (2/3 width) ───────────────────────── */}
          <div className="xl:col-span-2 space-y-6">

            {/* ── WHEEL + ENTRY FORM ─────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Spin Wheel */}
              <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5 flex flex-col items-center">
                {/* Header */}
                <div className="flex items-center justify-between w-full mb-4">
                  <h2 className="font-['Anton'] text-lg uppercase tracking-widest">
                    Battle <span className="text-red-600">Wheel</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {tripleTheatMode && (
                      <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-2 py-0.5 uppercase tracking-wider font-bold rounded-full">
                        Triple Threat
                      </span>
                    )}
                    <span className="text-xs text-white/30">{activeEntries.length} entries</span>
                  </div>
                </div>

                <SpinWheel
                  entries={activeEntries}
                  isSpinning={wheelSpinning}
                  winner={wheelWinner}
                  winnerLabel={spinCount === 0 ? "Contestant 1" : spinCount === 1 ? "Contestant 2" : "Contestant 3"}
                  onSpin={handleSpin}
                  isAdmin={isAdmin}
                  onSpinComplete={handleSpinComplete}
                  spinCount={spinCount}
                />

                {/* Contestant selection status (admin only) */}
                {isAdmin && (contestant1Entry || spinCount > 0) && (
                  <div className="w-full mt-4 space-y-2">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Selection Progress</div>
                    {[
                      { label: "Contestant 1", entry: contestant1Entry, color: "red", picked: !!contestant1Entry },
                      { label: "Contestant 2", entry: contestant2Entry, color: "red", picked: !!contestant2Entry },
                      ...(tripleTheatMode ? [{ label: "Contestant 3", entry: null as typeof contestant1Entry, color: "yellow", picked: false }] : []),
                    ].map((slot, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded border text-sm ${
                        slot.picked
                          ? slot.color === "yellow" ? "border-yellow-600/50 bg-yellow-950/10" : "border-red-600/50 bg-red-950/20"
                          : "border-white/10 bg-white/5"
                      }`}>
                        <span className={`text-[10px] uppercase tracking-widest w-24 shrink-0 font-bold ${
                          slot.picked ? (slot.color === "yellow" ? "text-yellow-400" : "text-red-400") : "text-white/30"
                        }`}>{slot.label}</span>
                        <span className="text-white font-semibold truncate">
                          {slot.entry?.artistName ?? (i === spinCount ? "Pending spin…" : "—")}
                        </span>
                        {slot.entry?.songTitle && (
                          <span className="text-white/30 text-xs truncate ml-auto">🎵 {slot.entry.songTitle}</span>
                        )}
                      </div>
                    ))}
                    {spinCount < maxSpins && (
                      <p className="text-white/30 text-xs text-center pt-1">
                        Spin to select Contestant {spinCount + 1}
                      </p>
                    )}
                  </div>
                )}

                {/* Triple Threat toggle (admin) */}
                {isAdmin && (
                  <div className="w-full mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setTripleTheat(!tripleTheatMode)}
                      className={`w-full py-2 text-xs font-bold uppercase tracking-widest border transition-all ${
                        tripleTheatMode
                          ? "border-yellow-500 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                          : "border-white/20 text-white/40 hover:border-yellow-500/50 hover:text-yellow-400"
                      }`}
                    >
                      ⚡ Triple Threat {tripleTheatMode ? "ON" : "OFF"}
                    </button>
                  </div>
                )}
              </div>

              {/* Entry Form */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-['Anton'] text-lg uppercase tracking-widest">
                    Enter <span className="text-red-600">Battle</span>
                  </h2>
                  <span className={`text-[10px] border px-2 py-0.5 uppercase tracking-wider rounded-full ${
                    wheelData?.isPaid ? "border-red-600/50 text-red-400" : "border-green-600/50 text-green-400"
                  }`}>
                    {wheelData?.isPaid ? `$${wheelData?.entryFee ?? "10"} Entry` : "Free Entry"}
                  </span>
                </div>
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

                {/* How it works */}
                <div className="mt-4 bg-[#0d0d0d] border border-white/10 rounded-xl p-4">
                  <h3 className="font-['Anton'] text-xs uppercase tracking-widest mb-3 text-white/60">How It Works</h3>
                  <ol className="space-y-2">
                    {[
                      "Submit your song to enter the wheel",
                      "Admin approves and adds you to the wheel",
                      "Wheel spins live to pick matchups",
                      "Battle in the audio room — judges vote",
                      "Winner advances up the leaderboard",
                    ].map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-white/40">
                        <span className="text-red-500 font-bold flex-shrink-0 w-4">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            {/* ── NOW PLAYING (Wars Radio) ────────────────────── */}
            {warsRadioState && warsRadioState.tracks.length > 0 && (
              <div className="border border-red-600/30 bg-gradient-to-r from-red-950/20 to-[#0d0d0d] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-['Anton'] text-lg uppercase tracking-widest">
                    Now <span className="text-red-600">Playing</span>
                  </h2>
                  <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live
                  </span>
                </div>
                {(() => {
                  const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
                  if (!currentTrack) return null;
                  return (
                    <div className="mb-4">
                      <div className="text-white font-semibold truncate">{currentTrack.songTitle}</div>
                      <div className="text-white/50 text-xs mt-0.5">
                        by <ArtistLink artistName={currentTrack.contestantName} />
                        <span className="ml-2 text-white/30">· Contestant {currentTrack.contestantNumber}</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  {warsRadioState.tracks.map((t, i) => (
                    <div key={i} className={`flex-1 text-center py-2 text-xs uppercase tracking-wider rounded border ${
                      i === warsRadioState.currentIndex
                        ? "border-red-600 bg-red-600/20 text-red-400"
                        : "border-white/10 text-white/30"
                    }`}>
                      {t.contestantName}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ROUND RESULTS ──────────────────────────────── */}
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-['Anton'] text-xl uppercase tracking-widest">
                  Round <span className="text-red-600">Results</span>
                </h2>
                <span className="text-xs text-white/30 uppercase tracking-widest">
                  Round {wheelData?.currentRound ?? 1}
                </span>
              </div>
              <PastBattles />
            </div>

            {/* ── LEADERBOARD ────────────────────────────────── */}
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5">
              <h2 className="font-['Anton'] text-xl uppercase tracking-widest mb-4">
                Season <span className="text-red-600">Standings</span>
              </h2>
              <Leaderboard />
            </div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Admin Hub */}
            {isAdmin && (
              <MusicWarsAdminHub
                warsRadioState={warsRadioState}
                adminPause={adminPause}
                adminResume={adminResume}
                adminSeek={adminSeek}
                adminSkip={adminSkip}
                adminStop={adminStop}
                adminLastSong={adminLastSong}
                adminMicBroadcast={adminMicBroadcast}
                tripleTheatMode={tripleTheatMode}
                onToggleTripleThreat={() => setTripleTheat(!tripleTheatMode)}
                onSetActiveBattle={async (c1, c2, c3, isTriple) => {
                  await setActiveBattleMutation.mutateAsync({ contestant1Name: c1, contestant2Name: c2, contestant3Name: c3 ?? undefined, isTripleThreat: isTriple });
                }}
                onClearVotes={async () => { if (activeBattle?.id) await clearVotesMutation.mutateAsync({ battleId: activeBattle.id }); }}
                entries={allEntries ?? []}
                onLoadToRadio={(contestantName, songTitle, songUrl, contestantNumber) => {
                  const existing = warsRadioState?.tracks ?? [];
                  const updated = existing.map((t, i) => i === contestantNumber - 1 ? { ...t, contestantName, songTitle, songUrl } : t);
                  loadTracks(updated.length > 0 ? updated : [{ contestantName, songTitle, songUrl, contestantNumber }]);
                }}
                onConfirmPayment={async (id) => { await confirmPaymentMutation.mutateAsync({ id }); refetchAllEntries(); refetchWheel(); }}
                onUpdateStatus={async (id, status) => { await updateStatusMutation.mutateAsync({ id, status: status as any }); refetchAllEntries(); refetchWheel(); }}
                onRemoveEntry={async (id) => { await removeEntryMutation.mutateAsync({ id }); refetchAllEntries(); refetchWheel(); }}
                isPaid={wheelData?.isPaid ?? false}
                isOpen={wheelData?.isOpen ?? true}
                isUpdating={setSettingsMutation.isPending}
                onTogglePaid={async () => { await setSettingsMutation.mutateAsync({ isPaid: !wheelData?.isPaid }); refetchWheel(); }}
                onToggleOpen={async () => { await setSettingsMutation.mutateAsync({ isOpen: !wheelData?.isOpen }); refetchWheel(); }}
                onRecord={() => { refetchAllEntries(); }}
                onResetWar={async () => { await resetWarMutation.mutateAsync(); refetchAllEntries(); refetchWheel(); }}
              />
            )}

            {/* Audio Room */}
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5">
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
                  voiceVolume={voiceVolume} onVoiceVolumeChange={setVoiceVolume}
                />
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/40 text-sm mb-3">Login to join the audio battle room</p>
                  <a href={getLoginUrl()} className="text-xs bg-red-600 hover:bg-red-700 text-white px-6 py-2 uppercase tracking-widest transition-colors inline-block">
                    Login
                  </a>
                </div>
              )}
            </div>

            {/* Wheel Entries (viewer-facing) */}
            {activeEntries.length > 0 && (
              <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-5">
                <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                  On The <span className="text-red-600">Wheel</span>
                  <span className="ml-2 text-sm text-white/30 font-['DM_Sans'] normal-case tracking-normal">({activeEntries.length})</span>
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeEntries.map((entry, i) => (
                    <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-white/5 text-xs">
                      <span className="text-red-500 font-bold w-5 text-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <ArtistStatModal artistName={entry.artistName} userId={entry.userId ?? undefined}>
                          <button className="text-white/80 font-semibold hover:text-red-400 transition-colors truncate block">
                            {entry.artistName}
                          </button>
                        </ArtistStatModal>
                        {entry.songTitle && (
                          <div className="text-white/30 truncate mt-0.5">
                            {entry.songUrl
                              ? <a href={entry.songUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">🎵 {entry.songTitle}</a>
                              : <span>🎵 {entry.songTitle}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── LIVE CHAT (full width, bottom) ─────────────────── */}
        <div className="mt-8 bg-[#0d0d0d] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${chatConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <h2 className="font-['Anton'] text-lg uppercase tracking-widest">
                Live <span className="text-red-600">Chat</span>
              </h2>
            </div>
            {!user && (
              <a href={getLoginUrl()} className="text-xs text-red-400 hover:underline">Login to chat →</a>
            )}
          </div>
          <div className="p-4">
            <ChatPanel
              messages={messages}
              isConnected={chatConnected}
              onSend={sendMessage}
              username={user ? username : ""}
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 py-8 mt-8">
        <div className="container text-center text-white/30 text-xs">
          <p>Murder Mitten Media Music Wars &copy; {new Date().getFullYear()} · Michigan</p>
          <p className="mt-1">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Instagram</a>
            {" "}·{" "}
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">YouTube</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
