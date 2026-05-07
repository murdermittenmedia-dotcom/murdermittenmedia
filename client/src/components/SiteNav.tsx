/* ============================================================
   Shared site navigation for Murder Mitten Media
   ============================================================ */

import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArtistStatModal } from "@/components/ArtistStatModal";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const NAV_LINKS = [
  { href: "/live", label: "Live Stream", live: true },
  { href: "/artist-of-the-week", label: "Artist of the Week" },
  { href: "/music-wars", label: "Music Wars" },
  { href: "/review", label: "Live Music Reviews" },
  { href: "/mic", label: "Murder Mitten Mic Performances" },
  { href: "/podcast", label: "Meeting with the Mitten Podcast" },
  { href: "/promo", label: "Get Promoted" },
];

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!transparent) return;
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, [transparent]);

  const bg = transparent && !scrolled
    ? "bg-transparent"
    : "bg-[#080808]/95 backdrop-blur-sm border-b border-white/10";

  const displayName = user?.artistName || user?.name || user?.email || "";

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bg}`}>
        <div className="container flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 flex-shrink-0">
            <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-['Anton'] text-xl tracking-wider hidden sm:block">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>

          {/* Desktop nav — scrollable on medium screens */}
          <div className="hidden lg:flex items-center gap-5 text-sm text-white/60 font-medium overflow-x-auto">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap ${link.live ? "hover:text-red-400" : ""}`}
              >
                {link.live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />}
                {link.label}
              </a>
            ))}
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
                {/* My Profile button */}
                <button
                  onClick={() => setProfileOpen(true)}
                  className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest border border-white/20 text-white/60 px-3 py-2 hover:border-red-600 hover:text-red-400 transition-all duration-200"
                  title="View my profile"
                >
                  <span className="w-5 h-5 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-[10px]">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[80px] truncate">{displayName}</span>
                </button>

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
              {/* My Profile in mobile menu */}
              {user && (
                <button
                  onClick={() => { setProfileOpen(true); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-2 py-3 text-sm text-white/70 hover:text-white border-b border-white/5 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span>My Profile — {displayName}</span>
                </button>
              )}

              {NAV_LINKS.map(link => (
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

              {/* Login / Logout */}
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

      {/* My Profile Modal — rendered as a hidden trigger that auto-opens */}
      {user && (
        <ArtistStatModal
          userId={user.id}
          artistName={user.artistName || user.name || user.email || "My Profile"}
        >
          {/* Hidden trigger — we control open state via the button in the nav */}
          <span id="nav-profile-trigger" style={{ display: "none" }} />
        </ArtistStatModal>
      )}
    </>
  );
}
