import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, CalendarDays, ExternalLink, Image as ImageIcon, Link2, MessageCircle, Music2, Play, Radio, Send, Shield, Trash2, Users } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

function inlineParts(text: string) {
  const token = /(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|https?:\/\/[^\s]+)/g;
  return text.split(token).filter(Boolean).map((part, index) => {
    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink) return <a key={index} href={markdownLink[2]} target="_blank" rel="noreferrer" className="text-red-400 underline decoration-red-400/40 underline-offset-4 hover:text-yellow-300">{markdownLink[1]}</a>;
    if (part.startsWith("http")) return <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all text-red-400 underline decoration-red-400/40 underline-offset-4 hover:text-yellow-300">{part}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index} className="text-white/90">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] text-yellow-200">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function isSourceHeading(value: string) {
  return /^(#{1,3}\s*)?(sources?|references?)\s*:?[\s]*$/i.test(value.trim());
}

function isAutomaticSubheadline(value: string) {
  const text = value.trim();
  if (!text || text.length > 92 || text.split(/\s+/).length > 12 || /[.!?]$/.test(text)) return false;
  if (/^https?:\/\//i.test(text) || /^[-*]\s/.test(text)) return false;
  return /^[A-Z0-9][A-Za-z0-9'’–—:&/()\- ]+$/.test(text) && (text === text.toUpperCase() || text.split(" ").filter(Boolean).every(word => /^[A-Z0-9]/.test(word)));
}

function ArticleBody({ content, referenceImages = [] }: { content: string; referenceImages?: string[] }) {
  const blocks = content.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  let imageCursor = 0;
  let proseBlocks = 0;
  let inSources = false;
  const rendered: React.ReactNode[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const first = lines[0] ?? "";
    if (isSourceHeading(first)) {
      inSources = true;
      const sourceLines = lines.slice(1);
      rendered.push(<aside key={`sources-${blockIndex}`} className="my-10 border-l-2 border-yellow-400/60 bg-yellow-400/[0.04] px-5 py-4 text-sm text-white/50"><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-300/80">Sources & references</div><div className="space-y-2">{sourceLines.map((line, index) => <div key={index}>{inlineParts(line.replace(/^[-*]\s+/, ""))}</div>)}</div></aside>);
      return;
    }
    if (inSources || /^(sources?|references?)\s*:/i.test(first)) {
      inSources = true;
      const sourceLines = lines.flatMap(line => line.replace(/^(sources?|references?)\s*:\s*/i, "").split(/\s*[,;]\s*/));
      rendered.push(<aside key={`sources-${blockIndex}`} className="my-8 border-l-2 border-yellow-400/60 bg-yellow-400/[0.04] px-5 py-4 text-sm text-white/50"><div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-300/80">Sources & references</div><div className="space-y-2">{sourceLines.map((line, index) => <div key={index}>{inlineParts(line.replace(/^[-*]\s+/, ""))}</div>)}</div></aside>);
      return;
    }
    const image = first.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (image && lines.length === 1) {
      rendered.push(<figure key={blockIndex} className="my-9 overflow-hidden border border-white/10 bg-white/[0.03]"><img src={image[2]} alt={image[1] || "Article reference image"} className="max-h-[620px] w-full object-contain" loading="lazy" /><figcaption className="px-4 py-3 text-xs text-white/35">{image[1]}</figcaption></figure>);
      return;
    }
    if (/^###\s+/.test(first)) {
      rendered.push(<h3 key={blockIndex} className="pt-6 font-['Anton'] text-2xl uppercase tracking-wide text-white">{inlineParts(first.replace(/^###\s+/, ""))}</h3>);
      return;
    }
    if (/^##\s+/.test(first)) {
      rendered.push(<h2 key={blockIndex} className="pt-8 font-['Anton'] text-3xl uppercase tracking-wide text-white">{inlineParts(first.replace(/^##\s+/, ""))}</h2>);
      return;
    }
    if (/^#\s+/.test(first)) {
      rendered.push(<h2 key={blockIndex} className="pt-8 font-['Anton'] text-4xl uppercase tracking-wide text-red-500">{inlineParts(first.replace(/^#\s+/, ""))}</h2>);
      return;
    }
    if (/^>\s+/.test(first)) {
      rendered.push(<blockquote key={blockIndex} className="my-7 border-l-2 border-red-600 pl-5 text-xl italic leading-8 text-white/65">{inlineParts(first.replace(/^>\s+/, ""))}</blockquote>);
      return;
    }
    if (lines.every(line => /^[-*]\s+/.test(line))) {
      rendered.push(<ul key={blockIndex} className="my-5 space-y-2 pl-6 text-white/70">{lines.map((line, index) => <li key={index} className="list-disc pl-2">{inlineParts(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>);
      return;
    }
    if (lines.length === 1 && isAutomaticSubheadline(first)) {
      rendered.push(<h3 key={blockIndex} className="pt-6 font-['Anton'] text-2xl uppercase tracking-wide text-red-300">{inlineParts(first)}</h3>);
      return;
    }
    proseBlocks += 1;
    const automaticImage = proseBlocks > 1 && proseBlocks % 3 === 0 && referenceImages[imageCursor];
    if (automaticImage) imageCursor += 1;
    rendered.push(<div key={blockIndex}><p className="mb-5">{lines.map((line, index) => <span key={index}>{index > 0 && <br />}{inlineParts(line)}</span>)}</p>{automaticImage && <figure className="my-9 overflow-hidden border border-white/10 bg-white/[0.03]"><img src={automaticImage} alt="Article reference" className="max-h-[520px] w-full object-contain" loading="lazy" /></figure>}</div>);
  });
  return <div className="article-prose text-[17px] leading-8 text-white/75">{rendered}</div>;
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
  return <section className="my-10 space-y-8 border-y border-red-600/20 py-8"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-red-400"><Radio className="h-4 w-4" /> Artist links</div><p className="text-sm leading-6 text-white/45">Listen to the catalog, watch the latest videos, and follow the artist without leaving the story.</p></div>{music.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Music2 className="h-5 w-5 text-yellow-300" /> Music</div><div className="grid gap-4">{music.map(embed)}</div></div>}{watch.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Play className="h-5 w-5 fill-red-500 text-red-500" /> Watch</div><div className="grid gap-4 md:grid-cols-2">{watch.map(embed)}</div></div>}{connect.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Users className="h-5 w-5 text-yellow-300" /> Connect</div>{buttons(connect)}</div>}{more.length > 0 && <div><div className="mb-4 flex items-center gap-2 font-['Anton'] text-2xl uppercase tracking-wide text-white"><Link2 className="h-5 w-5 text-red-400" /> More from the artist</div>{buttons(more)}</div>}</section>;
}

function ArticleComments({ slug }: { slug: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");
  const { data: comments = [], isLoading } = trpc.news.getComments.useQuery({ slug });
  const addComment = trpc.news.addComment.useMutation({ onSuccess: () => { setBody(""); utils.news.getComments.invalidate({ slug }); toast.success("Comment posted"); }, onError: error => toast.error(error.message) });
  const hideComment = trpc.news.adminHideComment.useMutation({ onSuccess: () => utils.news.getComments.invalidate({ slug }), onError: error => toast.error(error.message) });
  return <section className="mt-14 border-t border-white/10 pt-10"><div className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-red-400" /><h2 className="font-['Anton'] text-3xl uppercase">Reader <span className="text-red-600">comments</span></h2><span className="text-xs text-white/30">{comments.length}</span></div><p className="mt-2 text-sm text-white/40">Join the conversation without burying the story.</p>{user ? <form className="mt-6" onSubmit={event => { event.preventDefault(); if (body.trim()) addComment.mutate({ slug, body: body.trim() }); }}><textarea value={body} onChange={event => setBody(event.target.value.slice(0, 2000))} placeholder="Add your take…" rows={4} className="w-full resize-y border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-red-500/60" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-white/30">{body.length}/2000</span><button type="submit" disabled={!body.trim() || addComment.isPending} className="inline-flex items-center gap-2 bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-red-500 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> {addComment.isPending ? "Posting…" : "Post comment"}</button></div></form> : <div className="mt-6 border border-white/10 bg-white/[0.02] p-5"><p className="text-sm text-white/55">Sign in to add a comment.</p><a href={getLoginUrl()} className="mt-3 inline-flex items-center gap-2 border border-red-500/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-600/10">Sign in</a></div>}{isLoading ? <p className="mt-8 text-sm text-white/35">Loading comments…</p> : comments.length === 0 ? <p className="mt-8 text-sm text-white/35">No comments yet. Start the conversation.</p> : <div className="mt-8 space-y-4">{comments.map(({ comment, author }) => <article key={comment.id} className="border-l border-white/10 pl-4"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-white">{author?.artistName || author?.name || "Reader"}</span><span className="text-white/25">{new Date(comment.createdAt).toLocaleDateString()}</span>{author?.role === "admin" && <span className="inline-flex items-center gap-1 text-red-300"><Shield className="h-3 w-3" /> Admin</span>}{user?.role === "admin" && <button type="button" onClick={() => hideComment.mutate({ id: comment.id })} className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/30 hover:text-red-300"><Trash2 className="h-3 w-3" /> Hide</button>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">{comment.body}</p></article>)}</div>}</section>;
}

export default function ArticleReader() {
  const [, params] = useRoute("/news/:slug");
  const slug = params?.slug ?? "";
  const { data: article, isLoading } = trpc.news.getArticle.useQuery({ slug }, { enabled: Boolean(slug) });
  const referenceImages = useMemo(() => { try { return article?.referenceImages ? JSON.parse(article.referenceImages) : []; } catch { return []; } }, [article?.referenceImages]);
  const catalogLinks = useMemo(() => { try { return article?.catalogLinks ? JSON.parse(article.catalogLinks) : []; } catch { return []; } }, [article?.catalogLinks]);

  if (isLoading) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container pt-32 text-center text-white/40">Loading article...</div></div>;
  if (!article) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container pt-32 text-center"><p className="text-white/50">Article not found.</p><Link href="/news" className="mt-5 inline-flex items-center gap-2 text-red-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Latest News</Link></div></div>;

  const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Murder Mitten Media";
   return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><main className="container max-w-5xl pt-24 pb-24 md:pt-28"><Link href="/news" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4" /> Latest News</Link><article className="overflow-hidden border border-white/10 bg-white/[0.02]">{article.thumbnailUrl && <div className="flex max-h-[680px] justify-center overflow-hidden bg-black"><img src={article.thumbnailUrl} alt="" className="max-h-[680px] w-full object-contain" /></div>}<div className="mx-auto max-w-3xl px-6 py-10 md:px-12 md:py-14"><div className="mb-5 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-red-400"><span className="h-px w-8 bg-red-600" /> Murder Mitten Editorial <span className="text-white/25">/</span><span className="flex items-center gap-1 text-white/35"><CalendarDays className="h-3.5 w-3.5" /> {published}</span></div><h1 className="font-['Anton'] text-5xl uppercase leading-[.95] tracking-wide md:text-7xl">{article.title}</h1><ArticleBody content={article.content || article.caption} referenceImages={referenceImages} />{referenceImages.length > 0 && <section className="mt-14 border-t border-white/10 pt-8"><div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/45"><ImageIcon className="h-4 w-4 text-red-500" /> Reference Images</div><div className="grid gap-4 sm:grid-cols-2">{referenceImages.map((url: string, index: number) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden border border-white/10 bg-black"><img src={url} alt={`Reference ${index + 1}`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><div className="flex items-center justify-between px-3 py-2 text-xs text-white/35">View image <ExternalLink className="h-3 w-3" /></div></a>)}</div></section>}{catalogLinks.length > 0 && <CatalogEmbeds links={catalogLinks} />}<div className="mt-12 flex flex-wrap gap-3"><a href={article.permalink || "/news"} target={article.permalink ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/55 hover:border-red-600 hover:text-white">Source <ArrowUpRight className="h-3.5 w-3.5" /></a>{article.keywords && <span className="px-4 py-2 text-xs text-white/30">{article.keywords.split(",").map(k => `#${k.trim()}`).join("  ")}</span>}</div><ArticleComments slug={slug} /></div></article></main></div>;
}
