/* ============================================================
   MURDER MITTEN MEDIA — Latest News / Instagram Feed
   Shows latest posts from @murdermittenmedia
   Auto-fetches from Instagram API (when configured) or shows
   curated static posts as fallback
   ============================================================ */

import { useState, useEffect } from "react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Heart, MessageCircle, RefreshCw, Instagram } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface NewsPost {
  id: string;
  caption: string;
  permalink: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  thumbnailUrl?: string;
  mediaUrl?: string;
  timestamp: string;
  likeCount?: number;
  commentsCount?: number;
}

// ─── Static fallback posts (curated from @murdermittenmedia) ──
const STATIC_POSTS: NewsPost[] = [
  {
    id: "static_1",
    caption: "Kid L just said the 'talentless rap wave' is over… but is it really though? 👀 For the last few years the game been flooded with fast drops, same flows, catchy but no real substance. The culture is starting to demand more. What do you think?",
    permalink: "https://www.instagram.com/p/DW7yvHVDURj/",
    mediaType: "CAROUSEL_ALBUM",
    timestamp: "2026-06-20T18:00:00Z",
    likeCount: 0,
    commentsCount: 0,
  },
  {
    id: "static_2",
    caption: "New footage just surfaced showing what really went down inside before everything escalated 👀 Detroit streets don't miss nothing. Stay locked in.",
    permalink: "https://www.instagram.com/p/DW7JKFTkZmV/",
    mediaType: "CAROUSEL_ALBUM",
    timestamp: "2026-06-19T20:00:00Z",
    likeCount: 293,
    commentsCount: 31,
  },
  {
    id: "static_3",
    caption: "@bigmoney.bigkey wasting ZERO time since touching back down… not even 60 days home and already locked in with @300ent 💯🔥 If you know, you know — 300 don't just stamp anybody. Detroit stay winning.",
    permalink: "https://www.instagram.com/p/DW7DVqVETHU/",
    mediaType: "CAROUSEL_ALBUM",
    timestamp: "2026-06-18T16:00:00Z",
    likeCount: 90,
    commentsCount: 1,
  },
  {
    id: "static_4",
    caption: "Babyfxce E just took his performance to another level, hitting the stage with Meta glasses and giving fans a real time POV of what it look like from his eyes. This is the future of live performance fr.",
    permalink: "https://www.instagram.com/p/DV_qt_jEaq1/",
    mediaType: "CAROUSEL_ALBUM",
    timestamp: "2026-06-15T14:00:00Z",
    likeCount: 3234,
    commentsCount: 41,
  },
  {
    id: "static_5",
    caption: "YLG stepping into a whole new lane with his first country record 'Summer Days.' The Michigan artist switching it up and it's already getting attention, even catching a co-sign from Luke Bryan. Michigan artists stay breaking barriers.",
    permalink: "https://www.instagram.com/p/DWMcyMUEf7N/",
    mediaType: "CAROUSEL_ALBUM",
    timestamp: "2026-06-12T12:00:00Z",
    likeCount: 56,
    commentsCount: 7,
  },
  {
    id: "static_6",
    caption: "BandGang just dropped a new visual — Detroit staying active. New Single 'Plastic Cup' dropping this week. The whole city locked in. 🎬🔥",
    permalink: "https://www.instagram.com/p/DWURFYAkb9s/",
    mediaType: "VIDEO",
    timestamp: "2026-06-10T22:00:00Z",
    likeCount: 72,
    commentsCount: 21,
  },
  {
    id: "static_7",
    caption: "ITSMANMAN is our Artist of the Month for June 2026. Detroit's rising force — MANMAN IVERSON is already making noise. Backed by a Propdemic co-sign, this is his moment. Read the full feature on the site.",
    permalink: "https://www.instagram.com/murdermittenmedia/",
    mediaType: "IMAGE",
    timestamp: "2026-06-01T10:00:00Z",
    likeCount: 412,
    commentsCount: 38,
  },
  {
    id: "static_8",
    caption: "Murder Mitten Mic is back. Raw one-mic performances from Michigan's hottest artists. No studio tricks — just bars. Catch the latest drops on our YouTube channel. Link in bio.",
    permalink: "https://www.instagram.com/murdermittenmedia/",
    mediaType: "VIDEO",
    timestamp: "2026-05-28T18:00:00Z",
    likeCount: 187,
    commentsCount: 14,
  },
];

// ─── Post card ────────────────────────────────────────────────
function PostCard({ post, index }: { post: NewsPost; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = post.caption.length > 200 ? post.caption.slice(0, 200) + "…" : post.caption;
  const typeLabel = post.mediaType === "VIDEO" ? "Video" : post.mediaType === "CAROUSEL_ALBUM" ? "Gallery" : "Post";
  const typeColor = post.mediaType === "VIDEO" ? "text-blue-400 border-blue-600/40" : post.mediaType === "CAROUSEL_ALBUM" ? "text-purple-400 border-purple-600/40" : "text-red-400 border-red-600/40";

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-white/10 bg-white/[0.02] hover:border-red-600/40 hover:bg-white/[0.04] transition-all duration-300 group"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Card header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white text-xs font-semibold">@murdermittenmedia</div>
              <div className="text-white/30 text-xs">{timeAgo(post.timestamp)}</div>
            </div>
          </div>
          <span className={`text-xs border px-2 py-0.5 uppercase tracking-widest font-semibold ${typeColor}`}>
            {typeLabel}
          </span>
        </div>

        {/* Caption */}
        <p className="text-white/75 text-sm leading-relaxed group-hover:text-white/90 transition-colors">
          {expanded ? post.caption : truncated}
        </p>
        {post.caption.length > 200 && (
          <button
            onClick={e => { e.preventDefault(); setExpanded(!expanded); }}
            className="text-red-500 text-xs mt-1 hover:text-red-400 transition-colors"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4 text-white/30 text-xs">
          {post.likeCount !== undefined && (
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              {post.likeCount.toLocaleString()}
            </span>
          )}
          {post.commentsCount !== undefined && (
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {post.commentsCount.toLocaleString()}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-red-500 text-xs group-hover:translate-x-0.5 transition-transform">
          View on Instagram <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </a>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function News() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM">("all");

  // Try to fetch live Instagram posts from backend
  const { data: livePosts, isLoading, refetch, isRefetching } = trpc.news.getPosts.useQuery(
    undefined,
    { retry: false }
  );

  // Use live posts if available, otherwise fall back to static
  const allPosts: NewsPost[] = (livePosts && livePosts.length > 0)
    ? livePosts as NewsPost[]
    : STATIC_POSTS;

  const isLive = livePosts && livePosts.length > 0;

  const filtered = allPosts.filter(post => {
    const matchesFilter = filter === "all" || post.mediaType === filter;
    const matchesSearch = !search || post.caption.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <div className="container pt-8 pb-16 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-px bg-red-600" />
            <span className="text-red-500 text-xs uppercase tracking-[0.3em] font-semibold">
              {isLive ? "Live Feed" : "Latest Posts"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-['Anton'] text-5xl md:text-6xl uppercase tracking-wide leading-none">
                LATEST<br /><span className="text-red-600">NEWS</span>
              </h1>
              <p className="text-white/40 text-sm mt-2">
                {isLive
                  ? "Live from @murdermittenmedia on Instagram"
                  : "Curated posts from @murdermittenmedia · Connect Instagram API for live updates"
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/murdermittenmedia/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-white/20 hover:border-red-600/50 text-white/60 hover:text-white px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all"
              >
                <Instagram className="w-3.5 h-3.5" />
                Follow
              </a>
              <button
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
                className="flex items-center gap-2 border border-white/10 hover:border-white/30 text-white/40 hover:text-white/70 px-3 py-2 text-xs transition-all disabled:opacity-40"
                title="Refresh feed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-white/5 border border-white/10 text-white placeholder:text-white/30 px-4 py-2.5 text-sm focus:outline-none focus:border-red-600/50 transition-colors"
          />
          <div className="flex items-center gap-2">
            {(["all", "IMAGE", "VIDEO", "CAROUSEL_ALBUM"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all ${
                  filter === f
                    ? "bg-red-600 text-white"
                    : "border border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                }`}
              >
                {f === "all" ? "All" : f === "CAROUSEL_ALBUM" ? "Gallery" : f === "VIDEO" ? "Video" : "Photo"}
              </button>
            ))}
          </div>
        </div>

        {/* Posts grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="border border-white/10 bg-white/[0.02] p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="h-3 bg-white/10 rounded w-32 mb-1" />
                    <div className="h-2 bg-white/5 rounded w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-white/10 rounded w-full" />
                  <div className="h-3 bg-white/10 rounded w-5/6" />
                  <div className="h-3 bg-white/10 rounded w-4/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <Instagram className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No posts match your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!isLive && (
          <div className="mt-8 border border-white/5 bg-white/[0.02] p-4 text-center">
            <p className="text-white/30 text-xs">
              Showing curated posts. For live auto-updating feed, configure Instagram API credentials.
            </p>
            <a
              href="https://www.instagram.com/murdermittenmedia/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs mt-2 transition-colors"
            >
              <Instagram className="w-3 h-3" />
              Follow @murdermittenmedia for the latest
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
