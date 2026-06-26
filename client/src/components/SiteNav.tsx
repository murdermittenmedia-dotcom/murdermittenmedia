/* ============================================================
   SiteNav — Premium Redesign
   Desktop: Logo | [LIVE▾] [SHOWS▾] [COMMUNITY▾] [REWARDS▾] | Actions
   Mobile:  Logo + Hamburger → Categorized full-screen drawer
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

const NAV_GROUPS = [
  {
    label: "LIVE",
    accent: true,
    items: [
      { href: "/review",      label: "Music Reviews",        desc: "Live track reviews on stream",      icon: Music,          liveKey: "review" },
      { href: "/music-wars",  label: "Music Wars",           desc: "Head-to-head bracket battles",      icon: Swords,         liveKey: "wars"   },
      { href: "/cookup",      label: "GO LIVE",              desc: "Stream your studio session",        icon: Radio                             },
    ],
  },
  {
    label: "SHOWS",
    items: [
      { href: "/artist-of-the-week", label: "Artist of the Month",      desc: "Michigan's featured artist",        icon: Star    },
      { href: "/mic",                label: "Murder Mitten Mic",         desc: "Raw one-mic performances",          icon: Mic2    },
      { href: "/podcast",            label: "Meeting with the Mitten",   desc: "In-depth artist interviews",        icon: Podcast },
      { href: "/news",               label: "Latest News",               desc: "Michigan rap updates",              icon: Newspaper },
    ],
  },
  {
    label: "COMMUNITY",
    items: [
      { href: "/forum",        label: "Forum",           desc: "Talk rap, culture & more",      icon: MessageSquare },
      { href: "/leaderboard",  label: "Leaderboard",     desc: "Top fans & contributors",        icon: Trophy        },
      { href: "/explore",      label: "Explore",         desc: "Discover artists & content",     icon: Search        },
      { href: "/fire-or-trash",label: "Fire or Trash",   desc: "Rate music submissions",         icon: Flame         },
    ],
  },
  {
    label: "REWARDS",
    items: [
      { href: "/daily-wheel",  label: "Daily Wheel",     desc: "Spin for free promo daily",     icon: Zap    },
      { href: "/promo",        label: "Get Promoted",    desc: "Put your music on blast",        icon: Tag    },
      { href: "/coins",        label: "Buy Coins",       desc: "Support artists & unlock perks", icon: Coins  },
      { href: "/how-it-works", label: "XP & Tiers",      desc: "Level up your account",          icon: Shield },
    ],
  },
] as const;

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [openGroup, setOpenGroup]   = useState<string | null>(null);
  const [openMobile, setOpenMobile] = useState<string | null>(null);
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
        setOpenGroup(null);
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

          {/* ── DESKTOP GROUPED NAV ── */}
          <div className="hidden md:flex items-center">
            {NAV_GROUPS.map((group) => {
              const groupLive = group.items.some(i => isLive((i as any).liveKey));
              const isOpen = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    onMouseEnter={() => setOpenGroup(group.label)}
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    className={`flex items-center gap-1.5 px-4 py-5 text-xs font-bold uppercase tracking-widest transition-colors ${
                      (group as any).accent
                        ? groupLive
                          ? "text-red-400"
                          : "text-white/70 hover:text-red-400"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {(group as any).accent && groupLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                    {group.label}
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown panel */}
                  {isOpen && (
                    <div
                      onMouseLeave={() => setOpenGroup(null)}
                      className={`absolute top-full left-1/2 -translate-x-1/2 mt-0 w-64 bg-[#0c0c0c] border shadow-2xl z-50 ${
                        (group as any).accent ? "border-red-600/30" : "border-white/10"
                      }`}
                    >
                      {/* Category header */}
                      <div className={`px-4 py-2 border-b text-[9px] font-black uppercase tracking-[0.3em] ${
                        (group as any).accent
                          ? "border-red-600/20 text-red-500 bg-red-950/20"
                          : "border-white/8 text-white/30"
                      }`}>
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const live = isLive((item as any).liveKey);
                        const Icon = item.icon;
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors group border-b border-white/[0.04] last:border-0"
                          >
                            <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              live ? "bg-red-600/20 border border-red-600/40"
                                   : "bg-white/5 border border-white/10 group-hover:border-white/20"
                            }`}>
                              <Icon className={`w-3.5 h-3.5 ${live ? "text-red-400" : "text-white/50 group-hover:text-white/80"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors leading-tight">
                                  {item.label}
                                </span>
                                {live && (
                                  <span className="text-[8px] font-black uppercase tracking-widest text-red-500 animate-pulse">LIVE</span>
                                )}
                              </div>
                              <p className="text-[11px] text-white/30 mt-0.5 leading-tight">{item.desc}</p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── RIGHT ACTIONS ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
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

                <a
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 text-[10px] border border-white/15 text-white/70 px-3 py-2 hover:border-red-600/60 hover:text-white transition-all"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-red-600/50" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-[10px]">
                      {initials}
                    </span>
                  )}
                  <span className="max-w-[80px] truncate font-semibold uppercase tracking-widest">{displayName}</span>
                  {(() => {
                    const raw = (user as any)?.accountLabels;
                    const lbls = raw ? (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                    return lbls.length > 0 ? <LabelBadge labels={lbls} size="xs" /> : null;
                  })()}
                </a>

                {user?.role === "admin" && (
                  <a href="/admin" className="hidden sm:flex items-center gap-1.5 text-[10px] border border-white/15 text-white/40 px-3 py-2 hover:border-white/40 hover:text-white transition-all uppercase tracking-widest font-semibold">
                    <Shield className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={() => logout()}
                  className="hidden sm:flex items-center gap-1.5 text-[10px] border border-white/15 text-white/30 px-3 py-2 hover:border-red-600/50 hover:text-red-400 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <a
                href={getLoginUrl()}
                className="hidden sm:flex items-center gap-1.5 text-[10px] border border-white/20 text-white/60 px-4 py-2 hover:border-red-600 hover:text-white hover:bg-red-600/10 transition-all uppercase tracking-widest font-bold"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </a>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-white/70 hover:text-white p-2 rounded transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className={`${anyLive ? "h-[calc(64px+36px)]" : "h-16"}`} />

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── MOBILE DRAWER ── */}
      <div className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-[320px] max-w-[92vw] bg-[#090909] border-l border-white/10 flex flex-col transition-transform duration-300 ease-in-out ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-red-600/40" />
            <span className="font-['Anton'] text-base tracking-wider">
              MMM <span className="text-red-600">MENU</span>
            </span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-white/40 hover:text-white p-1.5 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Profile row */}
          {user ? (
            <a href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors border-b border-white/8">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-red-600/50 flex-shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-red-900/60 to-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-base flex-shrink-0">
                  {initials}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">My Profile</div>
                <div className="text-sm font-bold text-white truncate">{displayName}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-white/20 -rotate-90 flex-shrink-0" />
            </a>
          ) : (
            <a href={getLoginUrl()} onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors border-b border-white/8">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white/40" />
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Account</div>
                <div className="text-sm font-bold text-white">Login / Sign Up</div>
              </div>
            </a>
          )}

          {/* Categorized nav groups */}
          {NAV_GROUPS.map((group) => {
            const groupLive = group.items.some(i => isLive((i as any).liveKey));
            const isOpen = openMobile === group.label;
            return (
              <div key={group.label} className="border-b border-white/8">
                <button
                  onClick={() => setOpenMobile(isOpen ? null : group.label)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {(group as any).accent && groupLive && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${
                      (group as any).accent ? "text-red-500" : "text-white/50"
                    }`}>
                      {group.label}
                    </span>
                    {(group as any).accent && groupLive && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 animate-pulse">LIVE</span>
                    )}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="bg-black/20">
                    {group.items.map((item) => {
                      const live = isLive((item as any).liveKey);
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors border-t border-white/5 group"
                        >
                          <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                            live ? "bg-red-600/20 border border-red-600/40" : "bg-white/5 border border-white/10"
                          }`}>
                            <Icon className={`w-4 h-4 ${live ? "text-red-400" : "text-white/50"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white/80">{item.label}</span>
                              {live && <span className="text-[8px] font-black text-red-500 animate-pulse uppercase tracking-widest">LIVE</span>}
                            </div>
                            <p className="text-[11px] text-white/30 leading-tight mt-0.5">{item.desc}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer footer */}
        <div className="border-t border-white/10 px-5 py-4 flex flex-col gap-2.5">
          <a href="/wallet" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-xs text-white/40 hover:text-yellow-400 transition-colors py-1 uppercase tracking-widest font-semibold">
            <Wallet className="w-3.5 h-3.5" />
            My Wallet
          </a>
          {user?.role === "admin" && (
            <a href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors py-1 uppercase tracking-widest font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Admin Panel
            </a>
          )}
          {user && (
            <button onClick={() => { logout(); setMenuOpen(false); }} className="flex items-center gap-2 text-xs text-white/30 hover:text-red-400 transition-colors py-1 text-left uppercase tracking-widest font-semibold">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          )}
          <div className="text-[10px] text-white/15 mt-1 uppercase tracking-widest">© 2024 Murder Mitten Media</div>
        </div>
      </div>
    </>
  );
}

/* ── Notification Bell (unchanged) ─────────────────────────── */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, refetch } = trpc.notifications.getMyNotifications.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAll  = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

  const unread = data?.unreadCount ?? 0;
  const notifs = data?.notifications ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 border border-white/15 text-white/50 hover:border-red-600/60 hover:text-white transition-all duration-200"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111] border border-white/10 shadow-2xl z-[200] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markAll.mutate()} className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/30 text-sm">No notifications yet</div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!n.isRead ? "bg-red-600/5 border-l-2 border-l-red-600" : ""}`}
                onClick={() => {
                  if (!n.isRead) markRead.mutate({ id: n.id });
                  if (n.link) window.location.href = n.link;
                  setOpen(false);
                }}
              >
                <p className={`text-sm font-medium ${!n.isRead ? "text-white" : "text-white/60"}`}>{n.title}</p>
                <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-white/20 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-white/10">
            <Link href="/notifications" className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest">
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
