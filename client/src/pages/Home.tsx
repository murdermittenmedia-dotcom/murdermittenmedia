/* ============================================================
   MURDER MITTEN MEDIA -- Home Page (Clean Premium Redesign)
   Layout: Hero → Artist of the Week → Content Sections → Social
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

// --- Intersection observer ------------------------------------
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// --- Animated counter -----------------------------------------
function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function Stat({ value, label, delay, started }: { value: number; label: string; delay: number; started: boolean }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (started) { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t); }
  }, [started, delay]);
  const count = useCountUp(value, 2000, go);
  const display = value >= 1_000_000
    ? (count / 1_000_000).toFixed(1) + "M"
    : value >= 1_000
    ? (count / 1_000).toFixed(1) + "K"
    : count.toString();
  return (
    <div>
      <div className="font-['Anton'] text-4xl md:text-5xl text-white">{display}</div>
      <div className="text-white/40 text-xs uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

// --- Main -----------------------------------------------------
export default function Home() {
  const { ref: statsRef, inView: statsInView } = useInView(0.2);
  const { ref: sectionsRef, inView: sectionsInView } = useInView(0.1);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />

      {/* ══════════════════════════════════════════════════════
          HERO -- Clean, focused, breathing room
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex items-center"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663536856749/C3bFVoBEaMVXmYZLRysziz/mmm_hero_bg-66MWLcQYqB72u822gRXedg.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/90 to-[#080808]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/40" />

        <div className="container relative z-10 pt-28 pb-20">
          <div className="max-w-2xl">

            {/* Origin tag */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              <span className="text-white/40 text-xs uppercase tracking-[0.25em]">Detroit, MI · Est. 2022</span>
            </div>

            {/* Logo + Name */}
            <div className="flex items-center gap-5 mb-8">
              <img
                src={LOGO}
                alt="Murder Mitten Media"
                className="w-20 h-20 rounded-full object-cover border border-red-600/30 shadow-[0_0_30px_rgba(209,0,0,0.2)]"
              />
              <div>
                <h1 className="font-['Anton'] text-5xl md:text-6xl lg:text-7xl uppercase leading-none tracking-wide">
                  MURDER MITTEN<br />
                  <span className="text-red-600">MEDIA</span>
                </h1>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed mb-10 border-l-2 border-red-600 pl-4">
              Where the Industry Watches the Trenches.<br />
              <span className="text-white/30 text-base">Rap · Culture · Viral Content · Detroit</span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.instagram.com/murdermittenmedia/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white px-7 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_25px_rgba(209,0,0,0.4)]"
              >
                Follow on Instagram
              </a>
              <Link
                href="/promo"
                className="border border-white/20 text-white/70 hover:border-red-600 hover:text-red-500 px-7 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
              >
                Buy Promo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          STATS BAR -- Minimal, clean
      ══════════════════════════════════════════════════════ */}
      <section
        ref={statsRef as React.RefObject<HTMLElement>}
        className="border-y border-white/10 py-10 bg-[#0d0d0d]"
      >
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-white/10">
            {[
              { value: 4500000, label: "Monthly Views", delay: 0 },
              { value: 45800, label: "Followers", delay: 120 },
              { value: 228600, label: "Interactions / Mo", delay: 240 },
              { value: 2680, label: "Posts Published", delay: 360 },
            ].map(s => (
              <div key={s.label} className="md:px-8 first:pl-0 last:pr-0">
                <Stat value={s.value} label={s.label} delay={s.delay} started={statsInView} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ARTIST OF THE WEEK -- Full-width feature, top billing
      ══════════════════════════════════════════════════════ */}
      <section className="py-20 relative overflow-hidden">
        {/* Background image from CEO Stew video */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://img.youtube.com/vi/1bgjhsoC5AI/maxresdefault.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/95 to-[#080808]/70" />

        <div className="container relative z-10">
          {/* Section label */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-semibold">⭐ Artist of the Week</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Feature card */}
          <div className="grid md:grid-cols-2 gap-0 border border-white/10 overflow-hidden">
            {/* Video thumbnails side */}
            <div className="relative bg-black">
              <div className="grid grid-cols-2 gap-0.5">
                {["1bgjhsoC5AI", "5bJS_HG1XyI", "3E8WSjpXXRo", "Ot_QoWLhBdI"].map((id, i) => (
                  <a
                    key={id}
                    href={`https://www.youtube.com/watch?v=${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-video overflow-hidden group"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
                      alt={`CEO Stew video ${i + 1}`}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                        <span className="text-white text-xs ml-0.5">▶</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Text side */}
            <div className="p-8 md:p-12 bg-[#0d0d0d] flex flex-col justify-center">
              <div className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">
                Money Bag Boys · Eastside Detroit
              </div>
              <h2 className="font-['Anton'] text-6xl md:text-7xl uppercase leading-none mb-4">
                CEO<br /><span className="text-red-600">STEW</span>
              </h2>
              <p className="text-white/50 leading-relaxed mb-8 text-sm">
                One of Detroit's most consistent voices right now. CEO Stew brings raw Eastside energy with
                polished delivery -- a member of Money Bag Boys who is quickly building his own lane in Michigan rap.
                This week we put the spotlight on him.
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Detroit", "Money Bag Boys", "Eastside", "Michigan Rap"].map(tag => (
                  <span key={tag} className="text-xs border border-white/10 text-white/30 px-3 py-1 uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href="/artist-of-the-week"
                className="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_25px_rgba(209,0,0,0.4)] self-start"
              >
                Read the Full Feature
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CONTENT SECTIONS -- Clean 2-col grid, no clutter
      ══════════════════════════════════════════════════════ */}
      <section
        ref={sectionsRef as React.RefObject<HTMLElement>}
        className="py-20 border-t border-white/10"
      >
        <div className="container">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-semibold">What We Do</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: "🎤",
                title: "Murder Mitten Mic",
                desc: "Raw one-mic performances from Michigan's hottest artists. No studio tricks -- just bars.",
                href: "/mic",
                cta: "Watch Performances",
                accent: "border-red-600/30",
              },
              {
                icon: "🎙",
                title: "Meeting with the Mitten",
                desc: "15 in-depth interviews with Michigan artists, producers, and culture figures. Real talk, no filter.",
                href: "/podcast",
                cta: "Listen to Episodes",
                accent: "border-zinc-600/30",
              },
              {
                icon: "⚔️",
                title: "Music Wars",
                desc: "Head-to-head bracket battles. Spin the wheel. Win prizes. Get your music heard by thousands.",
                href: "/music-wars",
                cta: "Enter the Battle",
                accent: "border-orange-600/30",
              },
              {
                icon: "📺",
                title: "Live Stream",
                desc: "Catch us live on YouTube via Streamlabs. Music reviews, interviews, and more in real time.",
                href: "/live",
                cta: "Watch Live",
                accent: "border-blue-600/30",
              },
            ].map((s, i) => (
              <Link
                key={s.href}
                href={s.href}
                className={`flex gap-5 p-6 border ${s.accent} bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-600/50 transition-all duration-300 group ${
                  sectionsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${i * 80}ms`, transition: "opacity 0.5s ease, transform 0.5s ease, background 0.3s, border-color 0.3s" }}
              >
                <div className="text-3xl shrink-0 mt-1">{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-['Anton'] text-2xl uppercase mb-2 group-hover:text-red-400 transition-colors">
                    {s.title}
                  </h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-4">{s.desc}</p>
                  <span className="text-xs text-red-500 uppercase tracking-widest group-hover:gap-2 flex items-center gap-1 transition-all">
                    {s.cta} <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Promo -- full width CTA */}
          <Link
            href="/promo"
            className={`mt-4 flex items-center justify-between p-6 border border-green-600/20 bg-green-950/10 hover:bg-green-950/20 hover:border-green-600/40 transition-all duration-300 group ${
              sectionsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "400ms", transition: "opacity 0.5s ease, transform 0.5s ease, background 0.3s, border-color 0.3s" }}
          >
            <div className="flex items-center gap-5">
              <span className="text-3xl">📈</span>
              <div>
                <h3 className="font-['Anton'] text-2xl uppercase group-hover:text-green-400 transition-colors">
                  Buy Promo
                </h3>
                <p className="text-white/40 text-sm">
                  Get your music in front of 45K+ followers. Packages from $10 -- skip the line for $10.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-3 text-green-500 text-sm uppercase tracking-widest">
              <span className="hidden md:block">View Packages</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MUSIC REVIEW QUEUE -- Standalone CTA
      ══════════════════════════════════════════════════════ */}
      <section className="py-16 border-t border-white/10 bg-[#0d0d0d]">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px bg-red-600" />
                <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-semibold">Submit Your Music</span>
              </div>
              <h2 className="font-['Anton'] text-5xl uppercase leading-tight mb-4">
                MUSIC<br /><span className="text-red-600">REVIEW</span><br />QUEUE
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                Submit your track for a live review on stream. Upload a file or drop a YouTube link.
                See exactly where you are in line -- and skip to the front for just $10.
              </p>
              <Link
                href="/review"
                className="inline-block bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
              >
                Submit Your Track →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Submit", icon: "📤", desc: "Upload or YouTube link" },
                { label: "Wait in Line", icon: "📋", desc: "Live queue tracker" },
                { label: "Skip for $10", icon: "⚡", desc: "Jump to the front" },
              ].map(step => (
                <div key={step.label} className="border border-white/10 p-4 text-center bg-white/[0.02]">
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="font-['Anton'] text-sm uppercase text-white mb-1">{step.label}</div>
                  <div className="text-white/30 text-xs">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CONNECT -- Minimal social links
      ══════════════════════════════════════════════════════ */}
      <section className="py-20 border-t border-white/10">
        <div className="container">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-semibold">Follow the Movement</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { platform: "Instagram", handle: "@murdermittenmedia", stat: "45.8K followers", url: "https://www.instagram.com/murdermittenmedia/", icon: "📸" },
              { platform: "YouTube", handle: "@MurderMittenMedia", stat: "Videos & Live Streams", url: "https://youtube.com/@MurderMittenMedia", icon: "▶" },
              { platform: "Discord", handle: "Music Wars Server", stat: "Battles & Community", url: "https://discord.gg/hZUPZzx7", icon: "🎮" },
            ].map(s => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 border border-white/10 hover:border-red-600/40 hover:bg-white/[0.03] transition-all group"
              >
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <div className="font-semibold text-sm group-hover:text-red-400 transition-colors">{s.platform}</div>
                  <div className="text-white/40 text-xs">{s.handle}</div>
                  <div className="text-white/25 text-xs mt-0.5">{s.stat}</div>
                </div>
                <span className="ml-auto text-white/20 group-hover:text-red-500 group-hover:translate-x-1 transition-all">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/10 py-8 bg-[#050505]">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-9 h-9 rounded-full object-cover" />
            <span className="font-['Anton'] text-base tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </div>
          <div className="text-white/20 text-xs text-center">
            © 2022-{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI · All Rights Reserved
          </div>
          <div className="flex items-center gap-5 text-xs text-white/25 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">IG</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YT</a>
            <a href="https://discord.gg/hZUPZzx7" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
