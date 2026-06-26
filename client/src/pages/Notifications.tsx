/* ============================================================
   MURDER MITTEN MEDIA — Notifications Inbox
   Permanent notification history — never auto-deleted
   Search, filter by type, read/unread, action links
   ============================================================ */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Bell, BellOff, CheckCheck, ExternalLink, Search,
  Coins, DollarSign, Flame, Gift, Radio, TrendingUp,
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
} from "lucide-react";

// ── Type icon + color map ─────────────────────────────────────
const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  live_rewards_earned:   { emoji: "💰", color: "text-green-400",  label: "Live Rewards" },
  coin_balance_change:   { emoji: "🪙", color: "text-yellow-400", label: "Coins" },
  fire_vote_change:      { emoji: "🔥", color: "text-orange-400", label: "Fire Votes" },
  gift_sent:             { emoji: "🎁", color: "text-pink-400",   label: "Gift Sent" },
  gift_received:         { emoji: "🎁", color: "text-purple-400", label: "Gift Received" },
  cashout_requested:     { emoji: "💸", color: "text-blue-400",   label: "Cashout" },
  cashout_approved:      { emoji: "✅", color: "text-green-400",  label: "Cashout" },
  cashout_rejected:      { emoji: "❌", color: "text-red-400",    label: "Cashout" },
  suspicious_activity:   { emoji: "⚠️", color: "text-red-500",   label: "Security" },
  stream_summary_ready:  { emoji: "📊", color: "text-blue-400",   label: "Stream" },
  someone_live:          { emoji: "📡", color: "text-red-500",    label: "Live" },
  top_gifter_milestone:  { emoji: "🏆", color: "text-yellow-400", label: "Milestone" },
  balance_update:        { emoji: "🪙", color: "text-yellow-400", label: "Balance" },
  coin_purchase:         { emoji: "🛒", color: "text-yellow-400", label: "Purchase" },
  coin_approved:         { emoji: "✅", color: "text-green-400",  label: "Coins" },
  coin_rejected:         { emoji: "❌", color: "text-red-400",    label: "Coins" },
  cashout_resolved:      { emoji: "💸", color: "text-green-400",  label: "Cashout" },
  live_stream:           { emoji: "📡", color: "text-red-500",    label: "Live" },
  cookup:                { emoji: "🎤", color: "text-red-400",    label: "Cook Up" },
  music_wars:            { emoji: "⚔️", color: "text-orange-400", label: "Music Wars" },
  review:                { emoji: "🎵", color: "text-white/60",   label: "Review" },
  admin_message:         { emoji: "📢", color: "text-white/60",   label: "Admin" },
  system:                { emoji: "🔔", color: "text-white/40",   label: "System" },
};

function getTypeMeta(type: string | null) {
  return TYPE_META[type ?? "system"] ?? { emoji: "🔔", color: "text-white/40", label: type ?? "System" };
}

function timeAgo(ts: Date | string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const FILTER_OPTIONS = [
  { value: "all",      label: "All" },
  { value: "unread",   label: "Unread" },
  { value: "coins",    label: "Coins" },
  { value: "gifts",    label: "Gifts" },
  { value: "cashout",  label: "Cashout" },
  { value: "stream",   label: "Stream" },
  { value: "live",     label: "Live" },
  { value: "security", label: "Security" },
];

const FILTER_TYPE_MAP: Record<string, string[]> = {
  coins:    ["coin_balance_change", "coin_purchase", "balance_update", "coin_approved", "coin_rejected"],
  gifts:    ["gift_sent", "gift_received", "top_gifter_milestone", "live_rewards_earned"],
  cashout:  ["cashout_requested", "cashout_approved", "cashout_rejected", "cashout_resolved"],
  stream:   ["stream_summary_ready"],
  live:     ["someone_live", "live_stream", "cookup"],
  security: ["suspicious_activity"],
};

export default function Notifications() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const { data, isLoading, refetch } = trpc.notifications.getMyNotifications.useQuery(
    { limit: 200 },
    { enabled: !!user, refetchInterval: 30_000 }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  const allNotifs = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const displayed = useMemo(() => {
    let list = [...allNotifs];

    if (filter === "unread") {
      list = list.filter(n => !n.isRead);
    } else if (FILTER_TYPE_MAP[filter]) {
      list = list.filter(n => FILTER_TYPE_MAP[filter].includes(n.type ?? ""));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.title ?? "").toLowerCase().includes(q) ||
        (n.body ?? "").toLowerCase().includes(q)
      );
    }

    return list.slice(0, limit);
  }, [allNotifs, filter, search, limit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Bell className="w-12 h-12 text-white/20" />
          <p className="text-white/50">Sign in to view your notifications</p>
          <a
            href={getLoginUrl()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 text-sm font-semibold uppercase tracking-widest transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <div className="container max-w-2xl py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-['Anton'] text-3xl uppercase">Notifications</h1>
            <p className="text-white/30 text-xs mt-1 uppercase tracking-widest">
              Permanent history — never auto-deleted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="text-white/30 hover:text-white transition-colors p-1.5"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="border-white/20 text-white/60 hover:text-white flex items-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:border-red-600/50 focus:outline-none rounded-md"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-sm transition-all ${
                filter === opt.value
                  ? "bg-red-600 text-white"
                  : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              }`}
            >
              {opt.label}
              {opt.value === "unread" && unreadCount > 0 && (
                <span className="ml-1 text-red-300">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <BellOff className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/30 text-sm">
              {search
                ? "No notifications match your search."
                : filter !== "all"
                ? "No notifications in this category."
                : "No notifications yet."}
            </p>
            <p className="text-white/20 text-xs mt-1">
              All notifications are permanently saved.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(notif => {
              const meta = getTypeMeta(notif.type);
              return (
                <div
                  key={notif.id}
                  className={`border rounded-lg p-4 transition-all ${
                    notif.isRead
                      ? "border-white/10 bg-white/[0.02] hover:bg-white/5"
                      : "border-red-600/30 bg-red-600/5 hover:bg-red-600/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 flex-shrink-0">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${notif.isRead ? "text-white/70" : "text-white"}`}>
                              {notif.title}
                            </p>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-white/5 ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          {notif.body && (
                            <p className="text-white/50 text-sm mt-0.5 leading-relaxed">{notif.body}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-white/25 text-xs whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
                          {!notif.isRead && (
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {notif.link && (
                          <Link
                            href={notif.link}
                            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        {!notif.isRead && (
                          <button
                            onClick={() => markReadMutation.mutate({ id: notif.id })}
                            disabled={markReadMutation.isPending}
                            className="text-white/30 hover:text-white/60 text-xs transition-colors"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {allNotifs.length > limit && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit(l => l + 50)}
                  className="border-white/20 text-white/50 hover:text-white"
                >
                  Load more notifications
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-white/15 text-xs text-center mt-10">
          Notifications are permanently saved and never auto-deleted.
        </p>
      </div>
    </div>
  );
}
