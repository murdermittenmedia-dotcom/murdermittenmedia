import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Flame, Mic2, Play, Radio, ShoppingBag, Sparkles, Trophy, Zap } from "lucide-react";
import { Link } from "wouter";
import { SiteNav } from "@/components/SiteNav";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { trpc } from "@/lib/trpc";
import { io } from "socket.io-client";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const FEATURE_CARDS = [
  { href: "/news", label: "Articles", kicker: "The newsroom", description: "Original editorials, artist profiles, interviews, and Michigan culture stories.", icon: BookOpen, tone: "red", action: "Read editorials" },
  { href: "/beats", label: "Buy Beats", kicker: "Built for the next record", description: "Browse producer catalogs, preview the sound, and license beats with clear terms.", icon: Play, tone: "violet", action: "Browse marketplace" },
  { href: "/merch", label: "Buy Merch", kicker: "Wear the Mitten", description: "Shop the latest Murder Mitten drops, colorways, and limited-run pieces.", icon: ShoppingBag, tone: "yellow", action: "Shop the drop" },
  { href: "/promo", label: "Buy Promo", kicker: "Get seen", description: "Put your music and brand in front of the audience that is already watching.", icon: Sparkles, tone: "green", action: "View packages" },
  { href: "/podcast", label: "Interviews", kicker: "Meeting with the Mitten", description: "Unfiltered conversations with artists, producers, and culture shapers.", icon: Radio, tone: "blue", action: "Watch interviews" },
  { href: "/mic", label: "One Mics", kicker: "No studio tricks", description: "Raw one-mic performances from Michigan artists. Just the voice and the bars.", icon: Mic2, tone: "orange", action: "Watch performances" },
  { href: "/daily-wheel", label: "Daily Wheel", kicker: "Your daily shot", description: "Spin for a chance at free promo and new prizes. Come back every day.", icon: Zap, tone: "amber", action: "Spin the wheel" },
  { href: "/fire-or-trash", label: "Fire or Trash", kicker: "You decide", description: "Rate new submissions, back the records you believe in, and shape the conversation.", icon: Flame, tone: "pink", action: "Start rating" },
] as const;

const toneClasses: Record<string, string> = {
  red: "border-red-600/30 hover:border-red-500/70 hover:shadow-red-950/30",
  violet: "border-violet-500/25 hover:border-violet-400/70 hover:shadow-violet-950/30",
  yellow: "border-yellow-500/25 hover:border-yellow-400/70 hover:shadow-yellow-950/30",
  green: "border-emerald-500/25 hover:border-emerald-400/70 hover:shadow-emerald-950/30",
  blue: "border-sky-500/25 hover:border-sky-400/70 hover:shadow-sky-950/30",
  orange: "border-orange-500/25 hover:border-orange-400/70 hover:shadow-orange-950/30",
  amber: "border-amber-500/25 hover:border-amber-400/70 hover:shadow-amber-950/30",
  pink: "border-pink-500/25 hover:border-pink-400/70 hover:shadow-pink-950/30",
};

function FeatureCard({ feature }: { feature: typeof FEATURE_CARDS[number] }) {
  const Icon = feature.icon;
  return (
    <Link href={feature.href} className={`group relative flex min-h-[245px] flex-col justify-between overflow-hidden border bg-white/[0.025] p-6 shadow-2xl transition duration-300 hover:-translate-y-1 ${toneClasses[feature.tone]}`}>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/[0.035] blur-2xl transition group-hover:bg-red-500/10" />
      <div className="relative"><div className="mb-7 flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center border border-white/15 bg-black/30 text-white/80"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-5 w-5 text-white/25 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white" /></div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400/80">{feature.kicker}</p><h3 className="mt-2 font-['Anton'] text-3xl uppercase leading-none text-white transition group-hover:text-red-200">{feature.label}</h3><p className="mt-4 max-w-xs text-sm leading-6 text-white/45">{feature.description}</p></div>
      <span className="relative mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 transition group-hover:text-white">{feature.action} <span className="ml-1 text-red-500">→</span></span>
    </Link>
  );
}

export default function Home() {
  const { anyLive, reviewIsLive, warsIsLive, activeCookUpStreams } = useLiveStatus();
  const { data: articles = [], isLoading: articlesLoading } = trpc.news.getArticles.useQuery(undefined, { staleTime: 60_000 });
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    document.title = "Murder Mitten Media — Detroit Rap, Culture & Michigan Editorials";
    const socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
    socket.on("presence:count", (count: number) => setOnlineUsers(Math.max(0, count)));
    return () => { socket.disconnect(); };
  }, []);

  const leadArticles = articles.slice(0, 3) as any[];
  const liveCount = Number(anyLive) + Number(reviewIsLive) + Number(warsIsLive) + activeCookUpStreams.length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <SiteNav />
      {anyLive && <div className="border-b border-red-600/40 bg-red-600/10"><div className="container flex flex-wrap items-center gap-3 py-3"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live now</span>{reviewIsLive && <Link href="/review" className="border border-red-500/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-red-600/20">Music Review →</Link>}{warsIsLive && <Link href="/music-wars" className="border border-orange-500/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-orange-600/20">Music Wars →</Link>}{activeCookUpStreams.slice(0, 2).map((stream: any) => <Link key={stream.id} href={`/cookup/${stream.id}`} className="border border-sky-500/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-sky-600/20">{stream.title || "Cook Up"} →</Link>)}</div></div>}

      <section className="relative isolate overflow-hidden border-b border-white/10" style={{ backgroundImage: "url(https://d2xsxph8kpxj0f.cloudfront.net/310519663536856749/C3bFVoBEaMVXmYZLRysziz/michigan_map_bg-krHiyyxiYSMDWbGnE9vT6Z.webp)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_35%,rgba(172,0,0,.2),transparent_32%),linear-gradient(90deg,#080808_8%,rgba(8,8,8,.9)_44%,rgba(8,8,8,.45))]" />
        <div className="container relative z-10 flex min-h-[680px] items-end py-24 md:min-h-[760px] md:items-center md:py-28"><div className="max-w-3xl"><div className="mb-7 flex items-center gap-3"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /><span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/45">Detroit · Flint · Michigan · Est. 2022</span></div><div className="flex items-center gap-5"><img src={LOGO} alt="Murder Mitten Media" className="hidden h-20 w-20 rounded-full border border-red-600/40 shadow-[0_0_35px_rgba(209,0,0,.25)] sm:block" /><h1 className="font-['Anton'] text-7xl uppercase leading-[.82] tracking-tight sm:text-8xl md:text-9xl">Murder<br /><span className="text-red-600">Mitten</span><br />Media</h1></div><p className="mt-8 max-w-xl border-l-2 border-red-600 pl-5 text-lg leading-8 text-white/55">Where the industry watches the trenches.<span className="mt-1 block text-sm text-white/30">Editorials · Music · Culture · Community</span></p><div className="mt-9 flex flex-wrap gap-3"><Link href="/news" className="inline-flex items-center gap-2 bg-red-600 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] transition hover:bg-red-500">Read the editorials <ArrowUpRight className="h-4 w-4" /></Link><Link href="/beats" className="inline-flex items-center gap-2 border border-white/25 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/75 transition hover:border-white hover:text-white">Buy beats <ArrowUpRight className="h-4 w-4" /></Link></div><div className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-5"><div><p className="font-['Anton'] text-3xl">46.5K</p><p className="text-[9px] uppercase tracking-widest text-white/35">Followers</p></div><div><p className="font-['Anton'] text-3xl">{onlineUsers}</p><p className="text-[9px] uppercase tracking-widest text-white/35">Online now</p></div><div><p className="font-['Anton'] text-3xl">{liveCount}</p><p className="text-[9px] uppercase tracking-widest text-white/35">Live channels</p></div></div></div></div>
      </section>

      <section className="border-b border-white/10 bg-[#0b0b0b] py-20 md:py-24"><div className="container"><div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-4 flex items-center gap-3"><span className="h-px w-8 bg-red-600" /><span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">Everything Murder Mitten</span></div><h2 className="font-['Anton'] text-5xl uppercase leading-none md:text-7xl">Pull up.<br /><span className="text-red-600">Pick a lane.</span></h2></div><p className="max-w-sm text-sm leading-6 text-white/40">The front door to the culture. Read, watch, shop, submit, rate, and support Michigan artists in one place.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURE_CARDS.map(feature => <FeatureCard key={feature.href} feature={feature} />)}</div></div></section>

      <section className="border-b border-white/10 bg-gradient-to-br from-red-950/20 via-[#080808] to-[#080808] py-20"><div className="container"><div className="mb-8 flex items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-3"><span className="h-px w-8 bg-red-600" /><span className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">From the newsroom</span></div><h2 className="font-['Anton'] text-5xl uppercase leading-none md:text-6xl">Latest <span className="text-red-600">Editorials</span></h2></div><Link href="/news" className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45 hover:text-white sm:flex">View all <ArrowUpRight className="h-4 w-4" /></Link></div>{articlesLoading ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-64 animate-pulse border border-white/10 bg-white/[.03]" />)}</div> : leadArticles.length ? <div className="grid gap-4 md:grid-cols-3">{leadArticles.map((article, index) => <Link key={article.id} href={`/news/${article.slug}`} className={`group overflow-hidden border border-white/10 bg-black/30 transition hover:-translate-y-1 hover:border-red-500/60 ${index === 0 ? "md:col-span-2" : ""}`}><div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-red-950 via-zinc-900 to-black">{article.thumbnailUrl ? <img src={article.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center font-['Anton'] text-5xl text-white/15">MMM</div>}<div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" /></div><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-red-400">{article.artistName || "Murder Mitten Editorial"}</p><h3 className="mt-2 line-clamp-2 font-['Anton'] text-2xl uppercase leading-tight text-white group-hover:text-red-300">{article.title}</h3><span className="mt-5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white">Read story <ArrowUpRight className="h-3 w-3" /></span></div></Link>)}</div> : <div className="border border-dashed border-white/15 p-8 text-sm text-white/45">New editorials are on the way.</div>}<Link href="/news" className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45 hover:text-white sm:hidden">View all editorials <ArrowUpRight className="h-4 w-4" /></Link></div></section>

      <footer className="border-t border-white/10 bg-[#060606] py-12"><div className="container flex flex-col justify-between gap-6 text-xs text-white/35 md:flex-row md:items-center"><div className="flex items-center gap-3"><img src={LOGO} alt="" className="h-9 w-9 rounded-full" /><span className="font-bold uppercase tracking-[0.2em] text-white/60">Murder Mitten Media</span></div><div className="flex flex-wrap gap-5 uppercase tracking-widest"><Link href="/news" className="hover:text-white">Articles</Link><Link href="/beats" className="hover:text-white">Beats</Link><Link href="/merch" className="hover:text-white">Merch</Link><Link href="/promo" className="hover:text-white">Promo</Link><Link href="/fire-or-trash" className="hover:text-white">Fire or Trash</Link></div><div>Detroit · Flint · Michigan</div></div></footer>
    </div>
  );
}
