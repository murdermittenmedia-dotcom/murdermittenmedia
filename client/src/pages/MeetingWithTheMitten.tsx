/* ============================================================
   MURDER MITTEN MEDIA — Meeting With The Mitten Podcast
   All 15 episodes from the official YouTube playlist
   ============================================================ */

import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const EPISODES = [
  {
    id: "XBFP8kaoZU0",
    title: "Meeting With The Mitten : BandGang Javar Interview",
    guest: "BandGang Javar",
    views: "4.8K",
    duration: "40:34",
    description: "BandGang Javar sits down with Murder Mitten Media to talk about his journey in Detroit rap, the BandGang legacy, and what he has been working on.",
  },
  {
    id: "uLYz_2Djzlk",
    title: "Murder Mitten Interviews Episode 1 : WestWarrenKing",
    guest: "WestWarrenKing",
    views: "167",
    duration: "21:43",
    description: "The very first episode of the Murder Mitten interview series. WestWarrenKing breaks down his come-up and vision for Michigan rap.",
  },
  {
    id: "_E6Ww-k_E08",
    title: "Meeting With The Mitten : ShredGang Horse Interview",
    guest: "ShredGang Horse",
    views: "738",
    duration: "57:38",
    description: "ShredGang Horse opens up about life in Detroit, the ShredGang movement, and his plans for the future of Michigan street rap.",
  },
  {
    id: "zkJW0fhAeA4",
    title: "Benzino Responds to Snap Dogg, Eminem Beef, Mom's Spaghetti, Burnout Video & Love For Detroit",
    guest: "Benzino",
    views: "7K",
    duration: "1:23:05",
    description: "One of the biggest episodes yet. Benzino responds to everything — Snap Dogg, the Eminem beef, Mom's Spaghetti, and his deep love for Detroit.",
  },
  {
    id: "6HhioE2Fu7s",
    title: "Get Money Mark speaks on Kid L Situation, Gambling & Talks about going Viral for being Cheated",
    guest: "Get Money Mark",
    views: "294",
    duration: "41:26",
    description: "Get Money Mark gets candid about the Kid L situation, his gambling life, and going viral for being cheated on.",
  },
  {
    id: "KeyA4RdJx7E",
    title: "Scatz & Xd Hxncho Talk About Life in Flint, Thoughts on Signing a Deal & Their Inspirations in Rap",
    guest: "Scatz & Xd Hxncho",
    views: "424",
    duration: "1:03:31",
    description: "Flint artists Scatz and Xd Hxncho chop it up about growing up in Flint, their rap inspirations, and thoughts on the music industry.",
  },
  {
    id: "r5ODY0DHPEM",
    title: "WheelChair Goat Talks About Being Shot At 9 Yrs Old & Always Having a Passion for Music",
    guest: "WheelChair Goat",
    views: "224",
    duration: "1:00:56",
    description: "WheelChair Goat shares his powerful story of being shot at just 9 years old and how music became his lifeline and passion.",
  },
  {
    id: "utqmCzkVlVM",
    title: "SmokeCamp Chino Speaks About Growing Up on The Eastside of Detroit & Pushing Peace for The Youth",
    guest: "SmokeCamp Chino",
    views: "3.8K",
    duration: "49:20",
    description: "SmokeCamp Chino talks about his Eastside Detroit roots and his mission to push peace and positivity for the next generation.",
  },
  {
    id: "1AR-tzLaGGo",
    title: "Young Ra Talks About Team734, Coming up in Ypsi & New Movie",
    guest: "Young Ra",
    views: "50",
    duration: "N/A",
    description: "Young Ra discusses Team734, his come-up in Ypsilanti, and his new movie project.",
  },
  {
    id: "br1720Ui1_M",
    title: "ChuckyBaby Gamo Talks About The Meaning Behind 4Way, Working with Snap Dogg & Relationship Advice",
    guest: "ChuckyBaby Gamo",
    views: "1.2K",
    duration: "N/A",
    description: "ChuckyBaby Gamo breaks down the meaning behind 4Way, his work with Snap Dogg, and drops some relationship advice.",
  },
  {
    id: "jX5Gm-tTK0w",
    title: "Richtown Luie Speaks on Misunderstanding With Rio, Running Richtown Magazine & Meeting IceWear Vezzo",
    guest: "Richtown Luie",
    views: "N/A",
    duration: "N/A",
    description: "Richtown Luie clears the air on his misunderstanding with Rio, talks about running Richtown Magazine, and his encounter with IceWear Vezzo.",
  },
  {
    id: "L7paV9qtk-A",
    title: "MIA JayC Talks About Working With Detroit Legends & Coming Up As A Producer In The City",
    guest: "MIA JayC",
    views: "113",
    duration: "N/A",
    description: "Producer MIA JayC details his journey coming up in Detroit, working with legends, and building his name in the city.",
  },
  {
    id: "gDlp9bNAhqY",
    title: "RJ Lamont Talks About How He Started Making Beats, Tour With Baby Tron & Gives Advice For Artists",
    guest: "RJ Lamont",
    views: "N/A",
    duration: "N/A",
    description: "RJ Lamont talks beatmaking origins, touring with Baby Tron, and shares real advice for up-and-coming artists.",
  },
  {
    id: "SVhIfUydHDc",
    title: "Chuckie Ceo Talks About Getting In The Rap Game At A Young Age, Signing with IUR & More",
    guest: "Chuckie Ceo",
    views: "436",
    duration: "N/A",
    description: "Chuckie Ceo discusses getting into rap at a young age, signing with IUR, and his vision for his career.",
  },
  {
    id: "YE47Q_JJm-k",
    title: "Tiffany Blade Speaks About Being An Independent Artist, Her Relationship to Blade Icewood & More",
    guest: "Tiffany Blade",
    views: "N/A",
    duration: "N/A",
    description: "Tiffany Blade opens up about her journey as an independent artist and her connection to the legendary Blade Icewood.",
  },
];

export default function MeetingWithTheMitten() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = EPISODES.filter(ep =>
    ep.guest.toLowerCase().includes(search.toLowerCase()) ||
    ep.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/60 via-[#080808] to-[#080808]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl" />
        <div className="container relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <img src={LOGO} alt="Murder Mitten Media" className="w-16 h-16 rounded-full object-cover border-2 border-red-600/40" />
            <div>
              <p className="text-red-500 text-xs uppercase tracking-[0.3em] mb-1 font-semibold">🎙 Official Podcast</p>
              <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase leading-none">
                MEETING WITH<br /><span className="text-red-600">THE MITTEN</span>
              </h1>
            </div>
          </div>
          <p className="text-white/50 max-w-2xl text-lg leading-relaxed mb-6">
            In-depth conversations with Michigan's most compelling artists, producers, and culture figures.
            Real talk. No filter. Straight from the trenches.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="border border-white/10 text-white/40 px-4 py-2 text-sm uppercase tracking-widest">
              {EPISODES.length} Episodes
            </span>
            <a
              href="https://www.youtube.com/playlist?list=PLiW5X02rswZu7CaiF9liCbIMpxrsPkzvc"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
            >
              ▶ Full Playlist on YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="container pb-8">
        <input
          type="text"
          placeholder="Search episodes or guests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md bg-white/5 border border-white/10 focus:border-red-600/50 text-white placeholder:text-white/30 px-4 py-3 text-sm outline-none transition-colors"
        />
      </div>

      {/* Episodes grid */}
      <section className="pb-24">
        <div className="container">
          {playing && (
            <div className="mb-10">
              <div className="relative aspect-video max-w-3xl bg-black border border-red-600/30">
                <iframe
                  src={`https://www.youtube.com/embed/${playing}?autoplay=1`}
                  title="Now Playing"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <button
                onClick={() => setPlaying(null)}
                className="mt-3 text-xs text-white/30 hover:text-red-500 uppercase tracking-widest transition-colors"
              >
                ✕ Close Player
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((ep, i) => (
              <div
                key={ep.id}
                className="border border-white/10 bg-white/[0.02] hover:border-red-600/50 hover:bg-white/[0.04] transition-all duration-300 group overflow-hidden"
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                  onClick={() => setPlaying(ep.id)}
                >
                  <img
                    src={`https://img.youtube.com/vi/${ep.id}/hqdefault.jpg`}
                    alt={ep.guest}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(209,0,0,0.5)]">
                      <span className="text-white text-xl ml-1">▶</span>
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/70 text-white/60 text-xs px-2 py-0.5">
                    Ep. {i + 1}
                  </div>
                  {ep.duration !== "N/A" && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5">
                      {ep.duration}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-red-500 text-xs uppercase tracking-widest mb-1 font-semibold">{ep.guest}</p>
                  <h3 className="text-white text-sm font-semibold leading-snug mb-2 group-hover:text-red-400 transition-colors line-clamp-2">
                    {ep.title}
                  </h3>
                  <p className="text-white/40 text-xs leading-relaxed mb-3 line-clamp-2">{ep.description}</p>
                  <div className="flex items-center justify-between">
                    {ep.views !== "N/A" && (
                      <span className="text-white/30 text-xs">👁 {ep.views} views</span>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => setPlaying(ep.id)}
                        className="text-xs border border-red-600/40 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1 transition-all uppercase tracking-wider"
                      >
                        Watch
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${ep.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 px-3 py-1 transition-all uppercase tracking-wider"
                      >
                        YT
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-white/30">
              <p className="text-4xl mb-4">🎙</p>
              <p className="uppercase tracking-widest text-sm">No episodes found for "{search}"</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </div>
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
