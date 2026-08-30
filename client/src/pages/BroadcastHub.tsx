import { Radio, Swords, TrendingUp, Tv } from "lucide-react";

const views = [
  { href: "/broadcast/review", label: "Music Review", detail: "Current track, queue, judge panel", icon: Tv, tone: "red" },
  { href: "/broadcast/radio", label: "Live Radio", detail: "Now playing and next up", icon: Radio, tone: "blue" },
  { href: "/broadcast/rankings", label: "Rankings", detail: "Top artists and weekly heat", icon: TrendingUp, tone: "orange" },
  { href: "/broadcast/wars", label: "Music Wars", detail: "Matchup, voting, and scores", icon: Swords, tone: "purple" },
] as const;

export default function BroadcastHub() {
  return <main className="min-h-screen bg-[#080808] px-6 py-10 text-white sm:px-10"><div className="mx-auto max-w-5xl"><div className="mb-10 flex items-end justify-between gap-4 border-b border-white/10 pb-6"><div><p className="text-xs font-bold uppercase tracking-[0.28em] text-red-400">Broadcast command center</p><h1 className="mt-3 font-['Anton'] text-5xl uppercase sm:text-7xl">Choose a <span className="text-red-600">feed</span></h1><p className="mt-3 max-w-xl text-sm text-white/45 sm:text-base">Open a clean, no-chrome broadcast view for stream capture or a second display.</p></div><a href="/admin" className="hidden border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/55 hover:border-white/40 hover:text-white sm:block">Admin</a></div><div className="grid gap-4 sm:grid-cols-2">{views.map(({ href, label, detail, icon: Icon, tone }) => <a key={href} href={href} target="_blank" rel="noreferrer" className={`group border bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:bg-white/[0.07] ${tone === "red" ? "border-red-600/40 hover:border-red-500" : tone === "orange" ? "border-orange-500/30 hover:border-orange-400" : tone === "purple" ? "border-purple-500/30 hover:border-purple-400" : "border-blue-500/30 hover:border-blue-400"}`}><Icon className="h-7 w-7 text-red-400" /><h2 className="mt-8 font-['Anton'] text-3xl uppercase">{label}</h2><p className="mt-2 text-sm text-white/45">{detail}</p><span className="mt-6 inline-block text-xs font-bold uppercase tracking-widest text-white/55 group-hover:text-white">Open broadcast →</span></a>)}</div></div></main>;
}
