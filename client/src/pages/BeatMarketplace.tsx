import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { requestProfileCompletion } from "@/components/OnboardingModal";
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  Disc3,
  Edit3,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Youtube,
} from "lucide-react";

function cents(value: number) {
  return `$${(value / 100).toFixed(0)}`;
}

function BeatArtwork({ beat, large = false }: { beat: any; large?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-red-950 via-zinc-900 to-black ${large ? "aspect-square" : "aspect-[4/3]"}`}>
      {beat.artworkUrl ? (
        <img src={beat.artworkUrl} alt={`${beat.title} artwork`} className="h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full border border-red-500/20" />
          <div className="absolute bottom-5 left-5 font-['Anton'] text-5xl leading-none text-white/15">MMM</div>
          <Disc3 className="absolute bottom-5 right-5 h-12 w-12 text-red-500/80" />
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
      <div className="absolute bottom-3 right-3">
        {beat.youtubeUrl ? <a href={beat.youtubeUrl} target="_blank" rel="noreferrer" aria-label={`Preview ${beat.title} on YouTube`} className="flex items-center gap-2 border border-white/25 bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500"><Youtube className="h-4 w-4" />Preview</a> : <AudioPlayButton url={beat.previewFileUrl} title={beat.title} artist={beat.producerName} size={large ? "lg" : "md"} className="border border-white/25 bg-red-600 hover:bg-red-500" />}
      </div>
    </div>
  );
}

function BeatCard({ beat, isOwner, onEdit }: { beat: any; isOwner: boolean; onEdit: (id: number) => void }) {
  const lowest = beat.licenses?.length ? Math.min(...beat.licenses.map((license: any) => license.priceCents)) : null;
  return (
    <article className="group overflow-hidden border border-white/10 bg-[#101010] transition duration-200 hover:-translate-y-1 hover:border-red-500/50">
      <BeatArtwork beat={beat} />
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <Link href={`/beats/${beat.slug}`} className="block truncate font-['Anton'] text-xl uppercase tracking-wide text-white hover:text-red-400">{beat.title}</Link>
          <Link href={`/profile/${beat.producerId}`} className="mt-1 inline-flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 transition hover:text-red-400"><UserRound className="h-3 w-3" />{beat.producerName}</Link>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/42">
          {beat.genre && <span>{beat.genre}</span>}
          {beat.bpm && <><span className="text-white/15">/</span><span>{beat.bpm} BPM</span></>}
          {beat.musicalKey && <><span className="text-white/15">/</span><span>{beat.musicalKey}</span></>}
        </div>
        {beat.masterDeliveryStatus === "producer_required" && <p className="border border-yellow-500/25 bg-yellow-500/[.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-yellow-200">YouTube preview · master supplied after sale</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-white/45">{lowest === null ? "Licenses soon" : `From ${cents(lowest)}`}</span>
          {isOwner ? <button type="button" onClick={() => onEdit(beat.id)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-300 hover:text-yellow-100"><Edit3 className="h-3.5 w-3.5" />Edit</button> : <Link href={`/beats/${beat.slug}`} className="text-[10px] font-black uppercase tracking-widest text-red-400">View beat</Link>}
        </div>
      </div>
    </article>
  );
}

function ActionButton({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-12 items-center justify-center gap-2 px-5 text-xs font-black uppercase tracking-[0.14em] transition active:scale-[.98] ${secondary ? "border border-white/25 text-white/75 hover:border-white hover:text-white" : "bg-red-600 text-white shadow-[0_0_28px_rgba(209,0,0,.2)] hover:bg-red-500"}`}>{label}<ArrowRight className="h-4 w-4" /></button>;
}

export default function BeatMarketplace() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string | undefined>();
  const [sort, setSort] = useState<"newest" | "alphabetical" | "featured" | "popular">("newest");
  const { data: genres = [] } = trpc.beats.genres.useQuery();
  const { data: beats = [], isLoading } = trpc.beats.list.useQuery({ search: search || undefined, genre, sort });
  const activeGenres = useMemo(() => genres.slice(0, 10), [genres]);
  const catalogBeats = beats;
  const goProducer = () => {
    if (!user) {
      window.location.href = getLoginUrl("/beats/producer");
      return;
    }
    if (!user.profileComplete) {
      toast.info("Finish your profile here, then upload your beat.");
      requestProfileCompletion({ required: true });
      return;
    }
    navigate("/beats/producer");
  };
  const scrollToCatalog = () => document.getElementById("beat-catalog")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="overflow-hidden pb-24 pt-24 md:pb-16">
        <section className="relative border-b border-white/10 bg-[#090909]">
          <div className="pointer-events-none absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(circle at 82% 12%, rgba(209,0,0,.22), transparent 27%), radial-gradient(circle at 8% 85%, rgba(99,0,0,.18), transparent 32%), linear-gradient(115deg, transparent 0 56%, rgba(255,255,255,.025) 56.1% 56.25%, transparent 56.35%)" }} />
          <div className="container relative grid gap-12 py-12 md:grid-cols-[1.18fr_.82fr] md:items-end md:py-20 lg:gap-16">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[.28em] text-red-400"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /><MapPin className="h-3.5 w-3.5" />Built for Michigan's music community</div>
              <h1 className="max-w-4xl font-['Anton'] text-[clamp(3.7rem,12vw,8.8rem)] uppercase leading-[.82] tracking-tight">Michigan's<br /><span className="text-red-600">Beat</span><br />Marketplace</h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">Producers — put your beats where Michigan artists are looking. Upload your catalog, get discovered, and build your producer presence on Murder Mitten Media with clear terms and protected downloads. Free claim or secure checkout.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ActionButton label="Claim 30 Days Free" onClick={goProducer} /><ActionButton label="Browse the Beats" onClick={scrollToCatalog} secondary /></div>
              <button type="button" onClick={goProducer} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-red-500/45 bg-red-600/10 px-5 text-xs font-black uppercase tracking-[.14em] text-red-200 transition hover:border-red-400 hover:bg-red-600/20 sm:w-auto"><Upload className="h-4 w-4" />Upload Beats <ArrowRight className="h-4 w-4" /></button>
              <p className="mt-4 max-w-xl text-[11px] leading-relaxed text-white/35">Have a Pro invite? Sign in first, then claim the 30-day promotion. The annual plan and any payment terms are shown clearly before checkout.</p><p className="mt-2 text-[10px] font-black uppercase tracking-widest text-yellow-200">100% royalties with Pro</p>
            </div>
          </div>
        </section>

        <section className="border-y border-yellow-500/25 bg-gradient-to-r from-yellow-500/[.09] via-[#101010] to-red-900/[.08]"><div className="container grid gap-8 py-12 md:grid-cols-[1fr_auto] md:items-center md:py-16"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-yellow-300"><Sparkles className="h-4 w-4" />Current Pro promotion</div><h2 className="font-['Anton'] text-5xl uppercase leading-[.9] md:text-6xl">30 days of Pro.<br /><span className="text-yellow-300">Free.</span></h2><p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60">Selected producers can claim their first 30 days of Pro access free through an invite link. Pro unlocks unlimited uploads, 100% marketplace royalties, AI listing help, cover discovery, tagged client previews, direct payment destinations, and self-service cancellation.</p><p className="mt-4 text-sm font-black uppercase tracking-wide text-yellow-100">You keep 100% of your royalties.</p></div><div className="md:min-w-[250px]"><button type="button" onClick={goProducer} className="flex min-h-14 w-full items-center justify-center gap-2 bg-yellow-400 px-6 text-xs font-black uppercase tracking-[.14em] text-black transition hover:bg-yellow-300 active:scale-[.98]">Claim 30 Days Free <ArrowRight className="h-4 w-4" /></button><p className="mt-3 text-center text-[10px] leading-relaxed text-white/35">Sign in first. You will see the exact annual or monthly terms before payment.</p></div></div></section>

        <section id="beat-catalog" className="container py-14 md:py-20"><div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.28em] text-red-500">Real catalog. Real sound.</p><h2 className="mt-2 font-['Anton'] text-5xl uppercase">Browse the beats</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">Listen to actual marketplace uploads, check the producer, and see the licensing options before you make a move.</p></div><Link href="/beats/producer" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 hover:text-red-400">Producer dashboard <ChevronRight className="h-4 w-4" /></Link></div><div className="mb-6 grid gap-3 border border-white/10 bg-[#0d0d0d] p-3 lg:grid-cols-[1fr_auto_auto]"><label className="flex items-center gap-3 border border-white/10 bg-black/30 px-3 py-2.5"><Search className="h-4 w-4 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, mood, or tag" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25" /></label><label className="flex items-center gap-2 border border-white/10 px-3 py-2.5 text-xs text-white/55"><SlidersHorizontal className="h-4 w-4" /><select value={sort} onChange={(event) => setSort(event.target.value as any)} className="bg-transparent text-xs outline-none"><option className="bg-[#111]" value="newest">Newest</option><option className="bg-[#111]" value="alphabetical">Alphabetical A–Z</option><option className="bg-[#111]" value="popular">Most licensed</option><option className="bg-[#111]" value="featured">Featured</option></select></label><button onClick={() => { setSearch(""); setGenre(undefined); setSort("newest"); }} className="border border-white/10 px-4 text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white">Clear</button></div><div className="mb-7 flex gap-2 overflow-x-auto pb-2"><button onClick={() => setGenre(undefined)} className="shrink-0 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest">All beats</button>{activeGenres.map((item) => <button key={item} onClick={() => setGenre(item)} className={`shrink-0 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${genre === item ? "border-red-500 bg-red-600 text-white" : "border-white/15 text-white/50 hover:border-white/40"}`}>{item}</button>)}</div>{isLoading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse bg-white/5" />)}</div> : catalogBeats.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{catalogBeats.map((beat: any) => <BeatCard beat={beat} key={beat.id} isOwner={user?.id === beat.producerId} onEdit={(id) => navigate(`/beats/producer?edit=${id}`)} />)}</div> : <div className="border border-dashed border-white/15 py-16 text-center"><AudioLines className="mx-auto h-10 w-10 text-white/20" /><h3 className="mt-4 font-['Anton'] text-2xl uppercase">The catalog is loading up</h3><p className="mt-2 text-sm text-white/45">Be the first producer to put your sound in the room.</p></div>}</section>
        <section className="container pb-10"><div className="border border-white/10 bg-[#0e0e0e] p-6 md:flex md:items-center md:justify-between md:p-8"><div><p className="text-[10px] font-black uppercase tracking-[.28em] text-red-500">Ready when you are</p><h2 className="mt-2 font-['Anton'] text-4xl uppercase">Your next placement starts here.</h2></div><button type="button" onClick={goProducer} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 bg-red-600 px-5 text-xs font-black uppercase tracking-[.14em] hover:bg-red-500 md:mt-0">Open producer tools <Upload className="h-4 w-4" /></button></div></section>
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-red-600/35 bg-[#0b0000]/95 p-3 backdrop-blur md:hidden"><button type="button" onClick={goProducer} className="flex min-h-11 w-full items-center justify-center gap-2 bg-yellow-400 text-xs font-black uppercase tracking-[.14em] text-black">Claim 30 Days Pro Free <ArrowRight className="h-4 w-4" /></button></div>
    </div>
  );
}
