/* ============================================================
   Shared site navigation for Murder Mitten Media
   Tab order per spec:
   1. Home  2. Live Now  3. Music Review  4. Murder Mitten Mic Drops
   5. Forum  6. Latest News  7. Explore  8. Leaderboards
   9. Artist of the Week  10. Meeting With The Mitten Podcast  11. Get Promoted
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

// Primary links — always visible on desktop (kept short so they fit)
const PRIMARY_LINKS = [
  { href: "/live", label: "Live Now", live: true },
  { href: "/review", label: "Music Review" },
  { href: "/mic", label: "Mic Drops" },
  { href: "/forum", label: "Forum" },
  { href: "/latest-news", label: "Latest News" },
  { href: "/explore", label: "Explore" },
];

// Secondary links — shown in "More" dropdown
const MORE_LINKS = [
  { href: "/wars", label: "Music Wars" },
  { href: "/leaderboard", label: "Leaderboards" },
  { href: "/artist-of-the-week", label: "Artist of the Week" },
  { href: "/podcast", label: "Meeting With The Mitten" },
  { href: "/promo", label: "Get Promoted" },
];

const ALL_MOBILE_LINKS: Array<{ href: string; label: string; live?: boolean }> = [...PRIMARY_LINKS, ...MORE_LINKS];

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close More dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bg = transparent && !scrolled
    ? "bg-transparent"
    : "bg-[#080808]/95 backdrop-blur-sm border-b border-white/10";

  const displayName = user?.artistName || user?.name || user?.email || "";
  const avatarUrl = (user as any)?.avatarUrl as string | null | undefined;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bg}`}>
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 flex-shrink-0">
          <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover" />
          <span className="font-['Anton'] text-xl tracking-wider hidden sm:block">
            MURDER MITTEN <span className="text-red-600">MEDIA</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-4 text-sm text-white/60 font-medium">
          {PRIMARY_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {link.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />}
              {link.label}
            </a>
          ))}
          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap"
            >
              More
              <svg className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {moreOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-[#111] border border-white/10 shadow-xl py-1 z-50">
                {MORE_LINKS.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/promo"
            className="hidden sm:block text-xs uppercase tracking-widest border border-red-600 text-red-500 px-4 py-2 hover:bg-red-600 hover:text-white transition-all duration-200 font-semibold"
          >
            Buy Promo
          </a>

          {user ? (
            <>
              <a
                href="/profile"
                className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest border border-white/20 text-white/60 px-3 py-2 hover:border-red-600 hover:text-red-400 transition-all duration-200"
                title="View my profile"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-red-600/50" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-[10px]">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="max-w-[80px] truncate">{displayName}</span>
              </a>

              {user?.role === "admin" && (
                <a
                  href="/admin"
                  className="hidden sm:block text-xs uppercase tracking-widest border border-white/20 text-white/40 px-3 py-2 hover:border-white hover:text-white transition-all duration-200"
                >
                  Admin
                </a>
              )}

              <button
                onClick={() => logout()}
                className="hidden sm:block text-xs uppercase tracking-widest border border-white/20 text-white/40 px-3 py-2 hover:border-red-600 hover:text-red-400 transition-all duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            <a
              href={getLoginUrl()}
              className="hidden sm:block text-xs uppercase tracking-widest border border-white/20 text-white/50 px-3 py-2 hover:border-white hover:text-white transition-all duration-200"
            >
              Login
            </a>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden text-white/60 hover:text-white p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#080808] border-t border-white/10 py-4">
          <div className="container flex flex-col gap-1">
            {user && (
              <a
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-2 py-3 text-sm text-white/70 hover:text-white border-b border-white/5 transition-colors"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-red-600/50" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>My Profile — {displayName}</span>
              </a>
            )}

            {ALL_MOBILE_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-2 py-3 text-sm text-white/60 hover:text-white border-b border-white/5 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {link.label}
              </a>
            ))}

            {user ? (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="mt-2 px-2 py-3 text-sm text-white/40 hover:text-red-400 border-b border-white/5 text-left transition-colors"
              >
                Logout
              </button>
            ) : (
              <a
                href={getLoginUrl()}
                className="mt-2 px-2 py-3 text-sm text-white/60 hover:text-white border-b border-white/5 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Login / Sign Up
              </a>
            )}

            <a
              href="/promo"
              className="mt-3 text-center bg-red-600 text-white py-3 text-xs font-semibold uppercase tracking-widest"
              onClick={() => setMenuOpen(false)}
            >
              Buy Promo
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
