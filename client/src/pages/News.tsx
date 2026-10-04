import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ArticleCard({ article, featured = false }: { article: any; featured?: boolean }) {
  return (
    <a href={`/news/${article.slug}`} className={`group block overflow-hidden border border-white/10 bg-white/[0.025] transition duration-300 hover:-translate-y-0.5 hover:border-red-600/60 hover:bg-white/[0.05] ${featured ? "md:col-span-2" : ""}`}>
      <div className={`grid ${featured ? "md:grid-cols-[1.15fr_0.85fr]" : "grid-rows-[auto_1fr]"}`}>
        <div className={`relative overflow-hidden bg-[#111] ${featured ? "min-h-[260px] md:min-h-[360px]" : "aspect-[16/10]"}`}>
          {article.thumbnailUrl ? <img src={article.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="flex h-full min-h-44 items-center justify-center bg-gradient-to-br from-red-950/60 via-black to-white/[0.03]"><BookOpen className="h-10 w-10 text-red-500/50" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 border border-red-500/50 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-red-300">{article.mediaType === "ARTICLE" ? "Feature" : "Editorial"}</span>
        </div>
        <div className={`flex flex-col justify-between p-5 ${featured ? "md:p-8" : ""}`}>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35"><span>{formatDate(article.publishedAt || article.createdAt)}</span>{article.artistName && <><span className="text-red-500">•</span><span>{article.artistName}</span></>}</div>
            <h2 className={`font-['Anton'] uppercase leading-[0.95] text-white transition group-hover:text-red-200 ${featured ? "text-4xl md:text-6xl" : "text-2xl"}`}>{article.title}</h2>
            {article.caption && <p className={`mt-4 leading-relaxed text-white/45 ${featured ? "max-w-xl text-base" : "line-clamp-3 text-sm"}`}>{article.caption}</p>}
          </div>
          <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 transition group-hover:text-red-300">Read editorial <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
        </div>
      </div>
    </a>
  );
}

export default function News() {
  const [search, setSearch] = useState("");
  const { data: articles = [], isLoading, isError } = trpc.news.getArticles.useQuery(undefined, { staleTime: 60 * 1000 });
  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter((article: any) => [article.title, article.caption, article.artistName, article.seoDescription].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [articles, search]);
  const [lead, ...rest] = filteredArticles;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="container max-w-6xl px-4 pb-20 pt-10 md:pt-16">
        <header className="mb-10 border-b border-white/10 pb-8">
          <div className="mb-4 flex items-center gap-3"><span className="h-px w-9 bg-red-600" /><span className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-400">Murder Mitten Editorial Desk</span></div>
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end"><div><h1 className="font-['Anton'] text-6xl uppercase leading-[0.85] tracking-wide md:text-8xl">Latest <span className="text-red-600">News</span></h1><p className="mt-5 max-w-xl text-base leading-relaxed text-white/45">Original reporting, artist profiles, interviews, and culture stories from the people shaping Michigan music.</p></div><label className="relative block w-full md:w-72"><span className="sr-only">Search editorials</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search editorials" className="w-full border border-white/15 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-red-600/60" /></label></div>
        </header>

        {isLoading ? <div className="grid gap-5 md:grid-cols-2"><div className="h-[360px] animate-pulse bg-white/5 md:col-span-2" /><div className="h-72 animate-pulse bg-white/5" /><div className="h-72 animate-pulse bg-white/5" /></div> : isError ? <div className="border border-red-600/30 bg-red-950/20 p-10 text-center"><BookOpen className="mx-auto mb-4 h-9 w-9 text-red-400" /><h2 className="font-['Anton'] text-3xl uppercase">Editorials unavailable</h2><p className="mt-2 text-sm text-white/45">We couldn’t load the newsroom right now. Please try again shortly.</p></div> : filteredArticles.length === 0 ? <div className="border border-white/10 bg-white/[0.02] p-14 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-white/20" /><h2 className="font-['Anton'] text-3xl uppercase">No editorials found</h2><p className="mt-2 text-sm text-white/40">Try another search or check back for the next story.</p></div> : <><section className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/35"><BookOpen className="h-4 w-4 text-red-500" /> From the newsroom</div><span className="text-xs text-white/30">{filteredArticles.length} {filteredArticles.length === 1 ? "story" : "stories"}</span></section><div className="grid gap-5 md:grid-cols-2">{lead && <ArticleCard article={lead} featured />}{rest.map((article: any) => <ArticleCard key={article.id} article={article} />)}</div></>}
      </main>
    </div>
  );
}
