/* ============================================================
   MURDER MITTEN MEDIA — Home Page
   Design: Dark Editorial / Premium Street Media
   Colors: #080808 bg, #D10000 crimson, #FFFFFF text
   Fonts: Anton (headlines), DM Sans (body)
   ============================================================ */

import { useEffect, useRef, useState } from "react";

// ─── Animated counter hook ───────────────────────────────────
function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// ─── Intersection observer hook ──────────────────────────────
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
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

// ─── Stat card component ─────────────────────────────────────
function StatCard({
  value, suffix, label, delay, started
}: {
  value: number; suffix: string; label: string; delay: number; started: boolean;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setGo(true), delay);
      return () => clearTimeout(t);
    }
  }, [started, delay]);
  const count = useCountUp(value, 2200, go);

  const display = value >= 1000000
    ? (count / 1000000).toFixed(count >= value ? 1 : 0) + "M"
    : value >= 1000
    ? (count / 1000).toFixed(count >= value ? 1 : 0) + "K"
    : count.toString();

  return (
    <div
      className="flex flex-col items-center justify-center p-8 border border-white/10 bg-white/[0.03] hover:border-red-600/50 transition-all duration-300 group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="stat-number text-5xl md:text-6xl lg:text-7xl mb-2 group-hover:scale-105 transition-transform duration-300">
        {display}{suffix}
      </div>
      <div className="text-white/50 text-sm uppercase tracking-widest font-medium text-center">
        {label}
      </div>
    </div>
  );
}

// ─── Post card component ──────────────────────────────────────
function PostCard({
  caption, link, likes, comments, type
}: {
  caption: string; link: string; likes: number; comments: number; type: string;
}) {
  const truncated = caption.length > 120 ? caption.slice(0, 120) + "…" : caption;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-white/10 bg-white/[0.03] p-5 hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-300 group red-glow-hover"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-red-500 uppercase tracking-widest font-semibold border border-red-600/40 px-2 py-0.5">
          {type === "VIDEO" ? "Video" : type === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
        </span>
      </div>
      <p className="text-white/80 text-sm leading-relaxed mb-4 group-hover:text-white transition-colors">
        {truncated}
      </p>
      <div className="flex items-center gap-4 text-white/40 text-xs">
        <span>❤ {likes.toLocaleString()}</span>
        <span>💬 {comments.toLocaleString()}</span>
        <span className="ml-auto text-red-500 group-hover:translate-x-1 transition-transform">View →</span>
      </div>
    </a>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function Home() {
  const { ref: statsRef, inView: statsInView } = useInView(0.1);
  const { ref: aboutRef, inView: aboutInView } = useInView(0.2);
  const { ref: postsRef, inView: postsInView } = useInView(0.1);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const posts = [
    {
      caption: "Kid L just said the 'talentless rap wave' is over… but is it really though? 👀 For the last few years the game been flooded with fast drops, same flows, catchy but no real substance…",
      link: "https://www.instagram.com/p/DW7yvHVDURj/",
      likes: 0, comments: 0, type: "CAROUSEL_ALBUM"
    },
    {
      caption: "New footage just surfaced showing what really went down inside before everything escalated 👀",
      link: "https://www.instagram.com/p/DW7JKFTkZmV/",
      likes: 293, comments: 31, type: "CAROUSEL_ALBUM"
    },
    {
      caption: "@bigmoney.bigkey wasting ZERO time since touching back down… not even 60 days home and already locked in with @300ent 💯🔥 If you know, you know — 300 don't just stamp anybody.",
      link: "https://www.instagram.com/p/DW7DVqVETHU/",
      likes: 90, comments: 1, type: "CAROUSEL_ALBUM"
    },
    {
      caption: "Babyfxce E just took his performance to another level, hitting the stage with Meta glasses and giving fans a real time POV of what it look like from his eyes.",
      link: "https://www.instagram.com/p/DV_qt_jEaq1/",
      likes: 3234, comments: 41, type: "CAROUSEL_ALBUM"
    },
    {
      caption: "YLG stepping into a whole new lane with his first country record 'Summer Days.' The Michigan artist switching it up and it's already getting attention, even catching a co-sign from Luke Bryan.",
      link: "https://www.instagram.com/p/DWMcyMUEf7N/",
      likes: 56, comments: 7, type: "CAROUSEL_ALBUM"
    },
    {
      caption: "BandGang just dropped a new visual — Detroit staying active. New Single 'Plastic Cup' dropping this week.",
      link: "https://www.instagram.com/p/DWURFYAkb9s/",
      likes: 72, comments: 21, type: "VIDEO"
    },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navScrolled ? "bg-[#080808]/95 backdrop-blur-sm border-b border-white/10" : "bg-transparent"
        }`}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="live-dot" />
            <span className="font-['Anton'] text-xl tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
            <a href="#content" className="hover:text-white transition-colors">Content</a>
            <a href="#connect" className="hover:text-white transition-colors">Connect</a>
          </div>
          <a
            href="https://www.instagram.com/murdermittenmedia/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs uppercase tracking-widest border border-red-600 text-red-500 px-4 py-2 hover:bg-red-600 hover:text-white transition-all duration-200 font-semibold"
          >
            Follow
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663536856749/C3bFVoBEaMVXmYZLRysziz/mmm_hero_bg-66MWLcQYqB72u822gRXedg.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-[#080808]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />

        <div className="container relative z-10 pt-24 pb-16">
          <div className="max-w-3xl">
            {/* Tag */}
            <div className="flex items-center gap-3 mb-6">
              <div className="live-dot" />
              <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">
                Detroit, MI · Est. 2022
              </span>
            </div>

            {/* Main headline */}
            <h1
              className="font-['Anton'] text-6xl md:text-8xl lg:text-[110px] leading-none mb-6 uppercase"
              style={{ textShadow: "0 0 60px rgba(209,0,0,0.2)" }}
            >
              MURDER<br />
              <span className="text-red-600">MITTEN</span><br />
              MEDIA
            </h1>

            {/* Tagline */}
            <div className="red-border-left mb-8">
              <p className="text-white/70 text-lg md:text-xl font-light leading-relaxed">
                Where the Industry Watches the Trenches
              </p>
              <p className="text-white/40 text-sm mt-1">
                Rap · Culture · Viral Content · Brand Owners
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 mb-10">
              {[
                { val: "4.5M+", label: "Monthly Views" },
                { val: "45.8K", label: "Followers" },
                { val: "2,680+", label: "Posts" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="font-['Anton'] text-3xl text-red-600">{s.val}</span>
                  <span className="text-white/40 text-xs uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <a
                href="https://www.instagram.com/murdermittenmedia/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
              >
                Instagram
              </a>
              <a
                href="https://youtube.com/@MurderMittenMedia"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/30 text-white/80 hover:border-white hover:text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all duration-200"
              >
                YouTube
              </a>
            </div>
          </div>
        </div>

        {/* Bottom scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ── ABOUT ───────────────────────────────────────────── */}
      <section id="about" className="py-24 relative overflow-hidden" ref={aboutRef}>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663536856749/C3bFVoBEaMVXmYZLRysziz/mmm_about_bg-djyg8a73UzBCiV6ragAkuV.webp)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[#080808]/80" />

        <div className="container relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div
              className={`transition-all duration-700 ${aboutInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
            >
              <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
                Who We Are
              </p>
              <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase leading-tight mb-6">
                THE VOICE OF<br />
                <span className="text-red-600">MICHIGAN</span><br />
                RAP
              </h2>
              <div className="section-divider mb-6" />
              <p className="text-white/60 leading-relaxed mb-4">
                Murder Mitten Media is Michigan's premier rap and street culture media brand, founded in 2022 out of Detroit. We cover the artists, the stories, and the moments that mainstream media misses.
              </p>
              <p className="text-white/60 leading-relaxed mb-8">
                From viral content to exclusive artist spotlights, we are where the industry comes to watch what's happening in the trenches — and we're growing fast.
              </p>
              <div className="flex flex-wrap gap-3">
                {["Rap", "Culture", "Viral Content", "Detroit", "Michigan", "Brand Owners"].map((tag) => (
                  <span
                    key={tag}
                    className="text-xs border border-white/20 text-white/50 px-3 py-1 uppercase tracking-wider hover:border-red-600/50 hover:text-white/80 transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div
              className={`transition-all duration-700 delay-200 ${aboutInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
            >
              <div className="border border-white/10 p-8 bg-white/[0.03] relative">
                <div className="absolute top-0 left-0 w-12 h-1 bg-red-600" />
                <blockquote className="font-['Anton'] text-3xl md:text-4xl uppercase leading-tight text-white/90 mb-6">
                  "WHERE THE INDUSTRY WATCHES THE TRENCHES"
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center">
                    <span className="text-red-500 font-['Anton'] text-lg">M</span>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Murder Mitten Media ™</div>
                    <div className="text-white/40 text-xs">@murdermittenmedia · Detroit, MI</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section id="stats" className="py-24 relative" ref={statsRef}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663536856749/C3bFVoBEaMVXmYZLRysziz/mmm_stats_bg-CGAfUY5r9E9c4xwcBhxo75.webp)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[#080808]/70" />

        <div className="container relative z-10">
          <div className="text-center mb-16">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
              By the Numbers
            </p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
              THE <span className="text-red-600">REACH</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={4500000} suffix="" label="Monthly Views" delay={0} started={statsInView} />
            <StatCard value={228600} suffix="" label="Monthly Interactions" delay={150} started={statsInView} />
            <StatCard value={45800} suffix="" label="Followers" delay={300} started={statsInView} />
            <StatCard value={2680} suffix="+" label="Posts Published" delay={450} started={statsInView} />
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard value={3500} suffix="+" label="New Followers This Month" delay={600} started={statsInView} />
            <StatCard value={124} suffix="" label="Pieces of Content Shared" delay={750} started={statsInView} />
            <div className="flex flex-col items-center justify-center p-8 border border-red-600/30 bg-red-600/5">
              <div className="font-['Anton'] text-5xl text-red-500 mb-2">EST.</div>
              <div className="font-['Anton'] text-6xl text-white mb-2">2022</div>
              <div className="text-white/40 text-xs uppercase tracking-widest">Detroit, Michigan</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <section id="content" className="py-24" ref={postsRef}>
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
                Latest
              </p>
              <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
                RECENT <span className="text-red-600">CONTENT</span>
              </h2>
            </div>
            <a
              href="https://www.instagram.com/murdermittenmedia/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block text-xs text-white/40 hover:text-red-500 uppercase tracking-widest transition-colors"
            >
              View All →
            </a>
          </div>

          <div
            className={`grid md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-700 ${postsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            {posts.map((post, i) => (
              <PostCard key={i} {...post} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <a
              href="https://www.instagram.com/murdermittenmedia/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-white/20 text-white/60 hover:border-red-600 hover:text-red-500 px-8 py-3 text-sm uppercase tracking-widest transition-all duration-200"
            >
              See All 2,680+ Posts on Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ── CONNECT ─────────────────────────────────────────── */}
      <section id="connect" className="py-24 border-t border-white/10">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
              Follow the Movement
            </p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-6">
              STAY <span className="text-red-600">CONNECTED</span>
            </h2>
            <p className="text-white/50 leading-relaxed">
              Follow Murder Mitten Media across all platforms for the latest in Michigan rap, street culture, and viral content.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                platform: "Instagram",
                handle: "@murdermittenmedia",
                desc: "45.8K Followers · 4.5M+ Views",
                url: "https://www.instagram.com/murdermittenmedia/",
                icon: "📸",
              },
              {
                platform: "YouTube",
                handle: "@MurderMittenMedia",
                desc: "Videos · Visuals · Exclusives",
                url: "https://youtube.com/@MurderMittenMedia",
                icon: "▶",
              },
              {
                platform: "Threads",
                handle: "@murdermittenmedia",
                desc: "Real-time updates & commentary",
                url: "https://www.threads.net/@murdermittenmedia",
                icon: "🧵",
              },
            ].map((social) => (
              <a
                key={social.platform}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-center p-8 border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-300 group red-glow-hover"
              >
                <div className="text-3xl mb-4">{social.icon}</div>
                <div className="font-['Anton'] text-xl uppercase mb-1 group-hover:text-red-500 transition-colors">
                  {social.platform}
                </div>
                <div className="text-white/50 text-sm mb-2">{social.handle}</div>
                <div className="text-white/30 text-xs">{social.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="live-dot" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </div>
          <div className="text-white/30 text-xs text-center">
            © 2022–{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI · All Rights Reserved
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">IG</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YT</a>
            <a href="https://www.threads.net/@murdermittenmedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">TH</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
