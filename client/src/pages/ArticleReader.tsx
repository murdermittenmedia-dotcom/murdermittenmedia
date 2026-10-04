import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, CalendarDays, ExternalLink, Image as ImageIcon, Link2, Music2, Play, Radio, Users } from "lucide-react";
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

function ArticleBody({ content, referenceImages = [] }: { content: string; referenceImages?: string[] }) {
  const lines = content.split(/\r?\n/);
  let proseBlocks = 0;
  let imageCursor = 0;
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
        proseBlocks += 1;
        const automaticImage = proseBlocks > 1 && proseBlocks % 3 === 0 && referenceImages[imageCursor];
        if (automaticImage) imageCursor += 1;
        return <div key={index}><p>{inlineParts(trimmed)}</p>{automaticImage && <figure className="my-8 overflow-hidden border border-white/10 bg-white/[0.03]"><img src={automaticImage} alt="Article reference" className="max-h-[520px] w-full object-cover" loading="lazy" /></figure>}</div>;
      })}
    </div>
  );
}

function CatalogEmbeds({ links }: { links: Array<{ platform: string; label: string; url: string; embedUrl?: string; category?: string }> }) {
  if (!links.length) return null;
  const musicPlatforms = new Set(["spotify", "apple", "soundcloud"]);
  const music = links.filter(link => link.embedUrl && musicPlatforms.has(link.platform));
  const watch = links.filter(link => link.embedUrl && link.platform === "youtube");
  const connect = links.filter(link => !link.embedUrl && ["instagram", "tiktok", "twitter", "facebook"].includes(link.platform));
  const more = links.filter(link => !link.embedUrl && !connect.includes(link));
  const embed = (link: typeof links[number], index: number) => <div key={`${link.url}-${index}`} className="overflow-hidden rounded-md border border-white/10 bg-black/50 shadow-[0_12px_40px_rgba(0,0,0,.25)]"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white"><Play className="h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500" /><span className="truncate">{link.label}</span></span><a href={link.url} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] uppercase tracking-widest text-white/35 transition hover:text-yellow-300">Open <ExternalLink className="ml-1 inline h-3 w-3" /></a></div><iframe title={`${link.label} ${link.platform} player`} src={link.embedUrl} className={`w-full border-0 ${link.platform === "youtube" ? "aspect-video" : link.platform === "spotify" ? "h-[352px]" : "h-[166px]"}`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" allowFullScreen /></div>;
  const buttons = (items: typeof links) => <div className="flex flex-wrap gap-3">{items.map((link, index) => <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer" className="group inline-flex min-h-12 items-center gap-3 border border-white/15 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/75 transition hover:-translate-y-0.5 hover:border-red-500 hover:bg-red-600/10 hover:text-white"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-red-400 group-hover:bg-red-500 group-hover:text-white">{link.category === "social" ? <Users className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}</span><span>{link.label}</span><ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-red-400" /></a>)}</div>;
  return <section className="my-10 space-y-8 border-y border-red-600/20 py-8">
    <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-400"><Radio className="h-4 w-4" /> Artist links</div><p className="text-sm leading-6 text-white/45">Listen to the catalog, watch the latest videos, and follow the artist without leaving the story.</p></div>
    {music.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Music2 className="h-5 w-5 text-yellow-300" /> Music</div><div className="grid gap-4">{music.map(embed)}</div></div>}
    {watch.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Play className="h-5 w-5 fill-red-500 text-red-500" /> Watch</div><div className="grid gap-4 md:grid-cols-2">{watch.map(embed)}</div></div>}
    {connect.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Users className="h-5 w-5 text-yellow-300" /> Connect</div>{buttons(connect)}</div>}
    {more.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Link2 className="h-5 w-5 text-red-400" /> More from the artist</div>{buttons(more)}</div>}
  </section>;
}

export default function ArticleReader() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const { data: article, isLoading } = trpc.news.getArticle.useQuery({ slug }, { enabled: Boolean(slug) });

  if (isLoading) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container pt-32 text-center text-white/40">Loading article...</div></div>;
  if (!article) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container pt-32 text-center"><p className="text-white/50">Article not found.</p><Link href="/news" className="mt-5 inline-flex items-center gap-2 text-red-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Back to Latest News</Link></div></div>;

  let referenceImages: string[] = [];
  let catalogLinks: Array<{ platform: string; label: string; url: string; embedUrl?: string; category?: string }> = [];
  try { referenceImages = article.referenceImages ? JSON.parse(article.referenceImages) : []; } catch { referenceImages = []; }
  try { catalogLinks = article.catalogLinks ? JSON.parse(article.catalogLinks) : []; } catch { catalogLinks = []; }
  const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Murder Mitten Media";

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="container max-w-5xl pt-24 pb-24 md:pt-28">
        <Link href="/news" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45 hover:text-white"><ArrowLeft className="w-4 h-4" /> Latest News</Link>
        <article className="overflow-hidden border border-white/10 bg-white/[0.02]">
          {article.thumbnailUrl && <div className="flex max-h-[680px] justify-center overflow-hidden bg-black"><img src={article.thumbnailUrl} alt="" className="max-h-[680px] w-full object-contain" /></div>}
          <div className="mx-auto max-w-3xl px-6 py-10 md:px-12 md:py-14">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-red-400"><span className="h-px w-8 bg-red-600" /> Murder Mitten Editorial <span className="text-white/25">/</span><span className="flex items-center gap-1 text-white/35"><CalendarDays className="h-3.5 w-3.5" /> {published}</span></div>
            <h1 className="font-['Anton'] text-5xl uppercase leading-[.95] tracking-wide md:text-7xl">{article.title}</h1>
            <ArticleBody content={article.content || article.caption} referenceImages={referenceImages} />
            {referenceImages.length > 0 && <section className="mt-14 border-t border-white/10 pt-8"><div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/45"><ImageIcon className="h-4 w-4 text-red-500" /> Reference Images</div><div className="grid gap-4 sm:grid-cols-2">{referenceImages.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden border border-white/10 bg-black"><img src={url} alt={`Reference ${index + 1}`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><div className="flex items-center justify-between px-3 py-2 text-xs text-white/35">View image <ExternalLink className="h-3 w-3" /></div></a>)}</div></section>}
            {catalogLinks.length > 0 && <CatalogEmbeds links={catalogLinks} />}
            <div className="mt-12 flex flex-wrap gap-3"><a href={article.permalink || "/news"} target={article.permalink ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/55 hover:border-red-600 hover:text-white">Source <ArrowUpRight className="h-3.5 w-3.5" /></a>{article.keywords && <span className="px-4 py-2 text-xs text-white/30">{article.keywords.split(",").map(k => `#${k.trim()}`).join("  ")}</span>}</div>
          </div>
        </article>
      </main>
    </div>
  );
}
