/* ============================================================
   MURDER MITTEN MEDIA — Notifications Page
   ============================================================ */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Bell, BellOff, CheckCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

const TYPE_ICON: Record<string, string> = {
  live_stream: "📡",
  cookup: "🎤",
  coin_approved: "🪙",
  coin_rejected: "❌",
  cashout_resolved: "💸",
  music_wars: "⚔️",
  review: "🎵",
  system: "📢",
  default: "🔔",
};

export default function Notifications() {
  const { user, loading } = useAuth();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, refetch } = trpc.notifications.getMyNotifications.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { refetch(); toast.success("All notifications marked as read"); },
  });

  const allNotifs = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const displayed = filter === "unread" ? allNotifs.filter(n => !n.isRead) : allNotifs;

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
          <a href={getLoginUrl()} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 text-sm font-semibold uppercase tracking-widest transition-colors">
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
            {unreadCount > 0 && (
              <p className="text-white/40 text-sm mt-1">{unreadCount} unread</p>
            )}
          </div>
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

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "unread"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                filter === f ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"
              }`}
            >
              {f === "all" ? `All (${allNotifs.length})` : `Unread (${unreadCount})`}
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
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(notif => {
              const icon = TYPE_ICON[notif.type] ?? TYPE_ICON.default;
              return (
                <div
                  key={notif.id}
                  className={`border rounded-lg p-4 transition-all ${
                    notif.isRead
                      ? "border-white/10 bg-white/[0.02]"
                      : "border-red-600/30 bg-red-600/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm ${notif.isRead ? "text-white/70" : "text-white"}`}>
                          {notif.title}
                        </p>
                        <span className="text-white/30 text-xs flex-shrink-0">{timeAgo(notif.createdAt)}</span>
                      </div>
                      <p className="text-white/50 text-sm mt-0.5 leading-relaxed">{notif.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {notif.link && (
                          <Link href={notif.link} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                        {!notif.isRead && (
                          <button
                            onClick={() => markReadMutation.mutate({ id: notif.id })}
                            className="text-white/30 hover:text-white/60 text-xs transition-colors"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
