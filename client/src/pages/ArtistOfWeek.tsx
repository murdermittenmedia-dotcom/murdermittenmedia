/* ============================================================
   MURDER MITTEN MEDIA — Artist of the Month editorial feature
   September 2026: Shaudy Kash
   ============================================================ */
import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";

const INTERVIEWS = [
  {
    id: "2LqNPNOsS5w",
    title: "Shaudy Kash Interview | Meeting With The Mitten",
    label: "Featured interview",
    duration: "33:19",
    description: "Shaudy Kash sits down with Murder Mitten Media for a direct conversation about his story, his sound, and what is next for the artist.",
  },
  {
    id: "FiXQViDNP9Q",
    title: "DJStr8Cash Interview | Meeting With The Mitten",
    label: "Season 2 catalog",
    duration: "17:42",
    description: "A new Meeting With The Mitten conversation from the latest season of the Murder Mitten interview series.",
  },
  {
    id: "L-X7rR0F4oM",
    title: "Art Decco Interview | Meeting With The Mitten",
    label: "Season 2 catalog",
    duration: "40:38",
    description: "Art Decco joins the Mitten for an honest conversation about music, movement, and building a name in Michigan.",
  },
  {
    id: "Tob-pLXFj2k",
    title: "BandGang Javar Interview — Meeting With The Mitten S2: E1",
    label: "Season 2 · Episode 1",
    duration: "23:42",
    description: "The Season 2 opener from the official Meeting With The Mitten catalog.",
  },
] as const;

const ARTICLE = [
  {
    heading: "A voice with something to say",
    body: "Shaudy Kash represents the kind of artist Murder Mitten Media was built to document: focused, local, and impossible to overlook. His story is still unfolding, but the intention is already clear. This is an artist using every release, appearance, and conversation to sharpen the picture of who he is.",
  },
  {
    heading: "The sound of the Mitten",
    body: "Michigan artists have always carried a particular balance of pressure and personality. Shaudy Kash brings that same balance into his music — a sound grounded in where he comes from, but open to wherever the next record can go. The result is music that feels personal without losing its edge.",
  },
  {
    heading: "Why this interview matters",
    body: "The Meeting With The Mitten interview gives Shaudy room to speak beyond a caption or a single. He talks through the person behind the artist, the work behind the momentum, and the perspective that keeps him moving. It is the kind of conversation that lets listeners hear the context behind the catalog.",
  },
  {
    heading: "The next chapter",
    body: "Artist of the Month is not a finish line. It is a marker. Shaudy Kash is entering this next chapter with the attention of the Mitten behind him and a catalog that can keep expanding. Murder Mitten Media will be watching the releases, the rooms, and the moments that come next.",
  },
] as const;

type Interview = (typeof INTERVIEWS)[number];

function VideoCard({ episode, onPlay }: { episode: Interview; onPlay: () => void }) {
  return (
    <article className="group overflow-hidden border border-white/10 bg-white/[0.025] transition hover:border-red-600/60 hover:bg-red-950/10">
      <button type="button" onClick={onPlay} className="relative block aspect-video w-full overflow-hidden bg-black text-left">
        <img src={`https://img.youtube.com/vi/${episode.id}/hqdefault.jpg`} alt={episode.title} className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        <span className="absolute left-3 top-3 bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">{episode.label}</span>
        <span className="absolute bottom-3 right-3 bg-black/85 px-2 py-1 text-xs text-white">{episode.duration}</span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-lg text-white shadow-[0_0_30px_rgba(209,0,0,.45)]">▶</span></span>
      </button>
      <div className="p-4">
        <h3 className="font-['Anton'] text-xl uppercase leading-tight text-white">{episode.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/45">{episode.description}</p>
        <button type="button" onClick={onPlay} className="mt-4 text-xs font-bold uppercase tracking-widest text-red-400 hover:text-white">Watch interview →</button>
      </div>
    </article>
  );
}

export default function ArtistOfWeek() {
  const { data: dbArtist } = trpc.artistOfWeek.getCurrent.useQuery();
  const [activeVideo, setActiveVideo] = useState<Interview>(INTERVIEWS[0]);
  const artistName = dbArtist?.artistName || "Shaudy Kash";
  const imageUrl = dbArtist?.imageUrl || `https://img.youtube.com/vi/${INTERVIEWS[0].id}/maxresdefault.jpg`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <SiteNav />
      <main>
        <section className="relative overflow-hidden border-b border-white/10 pt-28 pb-16">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/35 via-[#080808] to-[#080808]" />
          <div className="container relative z-10">
            <div className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[.3em] text-red-500"><span className="h-px w-10 bg-red-600" /> September 2026 · Artist of the Month</div>
            <div className="grid items-end gap-10 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <div className="mb-7 h-36 w-36 overflow-hidden rounded-full border-2 border-red-600/60 shadow-[0_0_40px_rgba(209,0,0,.25)]"><img src={imageUrl} alt={artistName} className="h-full w-full object-cover" /></div>
                <p className="mb-3 text-sm uppercase tracking-[.25em] text-white/45">Murder Mitten Media presents</p>
                <h1 className="font-['Anton'] text-7xl uppercase leading-[.88] sm:text-8xl">SHAUDY <span className="text-red-600">KASH</span></h1>
                <p className="mt-6 max-w-xl border-l-2 border-red-600 pl-4 text-xl italic text-white/65">A new voice, a real story, and the next chapter of Michigan music.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {dbArtist?.instagramUrl && <a href={dbArtist.instagramUrl} target="_blank" rel="noopener noreferrer" className="border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/65 hover:border-red-500 hover:text-white">Instagram</a>}
                  {dbArtist?.youtubeUrl && <a href={dbArtist.youtubeUrl} target="_blank" rel="noopener noreferrer" className="border border-red-600/50 px-4 py-2 text-xs uppercase tracking-widest text-red-400 hover:bg-red-600 hover:text-white">YouTube</a>}
                  <a href="/podcast" className="border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/65 hover:border-red-500 hover:text-white">Full interview catalog</a>
                </div>
              </div>
              <div className="overflow-hidden border border-white/10 bg-black shadow-2xl">
                <div className="aspect-video"><iframe key={activeVideo.id} src={`https://www.youtube.com/embed/${activeVideo.id}?rel=0`} title={activeVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" /></div>
                <div className="border-t border-white/10 p-4"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-red-500">Featured Meeting With The Mitten interview</p><h2 className="mt-2 font-['Anton'] text-2xl uppercase">{activeVideo.title}</h2></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 py-16">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
              <article className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[.3em] text-red-500">The full feature</p>
                <h2 className="mt-3 font-['Anton'] text-5xl uppercase leading-none sm:text-6xl">Meet <span className="text-red-600">Shaudy Kash</span></h2>
                <p className="mt-6 text-xl leading-relaxed text-white/65">{dbArtist?.bio || "Shaudy Kash is Murder Mitten Media’s September Artist of the Month. This is the story behind the artist, the sound, and the interview."}</p>
                <div className="mt-10 space-y-9">{ARTICLE.map(section => <div key={section.heading}><h3 className="font-['Anton'] text-3xl uppercase text-white">{section.heading}</h3><p className="mt-3 text-base leading-8 text-white/55">{section.body}</p></div>)}</div>
              </article>
              <aside className="h-fit border border-red-600/30 bg-red-600/5 p-5"><p className="text-xs font-bold uppercase tracking-[.25em] text-red-500">September spotlight</p><div className="mt-5 space-y-4 text-sm text-white/60"><p><strong className="block text-2xl font-bold text-white">01</strong> Artist of the Month</p><p><strong className="block text-2xl font-bold text-white">S2</strong> Meeting With The Mitten</p><p><strong className="block text-2xl font-bold text-white">33:19</strong> Featured interview</p></div><a href="#catalog" className="mt-7 block bg-red-600 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-white hover:bg-red-500">Explore the catalog</a></aside>
            </div>
          </div>
        </section>

        <section id="catalog" className="py-16">
          <div className="container">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.3em] text-red-500">Interview catalog</p><h2 className="mt-2 font-['Anton'] text-5xl uppercase">Meeting With The <span className="text-red-600">Mitten</span></h2></div><a href="/podcast" className="text-xs font-bold uppercase tracking-widest text-white/45 hover:text-white">View all episodes →</a></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{INTERVIEWS.map(episode => <VideoCard key={episode.id} episode={episode} onPlay={() => setActiveVideo(episode)} />)}</div>
          </div>
        </section>
      </main>
      {activeVideo && <div className="sr-only" aria-live="polite">Playing {activeVideo.title}</div>}
    </div>
  );
}
