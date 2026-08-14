import { useEffect, useMemo } from "react";
import { ArrowLeft, ExternalLink, Globe, Instagram, Link2, Loader2, Music2, Play, Youtube } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { getMusicEmbed, musicProviderLabel, musicProviderTheme } from "@/lib/musicEmbed";

const BRAND_LOGO = "/manus-storage/mmm_logo_8689da6b.png";

function getVisitorId() {
  const storageKey = "mmm-link-visitor-id";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return `anonymous-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getDeviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile" as const;
  if (width < 1024) return "tablet" as const;
  return "desktop" as const;
}

function getReferrerHost() {
  try {
    return document.referrer ? new URL(document.referrer).hostname.slice(0, 128) : null;
  } catch {
    return null;
  }
}

type PublicItem = {
  id: number;
  type: string;
  title: string;
  url: string | null;
  subtitle: string | null;
  platform: string | null;
  icon: string | null;
  thumbnailUrl: string | null;
};

function iconFor(item: PublicItem) {
  const key = `${item.icon ?? ""} ${item.platform ?? ""}`.toLowerCase();
  if (key.includes("instagram")) return Instagram;
  if (key.includes("youtube")) return Youtube;
  if (key.includes("music") || item.type === "release") return Music2;
  if (key.includes("website") || key.includes("web")) return Globe;
  return Link2;
}

function buttonClass(style: string) {
  if (style === "outline") return "border bg-transparent hover:bg-white/10";
  if (style === "soft") return "hover:brightness-110";
  if (style === "glass") return "border bg-white/10 backdrop-blur-md hover:bg-white/20";
  return "hover:brightness-110";
}

function MusicPlayerCard({ item, page, onOpen }: { item: PublicItem; page: { textColor: string; buttonColor: string; buttonStyle: string }; onOpen: () => void }) {
	  const embed = getMusicEmbed(item.url);
	  if (!embed) return null;
	  const theme = musicProviderTheme(embed.provider);
	  const providerLabel = musicProviderLabel(embed.provider);
	  const height = embed.provider === "apple_music" ? 150 : embed.provider === "youtube" ? 92 : 82;
	  return (
	    <div className="overflow-hidden rounded-2xl border shadow-lg" style={{ borderColor: `${theme.accent}66`, background: `linear-gradient(135deg, ${theme.soft}, rgba(0,0,0,0.28))` }}>
	      <div className="flex items-center gap-2.5 px-3 py-2.5">
	        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: theme.soft, color: theme.accent }}><Music2 className="h-4 w-4" /></span>}
	        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p>{item.subtitle && <p className="truncate text-[11px] opacity-65">{item.subtitle}</p>}<p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>{theme.name} MiniPlayer</p></div>
	        <a href={item.url ?? "#"} target="_blank" rel="noopener noreferrer" onClick={onOpen} aria-label={`Open ${item.title} in ${theme.name}`} className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-opacity hover:opacity-75" style={{ borderColor: `${theme.accent}88`, color: theme.accent }}>Open</a>
	      </div>
	      <iframe title={`${item.title} ${providerLabel}`} src={embed.src} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen className="block w-full border-0 bg-transparent" style={{ height }} />
	    </div>
	  );
	}

export default function PublicLinkPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const query = trpc.linkPages.publicBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const trackAnalytics = trpc.linkPages.trackAnalytics.useMutation();
  const visitorId = useMemo(() => getVisitorId(), []);
  const data = query.data as { page: { id: number; displayName: string | null; bio: string | null; avatarUrl: string | null; accentColor: string; backgroundColor: string; textColor: string; buttonColor: string; buttonStyle: string; showBranding: boolean }; items: PublicItem[] } | null | undefined;

  useEffect(() => {
    if (!data || !slug) return;
    const payload = {
      slug,
      visitorId,
      deviceType: getDeviceType(),
      referrerHost: getReferrerHost(),
    };
    const viewKey = `mmm-link-viewed:${slug}`;
    try {
      if (!window.sessionStorage.getItem(viewKey)) {
        trackAnalytics.mutate({ ...payload, eventType: "view" });
        window.sessionStorage.setItem(viewKey, "1");
      }
    } catch {
      trackAnalytics.mutate({ ...payload, eventType: "view" });
    }
    trackAnalytics.mutate({ ...payload, eventType: "presence" });
    const heartbeat = window.setInterval(() => {
      trackAnalytics.mutate({ ...payload, eventType: "presence" });
    }, 30_000);
    return () => window.clearInterval(heartbeat);
  }, [data, slug, visitorId, trackAnalytics.mutate]);

  const trackClick = (itemId: number) => {
    if (!slug) return;
    trackAnalytics.mutate({ slug, itemId, eventType: "click", visitorId, deviceType: getDeviceType(), referrerHost: getReferrerHost() });
  };

  if (query.isLoading) return <div className="min-h-screen bg-[#080808] text-white grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-red-500" /></div>;
  if (!data) return <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-5"><div className="text-center"><Link2 className="w-10 h-10 text-red-500 mx-auto mb-4" /><h1 className="font-['Anton'] text-4xl uppercase">Link page not found</h1><p className="text-white/45 mt-2">This creator page may be unpublished or the link is incorrect.</p><a href="/" className="inline-flex items-center gap-2 mt-6 border border-white/20 px-4 py-2 text-xs uppercase tracking-widest font-bold"><ArrowLeft className="w-4 h-4" />Back home</a></div></div>;

  const { page, items } = data;
  const displayName = page.displayName || "Creator";
  const visibleItems = items.filter((item) => item.type === "header" || item.url || item.type === "custom");

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 overflow-x-hidden" style={{ background: `radial-gradient(circle at 50% -10%, ${page.accentColor}33, transparent 36%), ${page.backgroundColor}`, color: page.textColor }}>
      <div className="mx-auto w-full max-w-xl">
        <header className="text-center">
          {page.avatarUrl ? <img src={page.avatarUrl} alt={displayName} className="w-24 h-24 mx-auto rounded-full object-cover ring-2 ring-white/25 shadow-2xl" /> : <div className="w-24 h-24 mx-auto rounded-full grid place-items-center text-4xl font-['Anton'] shadow-2xl" style={{ backgroundColor: page.accentColor }}>{displayName.charAt(0).toUpperCase()}</div>}
          <h1 className="font-['Anton'] text-3xl md:text-4xl uppercase mt-5">{displayName}</h1>
          {page.bio && <p className="max-w-md mx-auto text-sm leading-relaxed mt-3 opacity-70">{page.bio}</p>}
          <a href="/" aria-label="Murder Mitten Media home" className="inline-flex mt-5"><img src={BRAND_LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" /></a>
        </header>

        <section className="space-y-3 mt-8">
          {visibleItems.map((item) => {
            if (item.type === "header") return <div key={item.id} className="pt-4 pb-1 text-left text-xs uppercase tracking-[0.28em] opacity-55 font-bold">{item.title}</div>;
            const embed = item.type === "release" ? getMusicEmbed(item.url) : null;
            if (embed) return <MusicPlayerCard key={item.id} item={item} page={page} onOpen={() => trackClick(item.id)} />;
            const Icon = iconFor(item);
                    const content = <>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" /> : <span className="w-8 h-8 grid place-items-center rounded-full bg-black/20 shrink-0"><Icon className="w-4 h-4" /></span>}<span className="min-w-0 flex-1 text-left"><span className="block font-semibold truncate">{item.title}</span>{item.subtitle && <span className="block text-xs opacity-60 truncate mt-0.5">{item.subtitle}</span>}</span>{item.type === "release" ? <Play className="w-4 h-4 opacity-50 shrink-0" /> : <ExternalLink className="w-4 h-4 opacity-40 shrink-0" />}</>;
            const style = { color: page.textColor, backgroundColor: page.buttonStyle === "solid" || page.buttonStyle === "soft" ? page.buttonColor : undefined, borderColor: page.buttonStyle === "outline" || page.buttonStyle === "glass" ? page.buttonColor : undefined };
            return item.url ? <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(item.id)} style={style} className={`flex items-center gap-3 min-h-14 px-4 py-3 rounded-2xl transition-colors ${buttonClass(page.buttonStyle)}`}>{content}</a> : <div key={item.id} style={style} className={`flex items-center gap-3 min-h-14 px-4 py-3 rounded-2xl ${buttonClass(page.buttonStyle)}`}>{content}</div>;
          })}
        </section>

        {page.showBranding && <footer className="text-center mt-12"><a href="/create-a-link" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/35 hover:text-white/70"><Link2 className="w-3 h-3" />Create your own link page</a></footer>}
      </div>
    </main>
  );
}
