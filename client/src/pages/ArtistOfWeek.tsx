/* ============================================================
   MURDER MITTEN MEDIA -- Artist of the Week Page
   This Week: CEO Stew (Money Bag Boys)
   ============================================================ */

import { useState, useRef } from "react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

// --- CEO Stew Data --------------------------------------------
const ARTIST = {
  name: "CEO Stew",
  aka: "Stewop",
  group: "Money Bag Boys (MBB)",
  location: "Eastside Detroit, MI",
  instagram: "https://www.instagram.com/ceo.stew/",
  tiktok: "https://www.tiktok.com/@stewopmbb",
  youtube: "https://www.youtube.com/@moneybagboys_co",
  spotify: "https://open.spotify.com/artist/445wiVeb0kmovnsXj6MqHZ",
  appleMusic: "https://music.apple.com/us/artist/ceo-stew/1610942961",
  imageUrl: "", // placeholder -- no public image URL available
  tagline: "Eastside Detroit's Most Consistent Voice",
  article: `
There's a certain kind of rapper that doesn't need a co-sign to be felt -- the type that lets the music do the talking while everyone else is chasing clout. CEO Stew, born and raised on the Eastside of Detroit, is exactly that type of artist. And this week, Murder Mitten Media is putting the city on notice: Stew is the one to watch.

Repping the Money Bag Boys collective alongside fellow MBB members Big Punch, Lil Don, and 1481 Grungie, CEO Stew has been quietly building one of the most consistent catalogs coming out of Detroit over the past few years. What sets him apart isn't just the bars -- it's the authenticity. Every track feels lived-in, like he's rapping from a place most people only hear about.

His 2025 EP *STEWOP* -- a six-song project that dropped July 14th on all platforms -- marked a turning point. The tape showcased a more focused, confident Stew: sharper pen, tighter production choices, and a clear vision of where he's headed. Tracks like "Rush" (featuring DJ Lucas) and "Kitchen Top" with Big Punch showed his range, from street-certified anthems to melodic flexes that hit different on a late night drive through the D.

What makes Stew's story compelling is the grind behind it. He's been performing on the Murder Mitten Mic stage, dropping official videos through Kash World Productions and 12 Mile Productions, and building a following organically -- no industry shortcuts, no manufactured buzz. Just Detroit work ethic applied to music.

His recent collab "Don't Crash" with Chuckiii Red, Lil Don, and Ynp Bleed is a testament to the MBB chemistry -- four artists from the same city, same struggle, same mission, locking in on a track that sounds like a statement. And with more music reportedly in the works, 2026 is shaping up to be Stew's biggest year yet.

If you're sleeping on CEO Stew, consider this your wake-up call. The Eastside is talking -- and Murder Mitten Media is amplifying the signal.
  `.trim(),
};

// --- Recent videos --------------------------------------------
const VIDEOS = [
  {
    title: '"Don\'t Crash" -- Ceo Stew x Chuckiii Red x Lil Don x Ynp Bleed',
    videoId: "1bgjhsoC5AI",
    label: "Latest Drop",
    highlight: true,
  },
  {
    title: '"Tv Static" -- Ceo Stew x Chuckiii Red',
    videoId: "5bJS_HG1XyI",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Kitchen Top" -- Ceo Stew x Big Punch',
    videoId: "3E8WSjpXXRo",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Gretzky" -- Ceo Stew prod. Fishscale',
    videoId: "vDTRqccQZvI",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Rush" -- Ceo Stew x DJ Lucas',
    videoId: "v9PlFHb6Qxg",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Rockout" -- Ceo Stew ft. Big Punch',
    videoId: "GZ0YzXP4IBw",
    label: "Official Video",
    highlight: false,
  },
];

// --- Song catalog ---------------------------------------------
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

// --- Inline Audio Player Component ---------------------------
function AudioPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border border-red-600/40 bg-red-600/5 p-4 rounded">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (audioRef.current) setProgress(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white text-xl transition-colors flex-shrink-0"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate mb-2">{title}</p>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs font-mono w-10">{fmt(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={progress}
              onChange={e => {
                const t = Number(e.target.value);
                setProgress(t);
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              className="flex-1 accent-red-600 h-1"
            />
            <span className="text-white/40 text-xs font-mono w-10 text-right">{fmt(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-white/40 text-xs">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => {
              const v = Number(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            className="w-16 accent-red-600 h-1"
          />
        </div>
      </div>
    </div>
  );
}

export default function ArtistOfWeek() {
  const [activeVideo, setActiveVideo] = useState(VIDEOS[0]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [previewSong, setPreviewSong] = useState<string | null>(null);

  // Fetch live DB artist of week data (for audio track)
  const { data: dbArtist } = trpc.artistOfWeek.getCurrent.useQuery();

  const displayedSongs = showAllSongs ? SONGS : SONGS.slice(0, 6);

  // Map song titles to YouTube video IDs for preview
  const songVideoMap: Record<string, string> = {
    "Don't Crash": "1bgjhsoC5AI",
    "Tv Static": "5bJS_HG1XyI",
    "Kitchen Top": "3E8WSjpXXRo",
    "Gretzky": "vDTRqccQZvI",
    "Rush": "v9PlFHb6Qxg",
    "Rockout": "GZ0YzXP4IBw",
    "The Bag Forever": "u166YyEv0AE",
    "6": "rC2AmsKvz-Y",
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />

      {/* -- HERO ---------------------------------------------- */}
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
                <a
                  href={ARTIST.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[#1DB954]/40 text-[#1DB954]/80 hover:border-[#1DB954] hover:text-[#1DB954] px-4 py-2 text-xs uppercase tracking-widest transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                  Spotify
                </a>
                <a
                  href={ARTIST.appleMusic}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[#FC3C44]/40 text-[#FC3C44]/80 hover:border-[#FC3C44] hover:text-[#FC3C44] px-4 py-2 text-xs uppercase tracking-widest transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208a4.93 4.93 0 00-.35 1.49c-.06.5-.087 1-.09 1.501v12.6c.01.5.04 1 .09 1.5.07.73.28 1.42.65 2.05.55.93 1.35 1.6 2.33 2.01.63.27 1.29.4 1.97.44.55.04 1.1.06 1.65.06h11.3c.55 0 1.1-.02 1.65-.06.68-.04 1.34-.17 1.97-.44.98-.41 1.78-1.08 2.33-2.01.37-.63.58-1.32.65-2.05.05-.5.08-1 .09-1.5V6.124zm-6.077 6.29l-4.43 2.56c-.4.23-.9.23-1.3 0l-4.43-2.56c-.4-.23-.65-.66-.65-1.12V7.414c0-.46.25-.89.65-1.12l4.43-2.56c.4-.23.9-.23 1.3 0l4.43 2.56c.4.23.65.66.65 1.12v3.88c0 .46-.25.89-.65 1.12z"/></svg>
                  Apple Music
                </a>
              </div>

              {/* Audio track player (from DB) */}
              {dbArtist?.audioTrackUrl && (
                <div className="mt-6">
                  <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-3 font-semibold">Featured Track</p>
                  <AudioPlayer
                    src={dbArtist.audioTrackUrl}
                    title={dbArtist.audioTrackTitle ?? dbArtist.artistName ?? "Featured Track"}
                  />
                </div>
              )}
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

      {/* -- ARTICLE ------------------------------------------- */}
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

      {/* -- VIDEOS -------------------------------------------- */}
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

      {/* -- SONG CATALOG -------------------------------------- */}
      <section className="py-16 border-t border-white/10">
        <div className="container">
          <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-4 font-semibold">Discography</p>
          <h2 className="font-['Anton'] text-4xl md:text-5xl uppercase mb-10">
            SONG <span className="text-red-600">CATALOG</span>
          </h2>

          <div className="max-w-2xl">
            {displayedSongs.map((song, i) => {
              const videoId = songVideoMap[song.title];
              const isPlaying = previewSong === song.title;
              return (
                <div key={i}>
                  <div
                    className={`flex items-center justify-between py-3 border-b transition-colors group cursor-pointer ${
                      isPlaying ? "border-red-600/50 bg-red-600/5" : "border-white/10 hover:border-red-600/30"
                    }`}
                    onClick={() => setPreviewSong(isPlaying ? null : song.title)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white/20 text-sm w-6 text-right font-mono">
                        {videoId ? (
                          <span className={`text-base ${isPlaying ? "text-red-500" : "group-hover:text-red-500"} transition-colors`}>
                            {isPlaying ? "■" : "▶"}
                          </span>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div>
                        <p className={`font-semibold transition-colors ${isPlaying ? "text-white" : "text-white/90 group-hover:text-white"}`}>
                          {song.title}
                        </p>
                        {song.feat && (
                          <p className="text-white/40 text-xs">ft. {song.feat}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 text-xs">{song.year}</span>
                      {videoId && (
                        <span className={`text-xs px-2 py-0.5 border transition-colors ${
                          isPlaying
                            ? "border-red-600 text-red-500"
                            : "border-white/10 text-white/30 group-hover:border-red-600/40 group-hover:text-red-500/60"
                        }`}>
                          {isPlaying ? "CLOSE" : "PREVIEW"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Inline YouTube preview player */}
                  {isPlaying && videoId && (
                    <div className="border border-red-600/30 bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                        title={song.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full aspect-video"
                      />
                    </div>
                  )}
                </div>
              );
            })}

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

      {/* -- FOLLOW CTA ---------------------------------------- */}
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

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs text-center">
            © 2022-{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI
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
