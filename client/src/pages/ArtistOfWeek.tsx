/* ============================================================
   MURDER MITTEN MEDIA — Artist of the Week Page
   This Week: CEO Stew (Money Bag Boys)
   ============================================================ */

import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

// ─── CEO Stew Data ────────────────────────────────────────────
const ARTIST = {
  name: "CEO Stew",
  aka: "Stewop",
  group: "Money Bag Boys (MBB)",
  location: "Eastside Detroit, MI",
  instagram: "https://www.instagram.com/ceo.stew/",
  tiktok: "https://www.tiktok.com/@stewopmbb",
  youtube: "https://www.youtube.com/@moneybagboys_co",
  spotify: "https://open.spotify.com/artist/ceo-stew",
  imageUrl: "", // placeholder — no public image URL available
  tagline: "Eastside Detroit's Most Consistent Voice",
  article: `
There's a certain kind of rapper that doesn't need a co-sign to be felt — the type that lets the music do the talking while everyone else is chasing clout. CEO Stew, born and raised on the Eastside of Detroit, is exactly that type of artist. And this week, Murder Mitten Media is putting the city on notice: Stew is the one to watch.

Repping the Money Bag Boys collective alongside fellow MBB members Big Punch, Lil Don, and 1481 Grungie, CEO Stew has been quietly building one of the most consistent catalogs coming out of Detroit over the past few years. What sets him apart isn't just the bars — it's the authenticity. Every track feels lived-in, like he's rapping from a place most people only hear about.

His 2025 EP *STEWOP* — a six-song project that dropped July 14th on all platforms — marked a turning point. The tape showcased a more focused, confident Stew: sharper pen, tighter production choices, and a clear vision of where he's headed. Tracks like "Rush" (featuring DJ Lucas) and "Kitchen Top" with Big Punch showed his range, from street-certified anthems to melodic flexes that hit different on a late night drive through the D.

What makes Stew's story compelling is the grind behind it. He's been performing on the Murder Mitten Mic stage, dropping official videos through Kash World Productions and 12 Mile Productions, and building a following organically — no industry shortcuts, no manufactured buzz. Just Detroit work ethic applied to music.

His recent collab "Don't Crash" with Chuckiii Red, Lil Don, and Ynp Bleed is a testament to the MBB chemistry — four artists from the same city, same struggle, same mission, locking in on a track that sounds like a statement. And with more music reportedly in the works, 2026 is shaping up to be Stew's biggest year yet.

If you're sleeping on CEO Stew, consider this your wake-up call. The Eastside is talking — and Murder Mitten Media is amplifying the signal.
  `.trim(),
};

// ─── Recent videos ────────────────────────────────────────────
const VIDEOS = [
  {
    title: '"Don\'t Crash" — Ceo Stew x Chuckiii Red x Lil Don x Ynp Bleed',
    videoId: "1bgjhsoC5AI",
    label: "Latest Drop",
    highlight: true,
  },
  {
    title: '"Tv Static" — Ceo Stew x Chuckiii Red',
    videoId: "5bJS_HG1XyI",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Kitchen Top" — Ceo Stew x Big Punch',
    videoId: "3E8WSjpXXRo",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Gretzky" — Ceo Stew prod. Fishscale',
    videoId: "vDTRqccQZvI",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Rush" — Ceo Stew x DJ Lucas',
    videoId: "v9PlFHb6Qxg",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Rockout" — Ceo Stew ft. Big Punch',
    videoId: "GZ0YzXP4IBw",
    label: "Official Video",
    highlight: false,
  },
];

// ─── Song catalog ─────────────────────────────────────────────
const SONGS = [
  { title: "Don't Crash", feat: "Chuckiii Red, Lil Don, Ynp Bleed", year: "2025" },
  { title: "Tv Static", feat: "Chuckiii Red", year: "2025" },
  { title: "Kitchen Top", feat: "Big Punch", year: "2024" },
  { title: "Gretzky", feat: "prod. Fishscale", year: "2024" },
  { title: "6", feat: "Money Bag Boys", year: "2024" },
  { title: "Rush", feat: "DJ Lucas", year: "2024" },
  { title: "Free 80s", feat: "One Mic Performance", year: "2024" },
  { title: "Rat K", feat: "Chuckiii Red", year: "2024" },
  { title: "The Bag Forever", feat: "", year: "2024" },
  { title: "Rockout", feat: "Big Punch", year: "2024" },
  { title: "One More Sale", feat: "", year: "2023" },
  { title: "Cash We Trust", feat: "Dilano Dalion", year: "2023" },
  { title: "Krack Uh Slab Down", feat: "", year: "2023" },
  { title: "Cross The Lake", feat: "Big Punch, 1481 Grungie", year: "2023" },
];

export default function ArtistOfWeek() {
  const [activeVideo, setActiveVideo] = useState(VIDEOS[0]);
  const [showAllSongs, setShowAllSongs] = useState(false);

  const displayedSongs = showAllSongs ? SONGS : SONGS.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <SiteNav />

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="pt-28 pb-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/8 via-transparent to-transparent" />
        <div className="container relative z-10">

          {/* Week badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">
              Artist of the Week · May 2026
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: artist info */}
            <div>
              <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase leading-none mb-2">
                CEO<br /><span className="text-red-600">STEW</span>
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-widest mb-1">{ARTIST.aka} · {ARTIST.group}</p>
              <p className="text-white/40 text-sm mb-6">📍 {ARTIST.location}</p>

              <div className="border-l-2 border-red-600 pl-4 mb-8">
                <p className="text-white/70 text-lg italic">"{ARTIST.tagline}"</p>
              </div>

              {/* Social links */}
              <div className="flex flex-wrap gap-3">
                <a
                  href={ARTIST.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all"
                >
                  📸 Instagram
                </a>
                <a
                  href={ARTIST.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all"
                >
                  🎵 TikTok
                </a>
                <a
                  href={ARTIST.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all"
                >
                  ▶ YouTube (MBB)
                </a>
              </div>
            </div>

            {/* Right: featured video */}
            <div>
              <div className="aspect-video w-full bg-black border border-white/10">
                <iframe
                  key={activeVideo.videoId}
                  src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=0&rel=0`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <p className="text-white/50 text-xs mt-2 text-center uppercase tracking-wider">{activeVideo.title}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ARTICLE ─────────────────────────────────────────── */}
      <section className="py-16 border-t border-white/10">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">
              Feature Article
            </p>
            <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase mb-8">
              THE EASTSIDE DON'T<br /><span className="text-red-600">SLEEP</span>
            </h2>
            <div className="space-y-6">
              {ARTIST.article.split("\n\n").map((para, i) => (
                <p key={i} className="text-white/70 leading-relaxed text-base md:text-lg">
                  {para}
                </p>
              ))}
            </div>

            {/* MBB shoutout */}
            <div className="mt-10 border border-red-600/30 bg-red-600/5 p-6">
              <p className="text-xs text-red-500 uppercase tracking-widest mb-2 font-semibold">The Collective</p>
              <p className="font-['Anton'] text-2xl uppercase mb-2">Money Bag Boys</p>
              <p className="text-white/50 text-sm">
                CEO Stew · Big Punch · Lil Don · 1481 Grungie · Chuckiii Red
              </p>
              <p className="text-white/30 text-xs mt-2">Eastside Detroit · Get Money Music</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── VIDEOS ──────────────────────────────────────────── */}
      <section className="py-16 border-t border-white/10">
        <div className="container">
          <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Visuals</p>
          <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase mb-10">
            RECENT <span className="text-red-600">VIDEOS</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {VIDEOS.map((video) => (
              <button
                key={video.videoId}
                onClick={() => {
                  setActiveVideo(video);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`text-left border transition-all duration-200 group overflow-hidden ${
                  activeVideo.videoId === video.videoId
                    ? "border-red-600 bg-red-600/10"
                    : "border-white/10 bg-white/[0.02] hover:border-red-600/50"
                }`}
              >
                <div className="relative aspect-video bg-black">
                  <img
                    src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      activeVideo.videoId === video.videoId
                        ? "bg-red-600"
                        : "bg-black/60 group-hover:bg-red-600"
                    }`}>
                      <span className="text-white text-lg ml-1">▶</span>
                    </div>
                  </div>
                  {video.highlight && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 uppercase tracking-wider font-semibold">
                      Latest
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-white/80 text-sm leading-snug group-hover:text-white transition-colors">
                    {video.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SONG CATALOG ────────────────────────────────────── */}
      <section className="py-16 border-t border-white/10">
        <div className="container">
          <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Discography</p>
          <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase mb-10">
            SONG <span className="text-red-600">CATALOG</span>
          </h2>

          <div className="max-w-2xl">
            {displayedSongs.map((song, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-white/10 hover:border-red-600/30 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white/20 text-sm w-6 text-right font-mono">{i + 1}</span>
                  <div>
                    <p className="text-white/90 font-semibold group-hover:text-white transition-colors">
                      {song.title}
                    </p>
                    {song.feat && (
                      <p className="text-white/40 text-xs">ft. {song.feat}</p>
                    )}
                  </div>
                </div>
                <span className="text-white/30 text-xs">{song.year}</span>
              </div>
            ))}

            {!showAllSongs && SONGS.length > 6 && (
              <button
                onClick={() => setShowAllSongs(true)}
                className="mt-6 text-xs text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors"
              >
                Show All {SONGS.length} Songs ↓
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── FOLLOW CTA ──────────────────────────────────────── */}
      <section className="py-16 border-t border-white/10">
        <div className="container text-center">
          <p className="text-white/40 text-sm uppercase tracking-widest mb-4">Support the artist</p>
          <h2 className="font-['Anton'] text-4xl uppercase mb-8">
            FOLLOW <span className="text-red-600">CEO STEW</span>
          </h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={ARTIST.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              Instagram @ceo.stew
            </a>
            <a
              href={ARTIST.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 text-white/80 hover:border-white hover:text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              YouTube (MBB)
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs text-center">
            © 2022–{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">IG</a>
            <a href="https://youtube.com/@MurderMittenMedia" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YT</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
