/* ============================================================
   MURDER MITTEN MEDIA — Search Page
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, User, Music, MapPin, ExternalLink } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { TuneInButton } from "@/components/TuneInButton";
import { ArtistLink } from "@/components/ArtistLink";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = debouncedQuery.trim().length >= 2;

  const { data: users, isLoading: usersLoading } = trpc.search.users.useQuery(
    { query: debouncedQuery.trim() },
    { enabled }
  );

  const { data: songs, isLoading: songsLoading } = trpc.search.songs.useQuery(
    { query: debouncedQuery.trim() },
    { enabled }
  );

  const isLoading = usersLoading || songsLoading;
  const hasResults = (users && users.length > 0) || (songs && songs.length > 0);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-16 z-10 backdrop-blur-sm">
        <div className="container py-4">
          <h1 className="font-['Anton'] text-2xl tracking-wider mb-3">
            SEARCH <span className="text-red-600">EVERYTHING</span>
          </h1>
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search artists, songs..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-red-600/50"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-4xl">
        {/* Empty state */}
        {!debouncedQuery.trim() && (
          <div className="text-center py-20 text-white/30">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-['Anton'] tracking-wider">Start typing to search</p>
            <p className="text-sm mt-1">Find artists, songs, and more</p>
          </div>
        )}

        {/* Too short */}
        {debouncedQuery.trim().length === 1 && (
          <div className="text-center py-10 text-white/30 text-sm">
            Type at least 2 characters to search
          </div>
        )}

        {/* Loading */}
        {enabled && isLoading && (
          <div className="space-y-4">
            <div className="h-6 w-24 bg-white/5 animate-pulse mb-3" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {/* No results */}
        {enabled && !isLoading && !hasResults && (
          <div className="text-center py-16 text-white/40">
            <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-['Anton'] tracking-wider">No results for "{debouncedQuery}"</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {/* Results */}
        {enabled && !isLoading && hasResults && (
          <div className="space-y-8">
            {/* Artists */}
            {users && users.length > 0 && (
              <section>
                <h2 className="font-['Anton'] text-lg tracking-wider text-white mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-red-500" />
                  ARTISTS <span className="text-white/30 text-sm font-['DM_Sans'] normal-case tracking-normal">({users.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map(user => (
                    <Link key={user.id} href={`/profile/${user.id}`}>
                      <div className="border border-white/10 bg-white/[0.03] hover:border-red-600/30 hover:bg-white/[0.06] transition-all duration-200 p-4 cursor-pointer group">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-600/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-red-400 font-bold">
                                {(user.artistName ?? user.name ?? "?")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                              {user.artistName ?? user.name ?? "Unknown"}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              {user.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {user.city}
                                </span>
                              )}
                              {user.instagramHandle && (
                                <span className="flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" /> @{user.instagramHandle}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Songs */}
            {songs && songs.length > 0 && (
              <section>
                <h2 className="font-['Anton'] text-lg tracking-wider text-white mb-3 flex items-center gap-2">
                  <Music className="w-5 h-5 text-red-500" />
                  SONGS <span className="text-white/30 text-sm font-['DM_Sans'] normal-case tracking-normal">({songs.length})</span>
                </h2>
                <div className="space-y-1">
                  {songs.map(song => (
                    <div
                      key={song.id}
                      className="border border-white/10 bg-white/[0.03] hover:border-red-600/30 hover:bg-white/[0.06] transition-all duration-200 p-3 group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Tune In — redirects to live radio station */}
                        {(song.fileKey || song.externalUrl) ? (
                          <TuneInButton size="sm" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Music className="w-3 h-3 text-white/30" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white group-hover:text-red-400 transition-colors truncate text-sm">
                            {song.title}
                          </div>
                          <div className="text-xs text-white/40 truncate">
                            <ArtistLink artistName={song.artistName ?? 'Unknown'} userId={song.userId} />
                            {song.genre && <span className="ml-2 text-white/25">· {song.genre}</span>}
                          </div>
                        </div>

                        {song.externalUrl && (
                          <a
                            href={song.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
