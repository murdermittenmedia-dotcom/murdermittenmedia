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
import { useChat } from "@/hooks/useChat";
import { useAudioRoom, type AudioParticipant } from "@/hooks/useAudioRoom";
import { getLoginUrl } from "@/const";

// ─── Spin Wheel ───────────────────────────────────────────────
interface WheelEntry {
  id: number;
  artistName: string;
  songTitle: string;
  status: string;
}

const WHEEL_COLORS = [
  "#D10000", "#8B0000", "#B22222", "#C41E3A",
  "#FF4444", "#990000", "#CC0000", "#E60000",
];

function SpinWheel({
  entries,
  isSpinning,
  winner,
  onSpin,
  isAdmin,
}: {
  entries: WheelEntry[];
  isSpinning: boolean;
  winner: string | null;
  onSpin: () => void;
  isAdmin: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(0);
  const spinningRef = useRef(false);

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

    // Pointer
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
      if (velRef.current > 0.003) { rafRef.current = requestAnimationFrame(animate); }
      else { spinningRef.current = false; }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpinning, draw]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef} width={300} height={300}
        className="rounded-full shadow-[0_0_40px_rgba(209,0,0,0.3)]"
      />
      {winner && (
        <div className="text-center">
          <div className="text-xs text-red-400 uppercase tracking-widest mb-1">Winner</div>
          <div className="font-['Anton'] text-2xl text-white animate-pulse">{winner}</div>
        </div>
      )}
      {isAdmin && (
        <button
          onClick={onSpin}
          disabled={isSpinning || entries.length < 2}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3 font-['Anton'] text-base uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.5)]"
        >
          {isSpinning ? "Spinning..." : "SPIN THE WHEEL"}
        </button>
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
  onToggleMic, onActivateContestant, isJoined, onJoin, onLeave,
}: {
  participants: AudioParticipant[];
  micActive: boolean;
  isConnected: boolean;
  error: string | null;
  role: string;
  onToggleMic: () => void;
  onActivateContestant: (socketId: string, active: boolean) => void;
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
            {(role === "judge" || role === "admin") && (
              <button
                onClick={onToggleMic}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors ${micActive ? "border-green-600 text-green-400 hover:bg-green-600/20" : "border-red-600 text-red-400 hover:bg-red-600/20"}`}
              >
                {micActive ? "Mic On" : "Mic Off"}
              </button>
            )}
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
  isPaid, entryFee, isOpen, onSubmit, isLoading, success, requiresPayment,
}: {
  isPaid: boolean; entryFee: string; isOpen: boolean;
  onSubmit: (d: { artistName: string; songTitle: string; songUrl: string; contactInfo: string }) => void;
  isLoading: boolean; success: boolean; requiresPayment: boolean;
}) {
  const [artistName, setArtistName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [contactInfo, setContactInfo] = useState("");

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
      <form onSubmit={e => { e.preventDefault(); onSubmit({ artistName, songTitle, songUrl, contactInfo }); }} className="space-y-3">
        <input type="text" placeholder="Artist Name *" value={artistName} onChange={e => setArtistName(e.target.value)} required maxLength={128}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        <input type="text" placeholder="Song Title *" value={songTitle} onChange={e => setSongTitle(e.target.value)} required maxLength={128}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        <input type="url" placeholder="YouTube / SoundCloud link (optional)" value={songUrl} onChange={e => setSongUrl(e.target.value)}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        <input type="text" placeholder="Email or Instagram handle (optional)" value={contactInfo} onChange={e => setContactInfo(e.target.value)} maxLength={256}
          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600/50 placeholder-white/30" />
        {isPaid && (
          <div className="bg-red-900/20 border border-red-600/20 p-3 text-xs text-white/60">
            <span className="text-red-400 font-semibold">Paid entry: </span>
            After submitting, send ${entryFee} to CashApp <span className="text-white">$joyfuljules</span> or PayPal <span className="text-white">MurderMittenPromo</span> with your artist name.
          </div>
        )}
        <button type="submit" disabled={isLoading || !artistName.trim() || !songTitle.trim()}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 font-['Anton'] uppercase tracking-widest transition-all">
          {isLoading ? "Submitting..." : isPaid ? `Submit ($${entryFee})` : "Submit Free Entry"}
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
function AdminPanel({
  entries, onConfirmPayment, onUpdateStatus, onTogglePaid, onToggleOpen,
  isPaid, isOpen, isUpdating, onRecord,
}: {
  entries: Array<{ id: number; artistName: string; songTitle: string; paid: boolean; paymentConfirmed: boolean; status: string; songUrl?: string | null; userId?: number | null }>;
  onConfirmPayment: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => void;
  onTogglePaid: () => void;
  onToggleOpen: () => void;
  isPaid: boolean; isOpen: boolean; isUpdating: boolean;
  onRecord: () => void;
}) {
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
            </div>
          </div>
        ))}
      </div>
      <RecordBattleForm entries={entries} onRecord={onRecord} />
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

// ─── Main Page ────────────────────────────────────────────────
export default function MusicWars() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isJudge = user?.role === "judge";
  const isContestant = user?.role === "contestant";
  const username = user?.artistName || user?.name || "Guest";
  const audioRole = isAdmin ? "admin" : isJudge ? "judge" : isContestant ? "contestant" : "viewer";

  const { data: wheelData, refetch: refetchWheel } = trpc.wheel.getEntries.useQuery();
  const { data: allEntries, refetch: refetchAllEntries } = trpc.wheel.getAllEntries.useQuery(undefined, { enabled: isAdmin });
  const { data: chatHistory } = trpc.chat.getHistory.useQuery({ room: "music_wars" });

  const submitMutation = trpc.wheel.submit.useMutation();
  const updateStatusMutation = trpc.wheel.updateStatus.useMutation();
  const confirmPaymentMutation = trpc.wheel.confirmPayment.useMutation();
  const setSettingsMutation = trpc.wheel.setSettings.useMutation();

  const { messages, isConnected: chatConnected, sendMessage, wheelWinner, wheelSpinning, broadcastSpin, broadcastWinner } = useChat({
    room: "music_wars",
    username,
    userId: user?.id,
    isAdmin,
    initialMessages: (chatHistory || []).map(m => ({
      id: m.id, username: m.username, message: m.message,
      room: m.room, isAdmin: m.isAdmin, createdAt: new Date(m.createdAt),
    })),
  });

  const [audioJoined, setAudioJoined] = useState(false);
  const { participants, micActive, isConnected: audioConnected, error: audioError, toggleMic, activateContestantMic } = useAudioRoom({
    room: "music_wars", username, role: audioRole, userId: user?.id, enabled: audioJoined,
  });

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);

  const handleSpin = useCallback(() => {
    if (!isAdmin || !wheelData?.entries.length) return;
    broadcastSpin();
    setTimeout(() => {
      const active = wheelData.entries.filter(e => e.status === "active");
      if (active.length > 0) {
        const w = active[Math.floor(Math.random() * active.length)];
        broadcastWinner(w.artistName);
      }
    }, 6500);
  }, [isAdmin, wheelData, broadcastSpin, broadcastWinner]);

  const handleSubmit = async (data: { artistName: string; songTitle: string; songUrl: string; contactInfo: string }) => {
    try {
      const result = await submitMutation.mutateAsync({
        artistName: data.artistName, songTitle: data.songTitle,
        songUrl: data.songUrl || undefined, contactInfo: data.contactInfo || undefined, userId: user?.id,
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
            Detroit's hardest rap battle competition. Spin the wheel, battle live, get judged by the culture. Presented by Murder Mitten Media.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <a href="https://discord.gg/hZUPZzx7" target="_blank" rel="noopener noreferrer"
              className="text-xs border border-white/20 text-white/50 hover:border-white/50 hover:text-white px-4 py-2 uppercase tracking-widest transition-colors">
              Discord Community
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

            {/* Live Stream */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 uppercase tracking-widest font-semibold">Live Stream</span>
              </div>
              <div className="relative w-full bg-black border border-white/10" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/live_stream?channel=UCmurdermitten&autoplay=1"
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

            {/* Wheel + Submission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0d0d0d] border border-white/10 p-5 flex flex-col items-center">
                <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-4 self-start">
                  Battle <span className="text-red-600">Wheel</span>
                </h2>
                <SpinWheel entries={activeEntries} isSpinning={wheelSpinning} winner={wheelWinner} onSpin={handleSpin} isAdmin={isAdmin} />
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
                />
              </div>
            </div>

            {/* Leaderboard */}
            <Leaderboard />

            {/* Past Battles */}
            <div>
              <h2 className="font-['Anton'] text-xl uppercase tracking-widest mb-4">
                Past <span className="text-red-600">Battles</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "PLiW5X02rswZu7CaiF9liCbIMpxrsPkzvc", title: "Murder Mitten Mic — One Mic Sessions" },
                ].map((video, i) => (
                  <div key={i} className="border border-white/10 bg-[#0d0d0d]">
                    <div className="relative" style={{ paddingTop: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/videoseries?list=${video.id}`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-white/70 font-semibold">{video.title}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <a href="https://www.youtube.com/@MurderMittenMedia/search?query=music+wars" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-white/40 hover:text-red-400 uppercase tracking-widest transition-colors">
                  View All Past Battles on YouTube
                </a>
              </div>
            </div>
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

            <div>
              <h2 className="font-['Anton'] text-lg uppercase tracking-widest mb-3">
                Audio <span className="text-red-600">Room</span>
              </h2>
              {user ? (
                <AudioRoomPanel
                  participants={participants} micActive={micActive} isConnected={audioConnected}
                  error={audioError} role={audioRole} onToggleMic={toggleMic}
                  onActivateContestant={activateContestantMic}
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
          <p>Murder Mitten Media Music Wars &copy; {new Date().getFullYear()} &middot; Detroit, MI</p>
          <p className="mt-1">
            <a href="https://discord.gg/hZUPZzx7" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Discord</a>
            {" "}&middot;{" "}
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">YouTube</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
