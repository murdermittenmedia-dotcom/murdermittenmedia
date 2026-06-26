/* ============================================================
   Shared site navigation for Murder Mitten Media
   Menu order per spec:
   My Profile · Live Now · Latest News · Artist of the Month
   Mic Drops · Meeting With The Mitten · Music Reviews
   Music Wars · Forum · Explore · Leaderboards · Get Promoted
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import LabelBadge from "@/components/LabelBadge";
import {
  User, Star, Mic2, Podcast,
  Music, Swords, MessageSquare, Search, Trophy, Tag,
  LogOut, LogIn, ChevronDown, X, Menu, Shield, Zap, Radio, Coins, Bell, Newspaper, Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

// Ordered menu items — used for both desktop and mobile
// liveKey: matches the key returned by useLiveStatus to show LIVE badge
const NAV_ITEMS = [
  { href: "/artist-of-the-week",label: "Artist of the Month",                   icon: Star                          },
  { href: "/music-wars",        label: "Music Wars",                           icon: Swords,  liveKey: "wars"     },
  { href: "/review",            label: "Live Music Reviews",                   icon: Music,   liveKey: "review"   },
  { href: "/mic",               label: "Murder Mitten Mic",                    icon: Mic2                          },
  { href: "/podcast",           label: "Meeting with the Mitten",              icon: Podcast                       },
  { href: "/news",              label: "Latest News",                          icon: Newspaper                     },
  { href: "/promo",             label: "Get Promoted",                         icon: Tag                           },
  { href: "/daily-wheel",       label: "Daily Wheel",                          icon: Zap                           },
  { href: "/cookup",            label: "Live Cook Up",                         icon: Radio                         },
  { href: "/coins",             label: "Buy Coins",                            icon: Coins                         },
  { href: "/forum",             label: "Forum",                                icon: MessageSquare                 },
  { href: "/explore",           label: "Explore",                              icon: Search                        },
  { href: "/leaderboard",       label: "Leaderboards",                         icon: Trophy                        },
  { href: "/how-it-works",      label: "XP & Tiers",                           icon: Zap                           },
];

// Desktop primary (visible without More dropdown)
const DESKTOP_PRIMARY = NAV_ITEMS.slice(0, 5);
// Desktop secondary (inside More dropdown)
const DESKTOP_MORE = NAV_ITEMS.slice(5);

export function SiteNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { reviewIsLive, warsIsLive } = useLiveStatus();

  const isLiveForKey = (key?: string) => {
    if (key === "review") return reviewIsLive;
    if (key === "wars") return warsIsLive;
    return false;
  };

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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const bg = transparent && !scrolled
    ? "bg-transparent"
    : "bg-[#080808]/95 backdrop-blur-sm border-b border-white/10";

  const displayName = user?.artistName || user?.name || user?.email || "";
  const avatarUrl = (user as any)?.avatarUrl as string | null | undefined;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bg}`}>
        <div className="container flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <a href="/" className="flex items-center gap-3 flex-shrink-0">
            <img src={LOGO} alt="Murder Mitten Media" className="w-10 h-10 rounded-full object-cover ring-1 ring-red-600/40" />
            <span className="font-['Anton'] text-xl tracking-wider hidden sm:block">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>

          {/* ── Desktop nav ── */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            {DESKTOP_PRIMARY.map(link => {
              const isLive = isLiveForKey((link as any).liveKey);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1.5 px-3 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded transition-all duration-150 whitespace-nowrap relative"
                >
                  <link.icon className="w-3.5 h-3.5 opacity-60" />
                  {link.label}
                  {isLive && (
                    <span className="ml-1 text-[9px] font-bold uppercase tracking-widest text-red-500 animate-pulse">
                      LIVE
                    </span>
                  )}
                </a>
              );
            })}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(v => !v)}
                className="flex items-center gap-1 px-3 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded transition-all duration-150 whitespace-nowrap"
              >
                More
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-[#0e0e0e] border border-white/10 shadow-2xl py-1 z-50 rounded">
                  {DESKTOP_MORE.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <link.icon className="w-4 h-4 opacity-50 flex-shrink-0" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Get Promoted CTA */}
            <a
              href="/promo"
              className="hidden sm:block text-xs uppercase tracking-widest border border-red-600 text-red-500 px-4 py-2 hover:bg-red-600 hover:text-white transition-all duration-200 font-semibold rounded-sm"
            >
              Get Promoted
            </a>

            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                {/* Profile pill */}
                <a
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 text-xs border border-white/15 text-white/70 px-3 py-2 hover:border-red-600/60 hover:text-white transition-all duration-200 rounded-sm"
                  title="My Profile"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-red-600/50" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-[10px]">
                      {initials}
                    </span>
                  )}
                  <span className="max-w-[80px] truncate font-medium">{displayName}</span>
                  {(() => { const raw = (user as { accountLabels?: string | null } | null)?.accountLabels; const lbls = raw ? (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })() : []; return lbls.length > 0 ? <LabelBadge labels={lbls} size="xs" /> : null; })()}
                </a>

                <a
                  href="/wallet"
                  className="hidden sm:flex items-center gap-1.5 text-xs border border-white/15 text-white/40 px-3 py-2 hover:border-yellow-500/60 hover:text-yellow-400 transition-all duration-200 rounded-sm"
                  title="My Wallet"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Wallet
                </a>

                {user?.role === "admin" && (
                  <a
                    href="/admin"
                    className="hidden sm:flex items-center gap-1.5 text-xs border border-white/15 text-white/40 px-3 py-2 hover:border-white/40 hover:text-white transition-all duration-200 rounded-sm"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin
                  </a>
                )}

                <button
                  onClick={() => logout()}
                  className="hidden sm:flex items-center gap-1.5 text-xs border border-white/15 text-white/40 px-3 py-2 hover:border-red-600/60 hover:text-red-400 transition-all duration-200 rounded-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
            ) : (
              <a
                href={getLoginUrl()}
                className="hidden sm:flex items-center gap-1.5 text-xs border border-white/20 text-white/50 px-3 py-2 hover:border-white hover:text-white transition-all duration-200 rounded-sm"
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
              {menuOpen
                ? <X className="w-5 h-5" />
                : <Menu className="w-5 h-5" />
              }
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer so page content is not hidden under the fixed 64px nav */}
      <div className="h-16" />

      {/* ── Mobile menu overlay ── */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Mobile menu drawer ── */}
      <div
        className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-[300px] max-w-[90vw] bg-[#0a0a0a] border-l border-white/10 flex flex-col transition-transform duration-300 ease-in-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-red-600/40" />
            <span className="font-['Anton'] text-base tracking-wider">
              MMM <span className="text-red-600">MENU</span>
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-white/40 hover:text-white p-1.5 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable links */}
        <div className="flex-1 overflow-y-auto py-2">

          {/* My Profile — top of list */}
          {user ? (
            <a
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors group border-b border-white/5"
            >
              <div className="flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-red-600/50" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-red-900/60 to-red-600/30 border border-red-600/50 flex items-center justify-center text-red-400 font-bold text-base">
                    {initials}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-0.5">My Profile</div>
                <div className="text-sm font-semibold text-white truncate">{displayName}</div>
                {(() => { const raw = (user as { accountLabels?: string | null } | null)?.accountLabels; const lbls = raw ? (() => { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } })() : []; return lbls.length > 0 ? <LabelBadge labels={lbls} size="xs" /> : null; })()}
              </div>
              <ChevronDown className="w-4 h-4 text-white/30 -rotate-90 group-hover:text-white/60 transition-colors flex-shrink-0" />
            </a>
          ) : (
            <a
              href={getLoginUrl()}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors border-b border-white/5"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white/40" />
              </div>
              <div>
                <div className="text-xs text-white/40 uppercase tracking-widest mb-0.5">Account</div>
                <div className="text-sm font-semibold text-white">Login / Sign Up</div>
              </div>
            </a>
          )}

          {/* Nav links */}
          <div className="py-2">
            {NAV_ITEMS.map((link, i) => {
              const Icon = link.icon;
              const isGetPromoted = link.href === "/promo";
              const isLiveMobile = isLiveForKey((link as any).liveKey);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors group ${
                    isGetPromoted
                      ? "text-red-500 hover:bg-red-600/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  } ${i < NAV_ITEMS.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                    isGetPromoted
                      ? "bg-red-600/20 border border-red-600/30"
                      : isLiveMobile
                      ? "bg-red-600/20 border border-red-600/40"
                      : "bg-white/5 border border-white/10 group-hover:border-white/20"
                  }`}>
                    <Icon className={`w-4 h-4 ${isGetPromoted ? "text-red-500" : isLiveMobile ? "text-red-400" : "text-white/50 group-hover:text-white/80"}`} />
                  </div>
                  <span className={`text-sm font-medium ${isGetPromoted ? "font-semibold" : ""}`}>
                    {link.label}
                  </span>
                  {isLiveMobile && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-sm animate-pulse">
                      LIVE
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>

        {/* Drawer footer */}
        <div className="border-t border-white/10 px-5 py-4 flex flex-col gap-2">
          <a
            href="/wallet"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-yellow-400 transition-colors py-1"
          >
            <Wallet className="w-3.5 h-3.5" />
            My Wallet
          </a>
          {user?.role === "admin" && (
            <a
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors py-1"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Panel
            </a>
          )}
          {user ? (
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-red-400 transition-colors py-1 text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          ) : null}
          <div className="text-[10px] text-white/20 mt-1">© 2024 Murder Mitten Media</div>
        </div>
      </div>
    </>
  );
}

// ─── Notification Bell ────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, refetch } = trpc.notifications.getMyNotifications.useQuery(undefined, {
    refetchInterval: 15000, // poll every 15s
  });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAll = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

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
        className="relative flex items-center justify-center w-8 h-8 border border-white/15 text-white/50 hover:border-red-600/60 hover:text-white transition-all duration-200 rounded-sm"
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111] border border-white/10 rounded-lg shadow-2xl z-[200] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-red-400 hover:text-red-300"
              >
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
                className={`px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                  !n.isRead ? "bg-red-600/5 border-l-2 border-l-red-600" : ""
                }`}
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
            <Link href="/notifications" className="text-xs text-red-400 hover:text-red-300">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
