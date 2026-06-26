/* ============================================================
   MURDER MITTEN MEDIA -- Artist of the Month Page
   June 2026: ItsManMan (48214)
   ============================================================ */
import { useState } from "react";
import { TuneInButton } from "@/components/TuneInButton";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const ARTIST_IMG = "/manus-storage/itsmanman_profile_04046b0b.jpg";

// --- ItsManMan Data -------------------------------------------
const ARTIST = {
  name: "ItsManMan",
  aka: "ManMan",
  group: "48214 · Detroit",
  location: "Detroit, MI (48214)",
  instagram: "https://www.instagram.com/itsmanman31/",
  tiktok: "https://www.tiktok.com/@_ItsManMan",
  youtube: "https://www.youtube.com/@ItsManMan",
  spotify: "https://open.spotify.com/artist/6kghbirzrs0QvOBBKJLLKv",
  appleMusic: "https://music.apple.com/us/artist/itsmanman/1673724763",
  soundcloud: "https://soundcloud.com/user-484076166",
  tagline: "Detroit's Next One — No Debate",
  article: `
Detroit has always had a way of producing artists who feel undeniable before the industry even catches up. ItsManMan is that artist right now. Born September 16, 2003, and raised in the 48214 zip code on the east side of Detroit, ManMan has been building one of the most talked-about catalogs in the city — and in June 2026, Murder Mitten Media is proud to name him our Artist of the Month.

The buzz around ItsManMan isn't manufactured. It started with "Bronny James" — a viral single that caught fire organically and landed him an "On The Radar" performance, putting him in front of a national audience that immediately understood what Detroit already knew. The record had everything: a sharp concept, a confident delivery, and that Detroit grit that doesn't translate unless you actually have it.

His 2026 album *MANMAN IVERSON* — a nod to the legendary Allen Iverson — arrived as a statement. Featuring Detroit heavyweights Cash Kidd and PayGotti, the 15-track project showed a more complete artist: versatile flows, cinematic production, and a pen that can switch from street storytelling to melodic hooks without losing the thread. Tracks like "MICHAEL BLACKSON," "TRAVIS HUNTER," and "GRANDE" immediately became fan favorites, with the visuals matching the energy of the music.

What makes ManMan's story resonate is the authenticity behind it. He came up recording with Detroit producer Danny G, sharpening his craft before the cameras were on him. He's been co-signed by Propdemic's Spotlight, featured across Detroit Rap Daily, and acknowledged by figures in the game who don't give props lightly. The Stinc Team connection, the Detroit politics he navigates, the Ralfy influence — it all adds up to an artist who understands the culture from the inside out.

At just 22 years old, ItsManMan is already operating at a level that most artists spend years trying to reach. The *MANMAN IVERSON* rollout proved he can sustain momentum, build anticipation, and deliver when the moment comes. With more music reportedly in the pipeline and a growing national profile, the only question left is how long before the industry officially catches up to what Detroit already knows.

Murder Mitten Media has been watching ManMan's rise from the beginning — and this month, we're making it official. 48214 is in the building. The next one is here.
  `.trim(),
};

// --- Videos ---------------------------------------------------
const VIDEOS = [
  {
    title: '"MICHAEL BLACKSON" — ItsManMan (Official Video)',
    videoId: "7HLFhigwfgM",
    label: "Latest Drop",
    highlight: true,
  },
  {
    title: '"TRAVIS HUNTER" — ItsManMan (Official Video)',
    videoId: "sz-P_jopTz0",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Bronny James" — ItsManMan (Official Video)',
    videoId: "_5dZbJHlEh0",
    label: "Viral Hit",
    highlight: false,
  },
  {
    title: '"Wemby" — ItsManMan (Official Video)',
    videoId: "OqZ10eNat7U",
    label: "Official Video",
    highlight: false,
  },
  {
    title: '"Bronny James" — On The Radar Performance',
    videoId: "bd6apev3HUw",
    label: "Performance",
    highlight: false,
  },
  {
    title: 'ItsManMan on growing up Detroit, Stinc Team, Ralfy & More',
    videoId: "4wZpZIr4PLY",
    label: "Interview",
    highlight: false,
  },
];

// --- Song Catalog ---------------------------------------------
const SONGS = [
  { title: "MICHAEL BLACKSON", feat: "", year: "2026", album: "MANMAN IVERSON" },
  { title: "TRAVIS HUNTER", feat: "", year: "2026", album: "MANMAN IVERSON" },
  { title: "GRANDE", feat: "", year: "2026", album: "MANMAN IVERSON" },
  { title: "25", feat: "", year: "2026", album: "Single" },
  { title: "SO SICK", feat: "", year: "2026", album: "Single" },
  { title: "6PM IN ATL", feat: "", year: "2025", album: "Single" },
  { title: "RRENEGADE", feat: "", year: "2025", album: "Single" },
  { title: "Wemby", feat: "", year: "2025", album: "Single" },
  { title: "Toy Soldier", feat: "", year: "2025", album: "Single" },
  { title: "Bronny James", feat: "", year: "2024", album: "Me vs Me" },
  { title: "Detroit Lions", feat: "", year: "2024", album: "Single" },
  { title: "REAL FLEX", feat: "", year: "2024", album: "Single" },
  { title: "HARDEST OUT THE D", feat: "", year: "2024", album: "HARDEST OUT THE D" },
  { title: "4 For 4", feat: "", year: "2025", album: "4 For 4" },
  { title: "CHRIS ROCC", feat: "", year: "2026", album: "Single" },
];

// --- Audio player shim ----------------------------------------
function AudioPlayer({ title }: { src: string; title: string }) {
  return (
    <div className="border border-red-600/40 bg-red-600/5 p-4 rounded flex items-center gap-4">
      <TuneInButton size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{title}</p>
        <p className="text-white/30 text-xs mt-0.5">Tune in to hear this on the live radio</p>
      </div>
    </div>
  );
}

export default function ArtistOfWeek() {
  const [activeVideo, setActiveVideo] = useState(VIDEOS[0]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [previewSong, setPreviewSong] = useState<string | null>(null);

  const { data: dbArtist } = trpc.artistOfWeek.getCurrent.useQuery();

  const displayedSongs = showAllSongs ? SONGS : SONGS.slice(0, 6);

  const songVideoMap: Record<string, string> = {
    "MICHAEL BLACKSON": "7HLFhigwfgM",
    "TRAVIS HUNTER": "sz-P_jopTz0",
    "Bronny James": "_5dZbJHlEh0",
    "Wemby": "OqZ10eNat7U",
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />

      {/* -- HERO ---------------------------------------------- */}
      <section className="pt-28 pb-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/8 via-transparent to-transparent" />
        <div className="container relative z-10">

          {/* Month badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs text-red-500 uppercase tracking-[0.3em] font-semibold">
              Artist of the Month · June 2026
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: artist info */}
            <div>
              {/* Artist photo */}
              <div className="mb-6 w-32 h-32 rounded-full overflow-hidden border-2 border-red-600/50 shadow-[0_0_30px_rgba(209,0,0,0.25)]">
                <img
                  src={ARTIST_IMG}
                  alt="ItsManMan"
                  className="w-full h-full object-cover"
                />
              </div>

              <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase leading-none mb-2">
                ITS<span className="text-red-600">MAN</span>MAN
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-widest mb-1">{ARTIST.aka} · {ARTIST.group}</p>
              <p className="text-white/40 text-sm mb-6">📍 {ARTIST.location}</p>

              <div className="border-l-2 border-red-600 pl-4 mb-8">
                <p className="text-white/70 text-lg italic">"{ARTIST.tagline}"</p>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 mb-8">
                <div>
                  <p className="font-['Anton'] text-2xl text-red-600">37K+</p>
                  <p className="text-white/40 text-xs uppercase tracking-widest">Instagram</p>
                </div>
                <div>
                  <p className="font-['Anton'] text-2xl text-red-600">15</p>
                  <p className="text-white/40 text-xs uppercase tracking-widest">Tracks on Album</p>
                </div>
                <div>
                  <p className="font-['Anton'] text-2xl text-red-600">2026</p>
                  <p className="text-white/40 text-xs uppercase tracking-widest">Breakout Year</p>
                </div>
              </div>

              {/* Social links */}
              <div className="flex flex-wrap gap-3">
                <a href={ARTIST.instagram} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all">
                  📸 Instagram
                </a>
                <a href={ARTIST.tiktok} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all">
                  🎵 TikTok
                </a>
                <a href={ARTIST.youtube} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/20 text-white/60 hover:border-red-600 hover:text-white px-4 py-2 text-xs uppercase tracking-widest transition-all">
                  ▶ YouTube
                </a>
                <a href={ARTIST.spotify} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[#1DB954]/40 text-[#1DB954]/80 hover:border-[#1DB954] hover:text-[#1DB954] px-4 py-2 text-xs uppercase tracking-widest transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                  Spotify
                </a>
                <a href={ARTIST.appleMusic} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[#FC3C44]/40 text-[#FC3C44]/80 hover:border-[#FC3C44] hover:text-[#FC3C44] px-4 py-2 text-xs uppercase tracking-widest transition-all">
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

              {/* Album callout */}
              <div className="mt-6 border border-red-600/30 bg-red-600/5 p-5">
                <p className="text-xs text-red-500 uppercase tracking-widest mb-1 font-semibold">Latest Project</p>
                <p className="font-['Anton'] text-3xl uppercase mb-1">MANMAN IVERSON</p>
                <p className="text-white/50 text-sm">15 Tracks · feat. Cash Kidd & PayGotti · 2026</p>
                <div className="flex gap-3 mt-4">
                  <a href={ARTIST.spotify} target="_blank" rel="noopener noreferrer"
                    className="text-xs border border-[#1DB954]/40 text-[#1DB954]/80 hover:border-[#1DB954] px-3 py-1.5 uppercase tracking-widest transition-all">
                    Stream on Spotify
                  </a>
                  <a href={ARTIST.appleMusic} target="_blank" rel="noopener noreferrer"
                    className="text-xs border border-[#FC3C44]/40 text-[#FC3C44]/80 hover:border-[#FC3C44] px-3 py-1.5 uppercase tracking-widest transition-all">
                    Apple Music
                  </a>
                </div>
              </div>
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
              THE 48214 DON'T<br /><span className="text-red-600">MISS</span>
            </h2>
            <div className="space-y-6">
              {ARTIST.article.split("\n\n").map((para, i) => (
                <p key={i} className="text-white/70 leading-relaxed text-base md:text-lg">
                  {para}
                </p>
              ))}
            </div>

            {/* Propdemic co-sign callout */}
            <div className="mt-10 border border-red-600/30 bg-red-600/5 p-6">
              <p className="text-xs text-red-500 uppercase tracking-widest mb-2 font-semibold">Industry Recognition</p>
              <p className="font-['Anton'] text-2xl uppercase mb-2">Propdemic Spotlight</p>
              <p className="text-white/50 text-sm">
                "The Hardest Out The D &amp;&amp; One of Our Favorite Artists" — Propdemic, September 2024
              </p>
              <p className="text-white/30 text-xs mt-2">48214 · Detroit, MI · Born Sep 16, 2003</p>
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
                  <div className="absolute top-2 right-2 bg-black/70 text-white/60 text-xs px-2 py-0.5 uppercase tracking-wider">
                    {video.label}
                  </div>
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
                        <p className="text-white/25 text-xs">{song.album}</p>
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
            FOLLOW <span className="text-red-600">ITSMANMAN</span>
          </h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={ARTIST.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              Instagram @itsmanman31
            </a>
            <a
              href={ARTIST.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/30 text-white/80 hover:border-white hover:text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              YouTube
            </a>
            <a
              href={ARTIST.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#1DB954]/40 text-[#1DB954]/80 hover:border-[#1DB954] hover:text-[#1DB954] px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              Stream on Spotify
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
            © 2022-{new Date().getFullYear()} Murder Mitten Media ™ · The Mitten
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
