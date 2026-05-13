/* ============================================================
   MURDER MITTEN MEDIA — Latest Posts Page (Instagram Feed)
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { trpc } from "@/lib/trpc";
import { Instagram, Heart, MessageCircle, ExternalLink, RefreshCw, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SiteNav } from "@/components/SiteNav";

function timeAgo(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

function truncate(text: string, len: number) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

const MEDIA_TYPE_LABEL: Record<string, string> = {
  IMAGE: "Photo",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carousel",
};

export default function LatestPosts() {
  const { data: posts, isLoading, refetch, isFetching } = trpc.instagram.feed.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const hasInstagram = posts && posts.length > 0;
  const noToken = !isLoading && posts && posts.length === 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-16 z-10 backdrop-blur-sm">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="font-['Anton'] text-2xl tracking-wider flex items-center gap-3">
              <Instagram className="w-6 h-6 text-red-500" />
              LATEST <span className="text-red-600">POSTS</span>
            </h1>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-0.5">
              @murdermittenmedia · Instagram Feed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <a
              href="https://www.instagram.com/murdermittenmedia/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white font-semibold uppercase tracking-widest border border-red-600 text-red-500 px-4 py-1.5 hover:bg-red-600 hover:text-white transition-all duration-200"
            >
              Follow
            </a>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {/* No Instagram token configured */}
        {noToken && (
          <div className="text-center py-20 text-white/40">
            <Instagram className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-['Anton'] tracking-wider">Instagram feed not configured</p>
            <p className="text-sm mt-2 max-w-md mx-auto text-white/30">
              Follow us directly on Instagram for the latest content from Michigan's premier rap media brand.
            </p>
            <a
              href="https://www.instagram.com/murdermittenmedia/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 text-sm font-semibold uppercase tracking-widest transition-all"
            >
              <Instagram className="w-4 h-4" />
              @murdermittenmedia
            </a>
          </div>
        )}

        {/* Posts grid */}
        {hasInstagram && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(post => (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group border border-white/10 bg-white/[0.03] hover:border-red-600/40 hover:bg-white/[0.06] transition-all duration-300 block overflow-hidden"
              >
                {/* Media preview */}
                <div className="relative aspect-square bg-black overflow-hidden">
                  {post.mediaType === "VIDEO" ? (
                    <>
                      <img
                        src={post.thumbnailUrl || post.mediaUrl}
                        alt={truncate(post.caption, 60)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 border border-white/30 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={truncate(post.caption, 60)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  )}

                  {/* Media type badge */}
                  <div className="absolute top-2 left-2">
                    <span className="text-xs bg-black/70 text-white/80 px-2 py-0.5 font-medium">
                      {MEDIA_TYPE_LABEL[post.mediaType] ?? post.mediaType}
                    </span>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <div className="flex items-center gap-3 text-white text-sm">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4 fill-current text-red-500" /> {post.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" /> {post.comments.toLocaleString()}
                      </span>
                      <ExternalLink className="w-4 h-4 ml-auto opacity-70" />
                    </div>
                  </div>
                </div>

                {/* Caption */}
                <div className="p-3">
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-3 group-hover:text-white transition-colors">
                    {post.caption || <span className="text-white/30 italic">No caption</span>}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs text-white/30">
                    <span>{timeAgo(post.timestamp)}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {post.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> {post.comments.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
