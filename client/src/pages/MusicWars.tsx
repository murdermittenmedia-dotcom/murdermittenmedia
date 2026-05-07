/* ============================================================
   MURDER MITTEN MEDIA -- Music Wars Page
   Head-to-head battle competition with spin wheel & bracket
   Discord: https://discord.gg/hZUPZzx7
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const DISCORD_URL = "https://discord.gg/hZUPZzx7";

const PAST_WARS = [
  {
    title: "Music Wars Finale / Music Reviews",
    videoId: "w-AUisgyF74",
    views: "318",
    duration: "2:48:06",
    badge: "Finale",
  },
  {
    title: "Music Wars Feat. YSR Gramz -- Round 2",
    videoId: "vPIdlU0eT-0",
    views: "678",
    duration: "4:14:02",
    badge: "Round 2",
  },
  {
    title: "Music Wars Round 1",
    videoId: "S7G-wYBNHZo",
    views: "597",
    duration: "4:01:32",
    badge: "Round 1",
  },
  {
    title: "Music Wars -- Winner Gets a YSR Gramz Feature",
    videoId: "QgmYCIpZjAE",
    views: "77",
    duration: "3:35:17",
    badge: "Special",
  },
  {
    title: "Music Wars -- Winner Gets a YSR Gramz Feature",
    videoId: "_ZDcvvO7rI4",
    views: "150",
    duration: "2:20:38",
    badge: "Special",
  },
];

const PRIZES = [
  { icon: "🎤", title: "Artist Feature", desc: "Win a feature with a top Michigan artist like YSR Gramz" },
  { icon: "📢", title: "Promo Package", desc: "Full Murder Mitten Media promo blast across all platforms" },
  { icon: "🤝", title: "Collab Opportunities", desc: "Connect with other artists and producers in the network" },
  { icon: "👂", title: "Get Heard", desc: "Your music played live in front of thousands of viewers" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Join the Discord", desc: "Sign up at discord.gg/hZUPZzx7 and register your name for the next Music Wars event." },
  { step: "02", title: "Names Go on the Wheel", desc: "All registered artists are added to the spin wheel. The wheel decides your matchup -- no seeding, pure random." },
  { step: "03", title: "Head-to-Head Battles", desc: "You and your opponent each submit a track. The audience votes live. Loser is eliminated, winner advances." },
  { step: "04", title: "Last One Standing Wins", desc: "Battles continue until one artist remains. The champion takes home the prize and gets their music heard by thousands." },
];

// --- Spin Wheel Component -------------------------------------
function SpinWheel({ names }: { names: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number>(0);

  const COLORS = [
    "#D10000", "#8B0000", "#C0392B", "#922B21",
    "#B03A2E", "#7B241C", "#A93226", "#641E16",
  ];

  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 10;
    const n = names.length;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw segments
    for (let i = 0; i < n; i++) {
      const start = angle + i * arc;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#080808";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.min(14, 200 / n)}px 'DM Sans', sans-serif`;
      ctx.fillText(names[i].length > 12 ? names[i].slice(0, 12) + "..." : names[i], r - 12, 5);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "#080808";
    ctx.fill();
    ctx.strokeStyle = "#D10000";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pointer (top)
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx - 12, 22);
    ctx.lineTo(cx + 12, 22);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  };

  useEffect(() => {
    drawWheel(angleRef.current);
  }, [names]);

  const spin = () => {
    if (spinning || names.length < 2) return;
    setWinner(null);
    setSpinning(true);
    velocityRef.current = 0.25 + Math.random() * 0.2;

    const animate = () => {
      velocityRef.current *= 0.992;
      angleRef.current += velocityRef.current;
      drawWheel(angleRef.current);

      if (velocityRef.current > 0.002) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        // Determine winner
        const n = names.length;
        const arc = (2 * Math.PI) / n;
        // Pointer is at top (angle = -PI/2 from center), normalize
        const normalized = ((-angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const idx = Math.floor(normalized / arc) % n;
        setWinner(names[idx]);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="rounded-full border-4 border-red-600/40 shadow-[0_0_40px_rgba(209,0,0,0.3)]"
      />
      <button
        onClick={spin}
        disabled={spinning || names.length < 2}
        className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-10 py-3 font-['Anton'] text-xl uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.5)]"
      >
        {spinning ? "Spinning..." : "SPIN THE WHEEL"}
      </button>
      {winner && (
        <div className="text-center border border-red-600/50 bg-red-600/10 px-8 py-4">
          <div className="text-red-400 text-xs uppercase tracking-widest mb-1">Selected</div>
          <div className="font-['Anton'] text-3xl uppercase text-white">{winner}</div>
        </div>
      )}
    </div>
  );
}

// --- Demo wheel names -----------------------------------------
const DEMO_NAMES = ["Artist A", "Artist B", "Artist C", "Artist D", "Artist E", "Artist F", "Artist G", "Artist H"];

export default function MusicWars() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav transparent />

      {/* -- HERO ---------------------------------------------- */}
      <section
        className="relative min-h-[70vh] flex items-center overflow-hidden"
        style={{
          backgroundImage: `url(https://i.ytimg.com/vi/S7G-wYBNHZo/maxresdefault.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />

        <div className="container relative z-10 pt-24 pb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">
                Head-to-Head Competition
              </span>
            </div>
            <h1 className="font-['Anton'] text-6xl md:text-8xl lg:text-[100px] leading-none mb-6 uppercase">
              MURDER<br />
              MITTEN<br />
              <span className="text-red-600">MUSIC WARS</span>
            </h1>
            <div className="border-l-4 border-red-600 pl-4 mb-8">
              <p className="text-white/70 text-lg leading-relaxed">
                Names go on the wheel. Artists go head-to-head. Only one remains.
                Big prizes, collab opportunities, and your music heard by thousands.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(88,101,242,0.5)] flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.127 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Join the Discord
              </a>
              <a
                href="#past-wars"
                className="border border-white/30 text-white/80 hover:border-white hover:text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
              >
                Watch Past Wars ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* -- HOW IT WORKS -------------------------------------- */}
      <section className="py-20 border-t border-white/10">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">The Format</p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
              HOW IT <span className="text-red-600">WORKS</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="border border-white/10 bg-white/[0.02] p-6 relative group hover:border-red-600/40 transition-all">
                <div className="font-['Anton'] text-5xl text-red-600/20 mb-4 group-hover:text-red-600/40 transition-colors">
                  {step.step}
                </div>
                <div className="font-['Anton'] text-xl uppercase mb-2">{step.title}</div>
                <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- SPIN WHEEL DEMO ----------------------------------- */}
      <section className="py-20 bg-white/[0.02] border-y border-white/10">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">The Wheel</p>
              <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-4 leading-tight">
                SPIN TO <span className="text-red-600">DECIDE</span>
              </h2>
              <div className="w-12 h-0.5 bg-red-600 mb-5" />
              <p className="text-white/60 leading-relaxed mb-4">
                Every Music Wars event starts with the spin wheel. All registered artists' names go on the wheel -- no seeding, no favoritism. Pure random matchups.
              </p>
              <p className="text-white/60 leading-relaxed mb-6">
                The wheel decides who battles who. Two artists go head-to-head, the audience votes live, and the loser is eliminated. This is a demo of how the wheel works -- the real wheel runs live on stream.
              </p>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.127 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Register on Discord
              </a>
            </div>
            <div className="flex justify-center">
              <SpinWheel names={DEMO_NAMES} />
            </div>
          </div>
        </div>
      </section>

      {/* -- PRIZES -------------------------------------------- */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Why Compete</p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
              PRIZES & <span className="text-red-600">OPPORTUNITIES</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRIZES.map((prize) => (
              <div key={prize.title} className="border border-white/10 bg-white/[0.02] p-6 text-center hover:border-red-600/40 transition-all group">
                <div className="text-4xl mb-4">{prize.icon}</div>
                <div className="font-['Anton'] text-xl uppercase mb-2 group-hover:text-red-400 transition-colors">{prize.title}</div>
                <p className="text-white/50 text-sm leading-relaxed">{prize.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- PAST WARS ----------------------------------------- */}
      <section id="past-wars" className="py-20 bg-white/[0.02] border-y border-white/10">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Replays</p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
              PAST <span className="text-red-600">MUSIC WARS</span>
            </h2>
          </div>

          {/* Featured video player */}
          {activeVideo && (
            <div className="mb-8 relative aspect-video w-full max-w-4xl mx-auto border border-white/10">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
                title="Music Wars Stream"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
              <button
                onClick={() => setActiveVideo(null)}
                className="absolute top-3 right-3 bg-black/80 text-white/60 hover:text-white px-3 py-1 text-xs uppercase tracking-widest"
              >
                Close ✕
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAST_WARS.map((war) => (
              <button
                key={war.videoId}
                onClick={() => setActiveVideo(war.videoId)}
                className="text-left border border-white/10 bg-white/[0.02] hover:border-red-600/50 hover:bg-white/[0.04] transition-all group overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={`https://i.ytimg.com/vi/${war.videoId}/maxresdefault.jpg`}
                    alt={war.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${war.videoId}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-red-600/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5">
                    {war.duration}
                  </div>
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 uppercase tracking-wider font-semibold">
                    {war.badge}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4">
                  <div className="font-semibold text-white text-sm leading-snug mb-1 group-hover:text-red-400 transition-colors">
                    {war.title}
                  </div>
                  <div className="text-white/30 text-xs">{war.views} views · Murder Mitten Media</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* -- DISCORD CTA --------------------------------------- */}
      <section className="py-20">
        <div className="container max-w-3xl mx-auto text-center">
          <div className="border border-[#5865F2]/30 bg-[#5865F2]/5 p-10">
            <div className="text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.127 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </div>
            <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase mb-3">
              Ready to <span className="text-red-600">Battle?</span>
            </h2>
            <p className="text-white/60 text-lg mb-2">
              Join the Murder Mitten Media Discord to register for the next Music Wars event.
            </p>
            <p className="text-white/40 text-sm mb-8">
              Get notified when the next event drops, connect with other artists, and get your music heard.
            </p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white px-10 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_30px_rgba(88,101,242,0.5)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.127 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Join discord.gg/hZUPZzx7
            </a>
          </div>
        </div>
      </section>

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10">
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
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#5865F2] transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
