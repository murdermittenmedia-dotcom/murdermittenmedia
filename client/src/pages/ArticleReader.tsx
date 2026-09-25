import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, CalendarDays, ExternalLink, Image as ImageIcon } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";

function inlineParts(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    const markdown = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    const url = markdown?.[2] ?? (part.startsWith("http") ? part : null);
    if (!url) return <span key={index}>{part}</span>;
    return (
      <a key={index} href={url} target="_blank" rel="noreferrer" className="text-red-400 underline decoration-red-400/40 underline-offset-4 hover:text-yellow-300">
        {markdown?.[1] ?? part}
      </a>
    );
  });
}

function ArticleBody({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  return (
    <div className="space-y-5 text-white/75 text-[17px] leading-8">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
        if (image) return <figure key={index} className="my-8 overflow-hidden border border-white/10 bg-white/[0.03]"><img src={image[2]} alt={image[1] || "Article reference image"} className="w-full max-h-[620px] object-cover" loading="lazy" /><figcaption className="px-4 py-3 text-xs text-white/35">{image[1]}</figcaption></figure>;
        if (trimmed.startsWith("### ")) return <h3 key={index} className="pt-5 text-2xl font-semibold text-white">{inlineParts(trimmed.slice(4))}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={index} className="pt-7 font-['Anton'] text-3xl uppercase tracking-wide text-white">{inlineParts(trimmed.slice(3))}</h2>;
        if (trimmed.startsWith("# ")) return <h2 key={index} className="pt-7 font-['Anton'] text-4xl uppercase tracking-wide text-red-500">{inlineParts(trimmed.slice(2))}</h2>;
        if (trimmed.startsWith("> ")) return <blockquote key={index} className="border-l-2 border-red-600 pl-5 italic text-white/60">{inlineParts(trimmed.slice(2))}</blockquote>;
        if (trimmed.startsWith("- ")) return <li key={index} className="ml-5 list-disc pl-2">{inlineParts(trimmed.slice(2))}</li>;
        return <p key={index}>{inlineParts(trimmed)}</p>;
      })}
    </div>
  );
}

export default function ArticleReader() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const { data: article, isLoading } = trpc.news.getArticle.useQuery({ slug }, { enabled: Boolean(slug) });

  if (isLoading) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container py-28 text-center text-white/40">Loading article...</div></div>;
  if (!article) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container py-28 text-center"><p className="text-white/50">Article not found.</p><Link href="/news" className="mt-5 inline-flex items-center gap-2 text-red-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Back to Latest News</Link></div></div>;

  let referenceImages: string[] = [];
  try { referenceImages = article.referenceImages ? JSON.parse(article.referenceImages) : []; } catch { referenceImages = []; }
  const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Murder Mitten Media";

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="container max-w-5xl pt-8 pb-24">
        <Link href="/news" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45 hover:text-white"><ArrowLeft className="w-4 h-4" /> Latest News</Link>
        <article className="overflow-hidden border border-white/10 bg-white/[0.02]">
          {article.thumbnailUrl && <img src={article.thumbnailUrl} alt="" className="max-h-[560px] w-full object-cover" />}
          <div className="mx-auto max-w-3xl px-6 py-10 md:px-12 md:py-14">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-red-400"><span className="h-px w-8 bg-red-600" /> Murder Mitten Editorial <span className="text-white/25">/</span><span className="flex items-center gap-1 text-white/35"><CalendarDays className="h-3.5 w-3.5" /> {published}</span></div>
            <h1 className="font-['Anton'] text-5xl uppercase leading-[.95] tracking-wide md:text-7xl">{article.title}</h1>
            {article.caption && <p className="mt-6 border-l-2 border-red-600 pl-5 text-lg leading-8 text-white/55">{article.caption}</p>}
            <div className="my-10 h-px bg-white/10" />
            <ArticleBody content={article.content || article.caption} />
            {referenceImages.length > 0 && <section className="mt-14 border-t border-white/10 pt-8"><div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/45"><ImageIcon className="h-4 w-4 text-red-500" /> Reference Images</div><div className="grid gap-4 sm:grid-cols-2">{referenceImages.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden border border-white/10 bg-black"><img src={url} alt={`Reference ${index + 1}`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><div className="flex items-center justify-between px-3 py-2 text-xs text-white/35">View image <ExternalLink className="h-3 w-3" /></div></a>)}</div></section>}
            <div className="mt-12 flex flex-wrap gap-3"><a href={article.permalink || "/news"} target={article.permalink ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/55 hover:border-red-600 hover:text-white">Source <ArrowUpRight className="h-3.5 w-3.5" /></a>{article.keywords && <span className="px-4 py-2 text-xs text-white/30">{article.keywords.split(",").map(k => `#${k.trim()}`).join("  ")}</span>}</div>
          </div>
        </article>
      </main>
    </div>
  );
}
