/* ============================================================
   MURDER MITTEN MEDIA — Daily Free Promo Wheel
   Canvas-based spinning wheel with names drawn on segments
   Admin-only spin; users submit their name (1 per day)
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Segment colors ──────────────────────────────────────────
const SEGMENT_COLORS = [
  "#D10000", "#1a1a1a", "#8B0000", "#2d2d2d",
  "#FF2222", "#111111", "#C00000", "#333333",
  "#E50000", "#222222", "#B00000", "#3a3a3a",
];

// ─── Countdown timer hook ─────────────────────────────────────
function useCountdown7pm() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      const next7pm = new Date();
      next7pm.setHours(19, 0, 0, 0);
      if (now >= next7pm) next7pm.setDate(next7pm.getDate() + 1);
      const diff = next7pm.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

// ─── Canvas wheel component ───────────────────────────────────
interface WheelCanvasProps {
  names: string[];
  spinning: boolean;
  winnerIndex: number | null;
  onSpinComplete: () => void;
}

function WheelCanvas({ names, spinning, winnerIndex, onSpinComplete }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const spinningRef = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, W, H);

    if (names.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();
      ctx.strokeStyle = "#D10000";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff44";
      ctx.font = "bold 18px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No entries yet", cx, cy);
      return;
    }

    const segAngle = (Math.PI * 2) / names.length;

    names.forEach((name, i) => {
      const startAngle = angle + i * segAngle;
      const endAngle = startAngle + segAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#080808";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      const fontSize = names.length > 20 ? 9 : names.length > 12 ? 11 : names.length > 8 ? 13 : 15;
      ctx.font = `bold ${fontSize}px 'DM Sans', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;

      const textR = r - 12;
      const maxWidth = textR * 0.75;
      const displayName = name.length > 18 ? name.slice(0, 16) + "..." : name;
      ctx.fillText(displayName, textR, 0, maxWidth);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#D10000";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }, [names]);

  useEffect(() => {
    drawWheel(angleRef.current);
  }, [names, drawWheel]);

  useEffect(() => {
    if (!spinning || names.length === 0) return;
    if (spinningRef.current) return;
    spinningRef.current = true;

    const segAngle = (Math.PI * 2) / names.length;
    const targetIdx = winnerIndex !== null ? winnerIndex : Math.floor(Math.random() * names.length);
    const currentAngle = angleRef.current % (Math.PI * 2);
    const targetMid = -(targetIdx * segAngle + segAngle / 2);
    let delta = targetMid - currentAngle;
    delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    delta += Math.PI * 10;

    const totalAngle = delta;
    const duration = 4500;
    let startTime: number | null = null;
    const startAngle = angleRef.current;

    function easeOut(t: number) {
      return 1 - Math.pow(1 - t, 4);
    }

    function frame(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / duration, 1);
      angleRef.current = startAngle + totalAngle * easeOut(t);
      drawWheel(angleRef.current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        spinningRef.current = false;
        onSpinCompleteRef.current();
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [spinning, winnerIndex, names, drawWheel]);

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={420}
      className="rounded-full"
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}

// ─── Knife ticker SVG ─────────────────────────────────────────
function KnifeTicker() {
  return (
    <div
      className="absolute"
      style={{
        right: "-22px",
        top: "50%",
        transform: "translateY(-50%) rotate(180deg)",
        zIndex: 10,
        filter: "drop-shadow(0 0 4px rgba(209,0,0,0.8))",
      }}
    >
      <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
        <path d="M48 14 L8 4 L2 14 L8 24 Z" fill="#C0C0C0" />
        <path d="M48 14 L8 4 L6 14" fill="#E8E8E8" />
        <rect x="0" y="10" width="10" height="8" rx="2" fill="#1a1a1a" />
        <rect x="1" y="11" width="8" height="6" rx="1" fill="#333" />
        <circle cx="3" cy="14" r="1" fill="#888" />
        <circle cx="7" cy="14" r="1" fill="#888" />
        <circle cx="44" cy="14" r="2" fill="#D10000" />
      </svg>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function WheelOfNames() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const countdown = useCountdown7pm();

  const { data: entries = [], refetch: refetchEntries } = trpc.promoWheel.getEntries.useQuery();
  const { data: lastWinner, refetch: refetchWinner } = trpc.promoWheel.getLastWinner.useQuery();

  const hasEnteredToday = !!entries.find(e => user && e.userId === user.id && !e.isPaid);

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinWinnerIndex, setSpinWinnerIndex] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<{ name: string } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const [submitHandle, setSubmitHandle] = useState("");
  const [adminName, setAdminName] = useState("");
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidQty, setPaidQty] = useState(1);

  const submitMutation = trpc.promoWheel.submitName.useMutation({
    onSuccess: () => { setSubmitHandle(""); refetchEntries(); },
  });

  const adminSpinMutation = trpc.promoWheel.adminSpin.useMutation({
    onSuccess: (data) => {
      const idx = entries.findIndex(e => e.name === data.winner.name);
      setSpinWinnerIndex(idx >= 0 ? idx : 0);
      setSpinResult({ name: data.winner.name });
      setIsSpinning(true);
    },
    onError: (err) => alert(err.message),
  });

  const adminResetMutation = trpc.promoWheel.adminReset.useMutation({
    onSuccess: () => { refetchEntries(); refetchWinner(); setSpinResult(null); setShowResult(false); },
  });

  const adminAddMutation = trpc.promoWheel.adminAddName.useMutation({
    onSuccess: () => { setAdminName(""); refetchEntries(); },
  });

  const adminRemoveMutation = trpc.promoWheel.adminRemoveName.useMutation({
    onSuccess: () => refetchEntries(),
  });

  const buyEntriesMutation = trpc.promoWheel.buyEntries.useMutation({
    onSuccess: () => {
      setShowPaidModal(false);
      alert("Request sent! Admin will confirm your paid entries after payment verification.");
    },
  });

  function handleSpinComplete() {
    setIsSpinning(false);
    setShowResult(true);
    refetchEntries();
    refetchWinner();
  }

  function handleAdminSpin() {
    if (entries.length === 0) { alert("No entries on the wheel!"); return; }
    setShowResult(false);
    adminSpinMutation.mutate();
  }

  function handleAdminReset() {
    if (!confirm("Reset the wheel? This will clear all entries without picking a winner.")) return;
    adminResetMutation.mutate();
  }

  const names = entries.map(e => e.name);

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <button className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.828 7H14v2H3.828l4.243 4.243-1.414 1.414L0 8l6.657-6.657 1.414 1.414L3.828 7z"/>
              </svg>
              Home
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="font-['Anton'] text-lg tracking-wider">
              DAILY FREE <span className="text-red-600">PROMO WHEEL</span>
            </span>
          </div>
          <div className="text-xs text-white/40 uppercase tracking-widest hidden sm:block">
            Free Daily Entry
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Countdown + last winner row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="border border-white/10 bg-white/[0.03] p-5 flex flex-col items-center justify-center">
            <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-2 font-semibold">Next Spin In</div>
            <div className="font-['Anton'] text-5xl text-white tracking-wider" style={{ fontVariantNumeric: "tabular-nums" }}>
              {countdown}
            </div>
            <div className="text-white/40 text-xs mt-1 uppercase tracking-widest">Daily spin at 7:00 PM</div>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5 flex flex-col items-center justify-center">
            <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-2 font-semibold">Last Winner</div>
            {lastWinner ? (
              <>
                <div className="font-['Anton'] text-3xl text-white mb-1">{lastWinner.winnerName}</div>
                <div className="text-white/40 text-xs uppercase tracking-widest">{lastWinner.spinDate}</div>
              </>
            ) : (
              <div className="text-white/30 text-sm">No spins yet</div>
            )}
          </div>
        </div>

        {/* Main content: wheel + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wheel */}
          <div className="lg:col-span-2 flex flex-col items-center">
            {showResult && spinResult && (
              <div className="w-full mb-6 border border-red-600 bg-red-600/10 p-5 text-center">
                <div className="text-xs text-red-400 uppercase tracking-[0.3em] mb-1">Today's Winner</div>
                <div className="font-['Anton'] text-4xl text-white">{spinResult.name}</div>
                <div className="text-white/50 text-sm mt-1">Congratulations!</div>
              </div>
            )}

            <div className="relative inline-flex items-center justify-center">
              <WheelCanvas
                names={names}
                spinning={isSpinning}
                winnerIndex={spinWinnerIndex}
                onSpinComplete={handleSpinComplete}
              />
              <KnifeTicker />
            </div>

            <div className="mt-4 text-white/40 text-sm">
              {entries.length} {entries.length === 1 ? "name" : "names"} on the wheel
            </div>

            {isAdmin && (
              <div className="mt-6 w-full max-w-md border border-red-600/30 bg-red-600/5 p-5">
                <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-4 font-semibold">Admin Controls</div>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={handleAdminSpin}
                    disabled={isSpinning || adminSpinMutation.isPending || entries.length === 0}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    {isSpinning || adminSpinMutation.isPending ? "Spinning..." : "Spin Wheel"}
                  </button>
                  <button
                    onClick={handleAdminReset}
                    disabled={adminResetMutation.isPending}
                    className="flex-1 border border-white/20 hover:border-white/50 text-white/60 hover:text-white py-3 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    Reset
                  </button>
                </div>
                <form
                  onSubmit={e => { e.preventDefault(); if (adminName.trim()) adminAddMutation.mutate({ name: adminName.trim() }); }}
                  className="flex gap-2"
                >
                  <input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="@instagram_handle"
                    maxLength={128}
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-white/30 px-3 py-2 text-sm focus:outline-none focus:border-red-600/50"
                  />
                  <button
                    type="submit"
                    disabled={!adminName.trim() || adminAddMutation.isPending}
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white px-4 py-2 text-sm font-semibold transition-all"
                    onClick={e => {
                      // Normalise: strip leading @ then re-add so it's stored as @handle
                      const raw = adminName.trim().replace(/^@/, "");
                      if (raw) setAdminName(`@${raw}`);
                    }}
                  >
                    Add
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Submit name */}
            <div className="border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-3 font-semibold">Enter Today's Wheel</div>
              {!user ? (
                <div className="text-white/50 text-sm">
                  <a href={getLoginUrl()} className="text-red-500 hover:text-red-400 underline">Sign in</a> to submit your Instagram @ for free.
                </div>
              ) : hasEnteredToday ? (
                <div className="text-center py-4">
                  <div className="text-green-400 text-sm font-semibold mb-1">You're in!</div>
                  <div className="text-white/40 text-xs">Already entered today. Come back tomorrow!</div>
                  <button
                    onClick={() => setShowPaidModal(true)}
                    className="mt-3 w-full border border-red-600/40 text-red-400 hover:border-red-600 hover:text-red-300 py-2 text-xs font-semibold uppercase tracking-widest transition-all"
                  >
                    + Buy Extra Entries ($5 each)
                  </button>
                </div>
              ) : (
                <form onSubmit={e => {
                  e.preventDefault();
                  const raw = submitHandle.trim().replace(/^@/, "");
                  if (!raw) return;
                  if (!/^[a-zA-Z0-9._]{1,30}$/.test(raw)) {
                    alert("Please enter a valid Instagram handle (letters, numbers, underscores, dots — max 30 characters).");
                    return;
                  }
                  submitMutation.mutate({ name: `@${raw}` });
                }}>
                  <label className="block text-white/40 text-xs mb-1 uppercase tracking-widest">Instagram Handle</label>
                  <div className="flex items-center border border-white/10 bg-white/5 mb-3 focus-within:border-red-600/50">
                    <span className="text-white/40 pl-3 text-sm select-none">@</span>
                    <input
                      value={submitHandle.replace(/^@/, "")}
                      onChange={e => setSubmitHandle(e.target.value.replace(/^@/, ""))}
                      placeholder="yourusername"
                      maxLength={30}
                      className="flex-1 bg-transparent text-white placeholder-white/30 px-2 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!submitHandle.trim() || submitMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    {submitMutation.isPending ? "Submitting..." : "Submit Free Entry"}
                  </button>
                  {submitMutation.isError && (
                    <div className="text-red-400 text-xs mt-2">{submitMutation.error.message}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPaidModal(true)}
                    className="mt-2 w-full border border-white/10 text-white/40 hover:text-white/60 py-2 text-xs font-semibold uppercase tracking-widest transition-all"
                  >
                    + Buy Extra Entries ($5 each)
                  </button>
                </form>
              )}
            </div>

            {/* Entries list */}
            <div className="border border-white/10 bg-white/[0.03] p-5 flex-1">
              <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-3 font-semibold">
                On the Wheel ({entries.length})
              </div>
              {entries.length === 0 ? (
                <div className="text-white/30 text-sm text-center py-6">No entries yet. Be the first!</div>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {entries.map((entry, i) => (
                    <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                        />
                        <span className="text-sm text-white/80 truncate">{entry.name}</span>
                        {entry.isPaid && (
                          <span className="text-xs text-yellow-500 border border-yellow-500/30 px-1 flex-shrink-0">PAID</span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => adminRemoveMutation.mutate({ entryId: entry.id })}
                          className="text-white/20 hover:text-red-500 transition-colors ml-2 flex-shrink-0 text-xs"
                          title="Remove"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs text-red-500 uppercase tracking-[0.3em] mb-3 font-semibold">How It Works</div>
              <ul className="space-y-2 text-white/50 text-xs leading-relaxed list-none">
                <li>Submit your name once per day for free</li>
                <li>Admin spins the wheel daily at 7 PM</li>
                <li>Winner gets free promo on our platform</li>
                <li>Buy extra entries for more chances ($5 each)</li>
                <li>Wheel resets after each spin</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Paid entries modal */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 p-6 max-w-sm w-full">
            {/* Header */}
            <div className="font-['Anton'] text-2xl mb-1">BUY EXTRA ENTRIES</div>
            <div className="text-white/50 text-sm mb-6">$5 per additional spin on the wheel.</div>

            {/* Instagram CTA */}
            <div className="border border-red-600/30 bg-red-600/5 p-4 mb-6">
              <div className="text-xs text-red-500 uppercase tracking-[0.25em] font-semibold mb-2">How to Purchase</div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">
                DM us on Instagram to purchase extra entries. Let us know your wheel Instagram handle and how many entries you want.
              </p>
              <a
                href="https://www.instagram.com/murdermittenmedia/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white py-3 text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                DM @murdermittenmedia
              </a>
            </div>

            {/* Pricing note */}
            <div className="text-white/30 text-xs leading-relaxed mb-5">
              Pricing: $5 per extra entry &middot; Payment via CashApp, PayPal, or Zelle &middot; Entries added after payment confirmed
            </div>

            <button
              onClick={() => setShowPaidModal(false)}
              className="w-full border border-white/20 text-white/60 hover:text-white py-3 text-sm font-bold uppercase tracking-widest transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
