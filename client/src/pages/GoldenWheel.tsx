/* ============================================================
   GOLDEN WHEEL — Post-Purchase Reward Page
   Design: Dark premium with gold accents
   Fonts: Anton (headlines), DM Sans (body)
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2, Trophy, Gift, Tag, AlertCircle, CheckCircle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Confetti ────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#FFD700", "#D10000", "#FFFFFF", "#FFA500", "#FF6B6B"];
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; rotV: number;
    }> = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotV;
        p.vy += 0.05;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      frame++;
      if (frame < 200) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

// ─── Wheel Segment ───────────────────────────────────────────
interface Prize {
  id: number;
  name: string;
  weight: number;
  rewardType: string;
  rewardValue: string | null;
  description: string | null;
}

function WheelCanvas({
  prizes,
  spinning,
  finalAngle,
  onSpinEnd,
}: {
  prizes: Prize[];
  spinning: boolean;
  finalAngle: number;
  onSpinEnd: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const animRef = useRef<number>(0);
  const [displayAngle, setDisplayAngle] = useState(0);

  const GOLD = "#FFD700";
  const DARK_GOLD = "#B8860B";
  const RED = "#D10000";
  const DARK_RED = "#8B0000";
  const WHITE = "#FFFFFF";
  const DARK = "#1a1a1a";

  const segColors = [
    [RED, DARK_RED],
    [GOLD, DARK_GOLD],
    [RED, DARK_RED],
    [GOLD, DARK_GOLD],
    [RED, DARK_RED],
    [GOLD, DARK_GOLD],
    [RED, DARK_RED],
    [GOLD, DARK_GOLD],
  ];

  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;
    const n = prizes.length;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer ring glow
    const glow = ctx.createRadialGradient(cx, cy, r - 10, cx, cy, r + 8);
    glow.addColorStop(0, "rgba(255,215,0,0.3)");
    glow.addColorStop(1, "rgba(255,215,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    prizes.forEach((prize, i) => {
      const startAngle = angle + i * arc;
      const endAngle = startAngle + arc;
      const [fill, dark] = segColors[i % segColors.length];

      // Segment gradient
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, dark);
      grad.addColorStop(1, fill);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = WHITE;
      ctx.font = `bold ${r > 140 ? 13 : 10}px 'DM Sans', sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      const label = prize.name.length > 18 ? prize.name.slice(0, 16) + "…" : prize.name;
      ctx.fillText(label, r - 14, 5);
      ctx.restore();
    });

    // Center hub
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    hubGrad.addColorStop(0, "#FFD700");
    hubGrad.addColorStop(1, "#B8860B");
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "#080808";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center logo text
    ctx.fillStyle = "#080808";
    ctx.font = "bold 9px 'Anton', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MMM", cx, cy + 3);
  }, [prizes]);

  useEffect(() => {
    drawWheel(displayAngle);
  }, [displayAngle, drawWheel]);

  useEffect(() => {
    if (!spinning) return;
    cancelAnimationFrame(animRef.current);

    const startAngle = angleRef.current;
    const totalRotation = 5 * Math.PI * 2 + finalAngle - (startAngle % (Math.PI * 2));
    const duration = 4000;
    const startTime = performance.now();

    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const current = startAngle + totalRotation * ease(t);
      angleRef.current = current;
      setDisplayAngle(current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onSpinEnd();
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, finalAngle, onSpinEnd]);

  return (
    <div className="relative inline-block">
      {/* Pointer */}
      <div
        className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-10"
        style={{ filter: "drop-shadow(0 0 4px rgba(255,215,0,0.8))" }}
      >
        <svg width="32" height="24" viewBox="0 0 32 24">
          <polygon points="32,12 0,0 6,12 0,24" fill="#FFD700" stroke="#080808" strokeWidth="1.5" />
        </svg>
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="rounded-full"
        style={{ filter: "drop-shadow(0 0 20px rgba(255,215,0,0.3))" }}
      />
    </div>
  );
}

// ─── Prize Reveal Card ────────────────────────────────────────
function PrizeReveal({
  prizeName,
  prizeDescription,
  rewardType,
  couponCode,
  onCopy,
  copied,
}: {
  prizeName: string;
  prizeDescription: string | null;
  rewardType: string;
  couponCode: string | null;
  onCopy: () => void;
  copied: boolean;
}) {
  const icon = rewardType === "stripe_coupon" ? <Tag className="w-8 h-8 text-yellow-400" /> :
    rewardType === "physical_item" ? <Gift className="w-8 h-8 text-yellow-400" /> :
    rewardType === "cash_prize" ? <Trophy className="w-8 h-8 text-yellow-400" /> :
    <CheckCircle className="w-8 h-8 text-yellow-400" />;

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="relative border-2 border-yellow-500 bg-gradient-to-b from-yellow-950/60 to-black/80 rounded-2xl p-8 text-center space-y-4"
        style={{ boxShadow: "0 0 40px rgba(255,215,0,0.25), inset 0 0 40px rgba(255,215,0,0.05)" }}
      >
        {/* Glow ring */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 opacity-20 blur-sm pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex justify-center">{icon}</div>
          <p className="text-yellow-400 text-xs uppercase tracking-[0.3em] font-semibold">You Won</p>
          <h2 className="font-['Anton'] text-3xl md:text-4xl text-white uppercase leading-tight">
            {prizeName}
          </h2>
          {prizeDescription && (
            <p className="text-white/60 text-sm leading-relaxed">{prizeDescription}</p>
          )}

          {couponCode && rewardType === "stripe_coupon" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-white/50 uppercase tracking-widest">Your Discount Code</p>
              <div className="flex items-center gap-2 bg-black/60 border border-yellow-500/40 rounded-lg px-4 py-3">
                <code className="flex-1 text-yellow-400 font-mono text-lg font-bold tracking-widest text-center">
                  {couponCode}
                </code>
                <button
                  onClick={onCopy}
                  className="text-white/50 hover:text-yellow-400 transition-colors p-1"
                  title="Copy code"
                >
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-white/40">Use at checkout on your next order</p>
              <Button
                onClick={() => window.open("/merch", "_self")}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-widest"
              >
                Shop Now <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {couponCode && rewardType !== "stripe_coupon" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-white/50 uppercase tracking-widest">Your Reward Code</p>
              <div className="flex items-center gap-2 bg-black/60 border border-yellow-500/40 rounded-lg px-4 py-3">
                <code className="flex-1 text-yellow-400 font-mono text-sm font-bold tracking-widest text-center">
                  {couponCode}
                </code>
                <button onClick={onCopy} className="text-white/50 hover:text-yellow-400 transition-colors p-1">
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-white/40">
                {rewardType === "physical_item"
                  ? "Our team will reach out to arrange delivery."
                  : "Our team will reach out within 24 hours to fulfill your reward."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function GoldenWheel() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<"loading" | "ineligible" | "eligible" | "spinning" | "reveal" | "already_spun">("loading");
  const [spinning, setSpinning] = useState(false);
  const [finalAngle, setFinalAngle] = useState(0);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [alreadySpunData, setAlreadySpunData] = useState<{ prizeNameSnapshot: string; couponCode: string | null } | null>(null);

  const eligibilityQuery = trpc.goldenWheel.getEligibility.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 3000,
  });

  const prizesQuery = trpc.goldenWheel.getPrizes.useQuery();
  const prizes = prizesQuery.data ?? [];

  const spinMutation = trpc.goldenWheel.spin.useMutation();

  // Determine phase from eligibility
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setPhase("ineligible"); return; }
    if (eligibilityQuery.isLoading) return;

    const data = eligibilityQuery.data;
    if (!data) return;

    if (data.status === "CLAIMED" && data.spin) {
      setAlreadySpunData({ prizeNameSnapshot: data.spin.prizeNameSnapshot, couponCode: data.spin.couponCode });
      setPhase("already_spun");
    } else if (data.eligible) {
      setPhase("eligible");
    } else {
      setPhase("ineligible");
    }
  }, [authLoading, user, eligibilityQuery.data, eligibilityQuery.isLoading]);

  const handleSpin = async () => {
    if (spinning || prizes.length === 0) return;
    setPhase("spinning");
    setSpinning(true);

    // Calculate the angle for the winning segment BEFORE calling the API
    // We'll call the API and use the returned prize to set the angle
    try {
      const result = await spinMutation.mutateAsync();
      if (result.alreadySpun && result.spin) {
        setAlreadySpunData({ prizeNameSnapshot: result.spin.prizeNameSnapshot, couponCode: result.spin.couponCode });
        setSpinning(false);
        setPhase("already_spun");
        return;
      }

      const prize = result.prize;
      if (!prize) { setSpinning(false); setPhase("ineligible"); return; }

      // Find the index of the winning prize
      const prizeIdx = prizes.findIndex(p => p.id === prize.id);
      const n = prizes.length;
      const arc = (2 * Math.PI) / n;
      // Target angle: center of the winning segment points to the top (pointer at right = -Math.PI/2 from top)
      // Pointer is at the right (3 o'clock), so we want the segment center to be at 0 radians
      const segCenter = prizeIdx * arc + arc / 2;
      // We want segCenter to land at 0 (pointer position), so final angle offset = -segCenter
      const targetFinalAngle = -segCenter + (Math.random() - 0.5) * (arc * 0.6);

      setWonPrize(prize as Prize);
      setCouponCode(result.spin?.couponCode ?? null);
      setFinalAngle(targetFinalAngle);
    } catch (err: any) {
      console.error("[GoldenWheel] Spin error:", err);
      setSpinning(false);
      setPhase("eligible");
    }
  };

  const handleSpinEnd = useCallback(() => {
    setSpinning(false);
    setConfetti(true);
    setPhase("reveal");
    setTimeout(() => setConfetti(false), 5000);
  }, []);

  const handleCopy = () => {
    if (couponCode) {
      navigator.clipboard.writeText(couponCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />
      <Confetti active={confetti} />

      {/* Hero Header */}
      <section className="pt-24 pb-8 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-yellow-500/10 blur-3xl" />
        </div>
        <div className="relative z-10 space-y-2">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.4em] font-semibold">Exclusive Reward</p>
          <h1 className="font-['Anton'] text-4xl md:text-6xl uppercase text-white">
            The Golden <span className="text-yellow-400">Wheel</span>
          </h1>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            First-time buyers spin for exclusive prizes — discount codes, free merch, and more.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-24 px-4">
        <div className="max-w-lg mx-auto space-y-8">

          {/* Loading */}
          {(phase === "loading" || eligibilityQuery.isLoading) && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
              <p className="text-white/50 text-sm">Checking eligibility...</p>
            </div>
          )}

          {/* Not logged in */}
          {phase === "ineligible" && !user && !authLoading && (
            <div className="text-center space-y-6 py-8">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto" />
              <div className="space-y-2">
                <h2 className="font-['Anton'] text-2xl uppercase">Login Required</h2>
                <p className="text-white/50 text-sm">Sign in to check if you're eligible to spin.</p>
              </div>
              <Button
                onClick={() => window.location.href = getLoginUrl("/golden-wheel")}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-widest px-8"
              >
                Sign In
              </Button>
            </div>
          )}

          {/* Ineligible (logged in but no purchase) */}
          {phase === "ineligible" && user && !authLoading && (
            <div className="text-center space-y-6 py-8">
              <div
                className="border border-white/10 bg-white/5 rounded-2xl p-8 space-y-4"
                style={{ boxShadow: "0 0 40px rgba(255,215,0,0.05)" }}
              >
                <Trophy className="w-16 h-16 text-yellow-500/40 mx-auto" />
                <h2 className="font-['Anton'] text-2xl uppercase">Not Yet Eligible</h2>
                <p className="text-white/50 text-sm leading-relaxed">
                  The Golden Wheel is unlocked after your <strong className="text-white">first merch purchase</strong> from Murder Mitten Media.
                  Complete a purchase to earn your spin.
                </p>
                <Button
                  onClick={() => setLocation("/merch")}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest px-8"
                >
                  Shop Merch
                </Button>
              </div>
            </div>
          )}

          {/* Eligible — show wheel */}
          {(phase === "eligible" || phase === "spinning") && prizes.length > 0 && (
            <div className="flex flex-col items-center space-y-8">
              {/* Eligibility badge */}
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 text-xs uppercase tracking-widest font-semibold">
                  You're Eligible — 1 Spin Available
                </span>
              </div>

              {/* Wheel */}
              <WheelCanvas
                prizes={prizes}
                spinning={spinning}
                finalAngle={finalAngle}
                onSpinEnd={handleSpinEnd}
              />

              {/* Spin button */}
              <button
                onClick={handleSpin}
                disabled={spinning || phase === "spinning"}
                className={`
                  relative px-12 py-4 font-['Anton'] text-xl uppercase tracking-widest
                  transition-all duration-300
                  ${spinning
                    ? "bg-yellow-800 text-yellow-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:from-yellow-500 hover:to-yellow-300 hover:scale-105 active:scale-95"
                  }
                `}
                style={!spinning ? { boxShadow: "0 0 30px rgba(255,215,0,0.4)" } : {}}
              >
                {spinning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Spinning...
                  </span>
                ) : "Spin the Wheel"}
              </button>

              <p className="text-white/30 text-xs text-center">
                One spin per customer. Results are final.
              </p>
            </div>
          )}

          {/* Prize Reveal */}
          {phase === "reveal" && wonPrize && (
            <div className="flex flex-col items-center space-y-8">
              <div className="text-center space-y-2">
                <p className="text-yellow-400 text-xs uppercase tracking-[0.3em] animate-pulse">🎉 Congratulations!</p>
                <h2 className="font-['Anton'] text-3xl uppercase">You Won!</h2>
              </div>
              <PrizeReveal
                prizeName={wonPrize.name}
                prizeDescription={wonPrize.description}
                rewardType={wonPrize.rewardType}
                couponCode={couponCode}
                onCopy={handleCopy}
                copied={copied}
              />
              <div className="flex gap-4 w-full max-w-sm">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="flex-1 border-white/20 text-white/70 hover:text-white"
                >
                  Back Home
                </Button>
                <Button
                  onClick={() => setLocation("/merch")}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold uppercase"
                >
                  Shop More
                </Button>
              </div>
            </div>
          )}

          {/* Already spun */}
          {phase === "already_spun" && alreadySpunData && (
            <div className="flex flex-col items-center space-y-6 py-4">
              <CheckCircle className="w-16 h-16 text-yellow-500" />
              <div className="text-center space-y-2">
                <h2 className="font-['Anton'] text-2xl uppercase">Already Claimed</h2>
                <p className="text-white/50 text-sm">You already spun the Golden Wheel.</p>
              </div>
              <div
                className="w-full max-w-md border border-yellow-500/30 bg-yellow-950/30 rounded-2xl p-6 text-center space-y-3"
              >
                <p className="text-yellow-400 text-xs uppercase tracking-widest">Your Prize</p>
                <p className="font-['Anton'] text-2xl text-white uppercase">{alreadySpunData.prizeNameSnapshot}</p>
                {alreadySpunData.couponCode && (
                  <div className="space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-widest">Your Code</p>
                    <div className="flex items-center gap-2 bg-black/60 border border-yellow-500/30 rounded-lg px-4 py-3">
                      <code className="flex-1 text-yellow-400 font-mono font-bold tracking-widest text-center">
                        {alreadySpunData.couponCode}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(alreadySpunData.couponCode!).catch(() => {});
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-white/40 hover:text-yellow-400 transition-colors"
                      >
                        {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={() => setLocation("/merch")}
                className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest px-8"
              >
                Shop Merch
              </Button>
            </div>
          )}

          {/* No prizes configured */}
          {phase === "eligible" && prizes.length === 0 && !prizesQuery.isLoading && (
            <div className="text-center py-8 text-white/40">
              <p>No prizes available right now. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
