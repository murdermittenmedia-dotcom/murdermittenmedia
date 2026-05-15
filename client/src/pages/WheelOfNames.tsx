/* ============================================================
   MURDER MITTEN MEDIA — Daily Prize Wheel
   One spin per user per day (resets midnight EST).
   No name submission — just click Spin.
   Weighted prizes rendered on a canvas wheel.
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";

// ─── Prize definitions (must match server order exactly) ─────
const PRIZES = [
  { key: "free_story_post",  label: "Free Story Post",         color: "#D10000", textColor: "#fff" },
  { key: "bogo_permanent",   label: "BOGO Permanent Post",     color: "#1a1a1a", textColor: "#D10000" },
  { key: "free_page_post",   label: "Free Page Post",          color: "#8B0000", textColor: "#fff" },
  { key: "line_skip",        label: "Line Skip",               color: "#2d2d2d", textColor: "#D10000" },
  { key: "promo_20off",      label: "20% Off Promo",           color: "#FF2222", textColor: "#fff" },
  { key: "promo_10off",      label: "10% Off Promo",           color: "#111111", textColor: "#fff" },
  { key: "unlimited_promo",  label: "1-Month Unlimited Promo", color: "#C8A000", textColor: "#000" },
  { key: "try_again",        label: "Try Again Tomorrow",      color: "#333333", textColor: "#aaa" },
];

// ─── Prize descriptions ───────────────────────────────────────
const PRIZE_DESCRIPTIONS: Record<string, string> = {
  free_story_post:  "A free Instagram story post on Murder Mitten Media — DM us to redeem!",
  bogo_permanent:   "Buy one permanent post, get one free — DM us to redeem!",
  free_page_post:   "A free permanent page post on Murder Mitten Media — DM us to redeem!",
  line_skip:        "Skip the line on your next Music Review submission — DM us to redeem!",
  promo_20off:      "20% off your next promo package — DM us to redeem!",
  promo_10off:      "10% off your next promo package — DM us to redeem!",
  unlimited_promo:  "One month of unlimited promo posts — DM us to redeem! (Rare prize!)",
  try_again:        "No prize today — come back tomorrow for another spin!",
};

// ─── Countdown to midnight EST ───────────────────────────────
function useMidnightCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      // Get current time in EST
      const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const midnight = new Date(estNow);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - estNow.getTime();
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

// ─── Easing ───────────────────────────────────────────────────
function easeOutQuintic(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

// ─── Canvas wheel ─────────────────────────────────────────────
interface WheelCanvasProps {
  targetIndex: number | null;   // null = idle
  spinning: boolean;
  onSpinComplete: () => void;
}

function WheelCanvas({ targetIndex, spinning, onSpinComplete }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const SPIN_DURATION = 5000; // ms
  const SEG = (2 * Math.PI) / PRIZES.length;

  const draw = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer glow ring
    ctx.save();
    ctx.shadowColor = "#D10000";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "#D10000";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Segments
    for (let i = 0; i < PRIZES.length; i++) {
      const startAngle = rotation + i * SEG;
      const endAngle = startAngle + SEG;
      const prize = PRIZES[i];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "#080808";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + SEG / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = prize.textColor;
      const fontSize = Math.max(10, Math.min(13, r * 0.11));
      ctx.font = `bold ${fontSize}px 'DM Sans', sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      // Wrap long labels
      const words = prize.label.split(" ");
      if (words.length <= 2) {
        ctx.fillText(prize.label, r - 12, 4);
      } else {
        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
        const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");
        ctx.fillText(line1, r - 12, -3);
        ctx.fillText(line2, r - 12, 10);
      }
      ctx.restore();
    }

    // Center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "#080808";
    ctx.fill();
    ctx.strokeStyle = "#D10000";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center logo text
    ctx.fillStyle = "#D10000";
    ctx.font = "bold 10px 'Anton', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MMM", cx, cy);
  }, [SEG]);

  // Draw idle wheel
  useEffect(() => {
    draw(angleRef.current);
  }, [draw]);

  // Spin animation
  useEffect(() => {
    if (!spinning || targetIndex === null) return;

    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = performance.now();

    // Calculate target angle: land pointer (top = -π/2) on the center of targetIndex segment
    const currentAngle = angleRef.current % (2 * Math.PI);
    // The pointer is at top (-π/2). Segment i starts at rotation + i*SEG.
    // We want the center of segment targetIndex to be at -π/2.
    // Center of segment i in wheel coords: i*SEG + SEG/2
    // We need: rotation + i*SEG + SEG/2 ≡ -π/2 (mod 2π)
    // rotation = -π/2 - i*SEG - SEG/2
    const targetAngle = -Math.PI / 2 - targetIndex * SEG - SEG / 2;
    // Normalize to be > currentAngle + 5 full rotations
    const minSpins = 5 * 2 * Math.PI;
    let delta = ((targetAngle - currentAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    if (delta < 0.1) delta += 2 * Math.PI;
    const totalDelta = minSpins + delta;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      const eased = easeOutQuintic(progress);
      angleRef.current = currentAngle + totalDelta * eased;
      draw(angleRef.current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        angleRef.current = currentAngle + totalDelta;
        draw(angleRef.current);
        onSpinComplete();
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, targetIndex, draw, onSpinComplete, SEG]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Pointer arrow at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
        style={{ marginTop: "-2px" }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "24px solid #D10000",
            filter: "drop-shadow(0 2px 4px rgba(209,0,0,0.6))",
          }}
        />
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className="rounded-full"
        style={{ display: "block" }}
      />
    </div>
  );
}

// ─── Prize badge ──────────────────────────────────────────────
function PrizeBadge({ prizeKey }: { prizeKey: string }) {
  const prize = PRIZES.find(p => p.key === prizeKey);
  if (!prize) return null;
  const isGold = prizeKey === "unlimited_promo";
  const isTryAgain = prizeKey === "try_again";
  return (
    <div
      className={`border-2 rounded-lg px-6 py-4 text-center ${
        isGold
          ? "border-yellow-400 bg-yellow-900/30"
          : isTryAgain
          ? "border-white/20 bg-white/5"
          : "border-red-600 bg-red-900/20"
      }`}
    >
      <div className={`text-2xl font-['Anton'] uppercase mb-1 ${isGold ? "text-yellow-400" : isTryAgain ? "text-white/50" : "text-red-400"}`}>
        {isGold && "🏆 "}
        {prize.label}
        {isGold && " 🏆"}
      </div>
      <p className="text-white/60 text-sm">{PRIZE_DESCRIPTIONS[prizeKey]}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function WheelOfNames() {
  const { user, loading: authLoading } = useAuth();
  const countdown = useMidnightCountdown();

  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [wonPrize, setWonPrize] = useState<{ key: string; label: string } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = trpc.dailyWheel.getMyStatus.useQuery(
    undefined,
    { enabled: !!user }
  );

  const spinMutation = trpc.dailyWheel.spin.useMutation({
    onSuccess: (data) => {
      setTargetIndex(data.prizeIndex);
      setWonPrize(data.prize);
      setSpinning(true);
    },
    onError: (err) => {
      setSpinning(false);
      toast.error(err.message);
    },
  });

  const handleSpin = () => {
    if (spinning || spinMutation.isPending) return;
    setShowResult(false);
    spinMutation.mutate();
  };

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    setShowResult(true);
    refetchStatus();
    if (wonPrize && wonPrize.key !== "try_again") {
      toast.success(`You won: ${wonPrize.label}! DM us on Instagram to redeem.`, { duration: 8000 });
    } else if (wonPrize?.key === "try_again") {
      toast("Better luck tomorrow!", { duration: 5000 });
    }
  }, [wonPrize, refetchStatus]);

  const hasSpunToday = status?.hasSpunToday ?? false;
  const todayPrize = status?.prize ?? null;

  // If already spun today, show the result directly (no re-spin)
  useEffect(() => {
    if (hasSpunToday && todayPrize && !spinning) {
      setWonPrize(todayPrize);
      setShowResult(true);
    }
  }, [hasSpunToday, todayPrize, spinning]);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <div className="container pt-24 pb-16 max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">Daily Prize</span>
          </div>
          <h1 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-2">
            DAILY <span className="text-red-600">WHEEL</span>
          </h1>
          <p className="text-white/50 text-sm">
            One free spin per day. Resets at midnight EST.
          </p>
        </div>

        {/* Wheel */}
        <div className="flex justify-center mb-6">
          <WheelCanvas
            targetIndex={hasSpunToday && todayPrize ? PRIZES.findIndex(p => p.key === todayPrize.key) : targetIndex}
            spinning={spinning}
            onSpinComplete={handleSpinComplete}
          />
        </div>

        {/* CTA / Status */}
        <div className="text-center mb-6">
          {authLoading || statusLoading ? (
            <div className="text-white/40 text-sm">Loading…</div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-white/50 text-sm">Login to spin the wheel</p>
              <a
                href={getLoginUrl()}
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold uppercase tracking-widest text-sm px-8 py-3 transition-all duration-200 hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
              >
                Login to Spin
              </a>
            </div>
          ) : hasSpunToday ? (
            <div className="space-y-2">
              <p className="text-white/50 text-sm">You already spun today. Next spin in:</p>
              <div className="font-['Anton'] text-3xl text-red-500 tabular-nums">{countdown}</div>
            </div>
          ) : (
            <button
              onClick={handleSpin}
              disabled={spinning || spinMutation.isPending}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold uppercase tracking-widest text-sm px-12 py-4 transition-all duration-200 hover:shadow-[0_0_24px_rgba(209,0,0,0.5)] text-lg"
            >
              {spinning ? "Spinning…" : "SPIN NOW"}
            </button>
          )}
        </div>

        {/* Prize result */}
        {showResult && wonPrize && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PrizeBadge prizeKey={wonPrize.key} />
            {wonPrize.key !== "try_again" && (
              <p className="text-center text-white/40 text-xs mt-3">
                DM{" "}
                <a
                  href="https://www.instagram.com/murdermittenmedia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300"
                >
                  @murdermittenmedia
                </a>{" "}
                on Instagram to redeem your prize.
              </p>
            )}
          </div>
        )}

        {/* Prize odds table */}
        <div className="mt-10 border border-white/10 bg-white/[0.02] p-5">
          <h2 className="font-['Anton'] text-lg uppercase text-white/60 mb-4 tracking-wider">Prize Odds</h2>
          <div className="space-y-2">
            {[
              { label: "10% Off Promo",           pct: "25%", rare: false },
              { label: "Try Again Tomorrow",       pct: "20%", rare: false },
              { label: "Free Story Post",          pct: "20%", rare: false },
              { label: "BOGO Permanent Post",      pct: "15%", rare: false },
              { label: "Music Review Line Skip",   pct: "10%", rare: false },
              { label: "20% Off Promo",            pct: "4%",  rare: false },
              { label: "Free Page Post",           pct: "4%",  rare: false },
              { label: "1-Month Unlimited Promo",  pct: "<1%", rare: true  },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className={row.rare ? "text-yellow-400 font-semibold" : "text-white/60"}>{row.label}</span>
                <span className={row.rare ? "text-yellow-400 font-bold" : "text-white/30"}>{row.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
