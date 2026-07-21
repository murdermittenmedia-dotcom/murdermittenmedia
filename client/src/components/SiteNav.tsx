/* ============================================================
   SiteNav — Simplified Single Dropdown Menu
   Desktop: Logo | [ALL PAGES▾] | Actions
   Mobile:  Logo + Hamburger → Full-screen drawer
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import LabelBadge from "@/components/LabelBadge";
import {
  User, Star, Mic2, Podcast, Music, Swords, MessageSquare,
  Search, Trophy, Tag, LogOut, LogIn, ChevronDown, X, Menu,
  Shield, Zap, Radio, Coins, Bell, Newspaper, Wallet, Flame,
  ShoppingBag, MapPin,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const ALL_PAGES = [
  {
    category: "LIVE",
    accent: true,
    items: [
      { href: "/review",      label: "Music Reviews",        icon: Music,          liveKey: "review" },
      { href: "/music-wars",  label: "Music Wars",           icon: Swords,         liveKey: "wars"   },
      { href: "/cookup",      label: "GO LIVE",              icon: Radio                             },
    ],
  },
  {
    category: "CONTENT",
    items: [
      { href: "/artist-of-the-week", label: "Artist of the Month",      icon: Star    },
      { href: "/mic",                label: "Murder Mitten Mic",         icon: Mic2    },
      { href: "/podcast",            label: "Meeting with the Mitten",   icon: Podcast },
      { href: "/news",               label: "Latest News",               icon: Newspaper },
    ],
  },
  {
    category: "COMMUNITY",
    items: [
      { href: "/forum",        label: "Forum",           icon: MessageSquare },
      { href: "/leaderboard",  label: "Leaderboard",     icon: Trophy        },
      { href: "/explore",      label: "Explore",         icon: Search        },
      { href: "/fire-or-trash",label: "Fire or Trash",   icon: Flame         },
    ],
  },
  {
    category: "EARN & WIN",
    items: [
      { href: "/daily-wheel",  label: "Daily Wheel",     icon: Zap    },
      { href: "/coins",        label: "Buy Coins",       icon: Coins  },
      { href: "/how-it-works", label: "XP & Tiers",      icon: Shield },
      { href: "/promo",        label: "Buy Promo",       icon: Flame  },
      { href: "/merch",        label: "Merch Shop",      icon: ShoppingBag },
    ],
  },
  {
    category: "STUDIO",
    items: [
      { href: "/find-studio",  label: "Find A Studio",   icon: MapPin },
    ],
  },
] as const;

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { user, logout } = useAuth();
  const { reviewIsLive, warsIsLive } = useLiveStatus();
  const anyLive = reviewIsLive || warsIsLive;

  const isLive = (key?: string) =>
    key === "review" ? reviewIsLive : key === "wars" ? warsIsLive : false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const bg = transparent && !scrolled
    ? "bg-transparent"
    : "bg-[#080808]/97 backdrop-blur-md border-b border-white/8";

  const displayName = user?.artistName || user?.name || user?.email || "";
  const avatarUrl   = (user as any)?.avatarUrl as string | null | undefined;
  const initials    = displayName.charAt(0).toUpperCase();

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bg}`}
      >
        {/* ── LIVE NOW TICKER ── */}
        {anyLive && (
          <div className="bg-red-600 py-1.5">
            <div className="container flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-[10px] font-black uppercase tracking-[0.3em]">LIVE NOW</span>
              </div>
              {reviewIsLive && (
                <a href="/review" className="text-white/90 hover:text-white text-[10px] font-semibold uppercase tracking-widest transition-colors">
                  🎙 Music Review → Tune In
                </a>
              )}
              {warsIsLive && (
                <a href="/music-wars" className="text-white/90 hover:text-white text-[10px] font-semibold uppercase tracking-widest transition-colors">
                  ⚔️ Music Wars → Tune In
                </a>
              )}
            </div>
          </div>
        )}

        <div className="container flex items-center justify-between h-16">

          {/* ── LOGO ── */}
          <a href="/" className="flex items-center gap-3 flex-shrink-0">
            <img src={LOGO} alt="Murder Mitten Media" className="w-9 h-9 rounded-full object-cover ring-1 ring-red-600/50" />
            <span className="font-['Anton'] text-lg tracking-wider hidden lg:block">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>

          {/* ── DESKTOP SINGLE DROPDOWN ── */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <button
                onMouseEnter={() => setDropdownOpen(true)}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 px-4 py-5 text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors"
              >
                MENU
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div
                  onMouseLeave={() => setDropdownOpen(false)}
                  className="absolute top-full left-0 mt-1 w-80 bg-[#0c0c0c] border border-white/10 shadow-2xl z-50 rounded-lg overflow-hidden"
                >
                  <div className="space-y-0">
                    {ALL_PAGES.map((section) => (
                      <div key={section.category} className={`border-b border-white/5 last:border-0 ${
                        section.accent ? "bg-red-950/10" : ""
                      }`}>
                        {/* Category header */}
                        <div className={`px-4 py-2 text-[9px] font-black uppercase tracking-[0.3em] ${
                          section.accent
                            ? "text-red-500 bg-red-950/20"
                            : "text-white/30 bg-white/[0.02]"
                        }`}>
                          {section.category}
                        </div>

                        {/* Items */}
                        {section.items.map((item) => {
                          const live = isLive((item as any).liveKey);
                          const Icon = item.icon;
                          return (
                            <a
                              key={item.href}
                              href={item.href}
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/8 transition-colors group border-b border-white/[0.04] last:border-0"
                            >
                              <Icon className={`w-4 h-4 flex-shrink-0 ${live ? "text-red-400" : "text-white/50 group-hover:text-white/80"}`} />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                                  {item.label}
                                </span>
                                {live && (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-red-500 animate-pulse ml-auto">LIVE</span>
                                )}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT ACTIONS ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* MERCH — prominent badge button */}
            <a
              href="/merch"
              className="hidden md:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border border-white/20 text-white/70 hover:border-white hover:text-white px-3 py-2 transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Merch</span>
            </a>
            <a
              href="/promo"
              className="hidden lg:block text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white px-4 py-2 transition-all"
            >
              Get Promoted
            </a>

            {user ? (
              <>
                <NotificationBell />

                <a
                  href="/wallet"
                  className="hidden sm:flex items-center gap-1.5 text-[10px] border border-white/15 text-white/40 px-3 py-2 hover:border-yellow-500/60 hover:text-yellow-400 transition-all uppercase tracking-widest font-semibold"
                  title="Wallet"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Wallet</span>
                </a>

                <div className="hidden sm:flex items-center gap-2">
                  <a
                    href="/account"
                    className="flex items-center gap-1.5 text-[10px] border border-white/15 text-white/40 px-3 py-2 hover:border-white/40 hover:text-white transition-all uppercase tracking-widest font-semibold"
                    title="Account"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Account</span>
                  </a>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 text-[10px] border border-white/15 text-white/40 px-3 py-2 hover:border-white/40 hover:text-white transition-all uppercase tracking-widest font-semibold"
                    title="Logout"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Logout</span>
                  </button>
                </div>

                {/* MOBILE PROFILE MENU */}
                <div className="sm:hidden flex items-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-xs font-bold">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <a
                  href={getLoginUrl()}
                  className="hidden sm:flex items-center gap-1.5 text-[10px] border border-white/15 text-white/40 px-3 py-2 hover:border-white/40 hover:text-white transition-all uppercase tracking-widest font-semibold"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Login</span>
                </a>
              </>
            )}

            {/* MOBILE HAMBURGER */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex items-center justify-center w-8 h-8 text-white/60 hover:text-white transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE FULL-SCREEN MENU ── */}
      {menuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-[#080808] md:hidden overflow-y-auto">
          <div className="p-4 space-y-2">
            {ALL_PAGES.map((section) => (
              <div key={section.category} className="space-y-1">
                <div className={`px-3 py-2 text-[9px] font-black uppercase tracking-[0.3em] ${
                  section.accent ? "text-red-500" : "text-white/30"
                }`}>
                  {section.category}
                </div>
                {section.items.map((item) => {
                  const live = isLive((item as any).liveKey);
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors"
                    >
                      <Icon className={`w-4 h-4 ${live ? "text-red-400" : "text-white/50"}`} />
                      <span className="text-sm text-white/80">
                        {item.label}
                        {live && <span className="ml-2 text-[8px] text-red-500 animate-pulse">LIVE</span>}
                      </span>
                    </a>
                  );
                })}
              </div>
            ))}

            {/* Mobile Auth */}
            <div className="border-t border-white/10 pt-4 mt-4 space-y-2">
              {user ? (
                <>
                  <a
                    href="/account"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white"
                  >
                    <User className="w-4 h-4" />
                    Account
                  </a>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <a
                  href={getLoginUrl()}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationBell() {
  const { data: unreadCount } = trpc.system.getUnreadNotifications.useQuery();
  return (
    <a
      href="/notifications"
      className="relative flex items-center justify-center w-8 h-8 text-white/40 hover:text-white transition-colors"
      title="Notifications"
    >
      <Bell className="w-4 h-4" />
      {unreadCount && unreadCount > 0 && (
        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </a>
  );
}
