/* ============================================================
   MURDER MITTEN MEDIA — Home Page
   Design: Dark Editorial / Premium Street Media
   ============================================================ */

import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

// ─── Animated counter hook ────────────────────────────────────
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

function StatCard({ value, suffix, label, delay, started }: {
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
    <div className="flex flex-col items-center justify-center p-8 border border-white/10 bg-white/[0.03] hover:border-red-600/50 transition-all duration-300 group">
      <div className="font-['Anton'] text-5xl md:text-6xl lg:text-7xl text-red-500 mb-2 group-hover:scale-105 transition-transform duration-300">
        {display}{suffix}
      </div>
      <div className="text-white/50 text-sm uppercase tracking-widest font-medium text-center">{label}</div>
    </div>
  );
}

// ─── Live Instagram Post Card ─────────────────────────────────
function PostCard({ post }: {
  post: {
    id: string; caption: string; mediaType: string; mediaUrl: string;
    thumbnailUrl?: string; permalink: string; likes: number; comments: number; timestamp: string;
  }
}) {
  const [imgError, setImgError] = useState(false);
  const thumb = post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
  const truncated = post.caption.length > 100 ? post.caption.slice(0, 100) + "…" : post.caption;
  const date = new Date(post.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-300 overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-white/5">
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt={truncated}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-4xl">
              {post.mediaType === "VIDEO" ? "▶" : "📷"}
            </span>
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-red-600/90 text-white px-2 py-0.5 uppercase tracking-wider font-semibold">
            {post.mediaType === "VIDEO" ? "Reel" : post.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
          </span>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <p className="text-white text-xs leading-relaxed mb-2">{truncated}</p>
          <div className="flex items-center gap-3 text-white/70 text-xs">
            <span>❤ {post.likes.toLocaleString()}</span>
            <span>💬 {post.comments.toLocaleString()}</span>
            <span className="ml-auto text-red-400">View →</span>
          </div>
        </div>
      </div>
      {/* Caption below */}
      <div className="p-3">
        <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{truncated}</p>
        <p className="text-white/30 text-xs mt-1">{date}</p>
      </div>
    </a>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function Home() {
  const { ref: statsRef, inView: statsInView } = useInView(0.1);
  const { ref: postsRef, inView: postsInView } = useInView(0.1);
  const [navScrolled, setNavScrolled] = useState(false);

  const { data: igPosts, isLoading: igLoading } = trpc.instagram.feed.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navScrolled ? "bg-[#080808]/95 backdrop-blur-sm border-b border-white/10" : "bg-transparent"}`}>
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="font-['Anton'] text-xl tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
            <a href="#content" className="hover:text-white transition-colors">Content</a>
            <a href="/promo" className="hover:text-white transition-colors">Promo</a>
            <a href="#connect" className="hover:text-white transition-colors">Connect</a>
          </div>
          <a
            href="/promo"
            className="text-xs uppercase tracking-widest border border-red-600 text-red-500 px-4 py-2 hover:bg-red-600 hover:text-white transition-all duration-200 font-semibold"
          >
            Buy Promo
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-[#080808]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />

        <div className="container relative z-10 pt-24 pb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">Detroit, MI · Est. 2022</span>
            </div>
            <h1 className="font-['Anton'] text-6xl md:text-8xl lg:text-[110px] leading-none mb-6 uppercase" style={{ textShadow: "0 0 60px rgba(209,0,0,0.2)" }}>
              MURDER<br />
              <span className="text-red-600">MITTEN</span><br />
              MEDIA
            </h1>
            <div className="border-l-4 border-red-600 pl-4 mb-8">
              <p className="text-white/70 text-lg md:text-xl font-light leading-relaxed">Where the Industry Watches the Trenches</p>
              <p className="text-white/40 text-sm mt-1">Rap · Culture · Viral Content · Brand Owners</p>
            </div>
            <div className="flex flex-wrap gap-6 mb-10">
              {[{ val: "4.5M+", label: "Monthly Views" }, { val: "45.8K", label: "Followers" }, { val: "2,680+", label: "Posts" }].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="font-['Anton'] text-3xl text-red-600">{s.val}</span>
                  <span className="text-white/40 text-xs uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]">
                Instagram
              </a>
              <a href="/promo"
                className="border border-red-600 text-red-500 hover:bg-red-600 hover:text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all duration-200">
                Buy Promo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section id="stats" className="py-24 relative" ref={statsRef}>
        <div className="container relative z-10">
          <div className="text-center mb-16">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">By the Numbers</p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">THE <span className="text-red-600">REACH</span></h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={4500000} suffix="" label="Monthly Views" delay={0} started={statsInView} />
            <StatCard value={228600} suffix="" label="Monthly Interactions" delay={150} started={statsInView} />
            <StatCard value={45800} suffix="" label="Followers" delay={300} started={statsInView} />
            <StatCard value={2680} suffix="+" label="Posts Published" delay={450} started={statsInView} />
          </div>
        </div>
      </section>

      {/* ── LIVE INSTAGRAM FEED ─────────────────────────────── */}
      <section id="content" className="py-24" ref={postsRef}>
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Live Feed</p>
              <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase">
                RECENT <span className="text-red-600">CONTENT</span>
              </h2>
              <p className="text-white/40 text-sm mt-2">Auto-updated from Instagram</p>
            </div>
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
              className="hidden md:block text-xs text-white/40 hover:text-red-500 uppercase tracking-widest transition-colors">
              View All →
            </a>
          </div>

          {igLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 animate-pulse border border-white/10" />
              ))}
            </div>
          ) : igPosts && igPosts.length > 0 ? (
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-all duration-700 ${postsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              {igPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            /* Fallback static posts if API not configured */
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-all duration-700 ${postsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              {[
                { id: "1", caption: "Tee Grizzley spoke on the Detroit beef while live — he not getting involved cause he can shine light on BOTH sides", link: "https://www.instagram.com/p/DXZW96GjQhe/", likes: 6038, comments: 155, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/671813490_18579621352060130_9085902784970886585_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ccb=7-5&_nc_sid=18de74&_nc_ohc=ZaPNV8Z7_i0Q7kNvwHvfQqH&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&oh=00_Af7sTEXniQ5Yn42cfuoa4vCBa6Ws0TddRsziJ5AKYm46UQ&oe=6A01C46C", timestamp: "2026-04-21T13:58:28+0000" },
                { id: "2", caption: "Punchmade Dev vs BabyTron situation getting messy — started with a verse that wasn't cleared", link: "https://www.instagram.com/p/DXza3R9EQrt/", likes: 4930, comments: 289, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad6-1.cdninstagram.com/v/t51.82787-15/684157845_18582373297060130_4342803109716149245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ccb=7-5&_nc_sid=18de74&_nc_ohc=xUiW1d3JoF8Q7kNvwHzOYAZ&_nc_zt=23&_nc_ht=scontent-iad6-1.cdninstagram.com&oh=00_Af6nLJm_zv3g9i8wAPkeDhqqOD7ODijFmA3CaPixGX194w&oe=6A01B3C7", timestamp: "2026-05-01T16:52:46+0000" },
                { id: "3", caption: "YBN Lil Bro and GMO Stax just took it to the booth after everything went left between them", link: "https://www.instagram.com/p/DX4XFRCEVRi/", likes: 1937, comments: 45, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad6-1.cdninstagram.com/v/t51.82787-15/683998456_18582894139060130_7779718697168248579_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ccb=7-5&_nc_sid=18de74&_nc_ohc=Kd0g5QSvGVwQ7kNvwFtPyGd&_nc_zt=23&_nc_ht=scontent-iad6-1.cdninstagram.com&oh=00_Af4iOJyAq1n7dSPx-_OZWsdHiM0SdijbMVU8wcsUt5k2cw&oe=6A01B48C", timestamp: "2026-05-03T14:55:56+0000" },
                { id: "4", caption: "Free AllStar JR — Feds just picked him up tied to the Houston situation", link: "https://www.instagram.com/p/DXe2ZqXkWsd/", likes: 1264, comments: 187, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/673022524_18580129255060130_7547401300466007221_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ccb=7-5&_nc_sid=18de74&_nc_ohc=8oc03zN1gGYQ7kNvwEFbmom&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&oh=00_Af6skkq2Wcpicl8_596B3VgffwtvKCEhj_hqB6fD4VJljQ&oe=6A01CC04", timestamp: "2026-04-23T17:09:20+0000" },
                { id: "5", caption: "TrueYoungin back with 'Keep Going' — staying focused and pushing forward", link: "https://www.instagram.com/reel/DXhJ89TDc7v/", likes: 28, comments: 6, type: "VIDEO", mediaUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.71878-15/672387611_1431387405682493_4135655294668433915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ccb=7-5&_nc_sid=18de74&_nc_ohc=Y2oJDjszmEoQ7kNvwHOgZn5&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&oh=00_Af5KSvdQBFx6WCiVNwOC0ldZjhI22Jfek0okteqMJxn0Hg&oe=6A01E1AA", timestamp: "2026-04-24T14:39:06+0000" },
                { id: "6", caption: "Jay Da Don previewing snippet for upcoming single 'Back Again'", link: "https://www.instagram.com/p/DXhJtWiDYvV/", likes: 32, comments: 10, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/673884359_18580362844060130_780715130748933643_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ccb=7-5&_nc_sid=18de74&_nc_ohc=SEGxIYbnZycQ7kNvwG9gQeW&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&oh=00_Af5zbsypIL7bppMAi2Ql2ErFel2QDixB_qhcWWsc8WqG0w&oe=6A01B9A9", timestamp: "2026-04-24T14:36:32+0000" },
                { id: "7", caption: "AceMTE back with new visual for 'New To Me' — raw Michigan feel without forcing nothing", link: "https://www.instagram.com/p/DXiHTfhjQ92/", likes: 41, comments: 5, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/675480855_18580474195060130_4250057409233729540_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ccb=7-5&_nc_sid=18de74&_nc_ohc=4dnwtokp0TQQ7kNvwFjoOf7&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&oh=00_Af6hd1DnPr-rE2UPXGxE_mTbpe3Yt-6gddk0K7g7k0CoDg&oe=6A01E962", timestamp: "2026-04-24T23:34:46+0000" },
                { id: "8", caption: "BSG Big Von back applying pressure with 'In My Lifetime' off the new '2 Deep' EP", link: "https://www.instagram.com/p/DXST37WEerp/", likes: 75, comments: 6, type: "CAROUSEL_ALBUM", mediaUrl: "https://scontent-iad3-2.cdninstagram.com/v/t51.82787-15/670832360_18578986522060130_5904333148648448456_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ccb=7-5&_nc_sid=18de74&_nc_ohc=7PxT5sZyyQIQ7kNvwEDd1_-&_nc_zt=23&_nc_ht=scontent-iad3-2.cdninstagram.com&oh=00_Af5tKk69SJI4aCIpLj0wUm25Q3pBnSgahzsDTJyLTOOsxg&oe=6A01DE37", timestamp: "2026-04-18T20:16:45+0000" },
              ].map((post) => (
                <a key={post.id} href={post.link} target="_blank" rel="noopener noreferrer"
                  className="group block border border-white/10 bg-white/[0.03] hover:border-red-600/50 transition-all duration-300 overflow-hidden">
                  <div className="relative aspect-square overflow-hidden bg-white/5">
                    <img src={post.mediaUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute top-2 left-2">
                      <span className="text-xs bg-red-600/90 text-white px-2 py-0.5 uppercase tracking-wider font-semibold">
                        {post.type === "VIDEO" ? "Reel" : post.type === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <p className="text-white text-xs leading-relaxed mb-2 line-clamp-3">{post.caption}</p>
                      <div className="flex items-center gap-3 text-white/70 text-xs">
                        <span>❤ {post.likes.toLocaleString()}</span>
                        <span>💬 {post.comments.toLocaleString()}</span>
                        <span className="ml-auto text-red-400">View →</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{post.caption}</p>
                    <p className="text-white/30 text-xs mt-1">{new Date(post.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer"
              className="inline-block border border-white/20 text-white/60 hover:border-red-600 hover:text-red-500 px-8 py-3 text-sm uppercase tracking-widest transition-all duration-200">
              See All Posts on Instagram
            </a>
          </div>
        </div>
      </section>

      {/* ── PROMO CTA ────────────────────────────────────────── */}
      <section className="py-20 border-t border-white/10 bg-red-600/5">
        <div className="container text-center">
          <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Grow Your Brand</p>
          <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-4">
            GET YOUR <span className="text-red-600">PROMO</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto mb-8">
            Reach 45,000+ followers and 4.5M+ monthly views. Story posts, permanent posts, bundles, and monthly packages available.
          </p>
          <a href="/promo"
            className="inline-block bg-red-600 hover:bg-red-700 text-white px-12 py-4 text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:shadow-[0_0_30px_rgba(209,0,0,0.5)]">
            View Promo Packages →
          </a>
        </div>
      </section>

      {/* ── CONNECT ─────────────────────────────────────────── */}
      <section id="connect" className="py-24 border-t border-white/10">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Follow the Movement</p>
            <h2 className="font-['Anton'] text-5xl md:text-6xl uppercase mb-6">
              STAY <span className="text-red-600">CONNECTED</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { platform: "Instagram", handle: "@murdermittenmedia", desc: "45.8K Followers · 4.5M+ Views", url: "https://www.instagram.com/murdermittenmedia/", icon: "📸" },
              { platform: "YouTube", handle: "@MurderMittenMedia", desc: "Videos · Visuals · Exclusives", url: "https://youtube.com/@MurderMittenMedia", icon: "▶" },
              { platform: "Threads", handle: "@murdermittenmedia", desc: "Real-time updates & commentary", url: "https://www.threads.net/@murdermittenmedia", icon: "🧵" },
            ].map((social) => (
              <a key={social.platform} href={social.url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center text-center p-8 border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-300 group">
                <div className="text-3xl mb-4">{social.icon}</div>
                <div className="font-['Anton'] text-xl uppercase mb-1 group-hover:text-red-500 transition-colors">{social.platform}</div>
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
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
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
            <a href="/promo" className="hover:text-red-500 transition-colors">Promo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
