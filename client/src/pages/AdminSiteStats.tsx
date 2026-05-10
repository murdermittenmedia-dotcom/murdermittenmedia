/* ============================================================
   MURDER MITTEN MEDIA — Admin Live Site Stats
   Real-time page views, active sessions, top pages, charts
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Activity, Users, Eye, TrendingUp, Globe, Clock,
  ArrowLeft, RefreshCw, Wifi, WifiOff,
} from "lucide-react";

// ─── Tiny bar chart (no external lib) ────────────────────────
function MiniBarChart({
  data,
  labelKey,
  valueKey,
  color = "#D10000",
  height = 80,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
}) {
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 w-full" style={{ height }}>
      {data.map((d, i) => {
        const pct = (values[i] / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 relative group"
            style={{ height: "100%" }}
          >
            <div
              className="absolute bottom-0 w-full rounded-sm transition-all duration-300"
              style={{ height: `${Math.max(pct, 2)}%`, background: color, opacity: 0.85 }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
              {String(d[labelKey])}: {values[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "red",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color?: "red" | "green" | "blue" | "yellow" | "purple";
}) {
  const colors = {
    red: "text-red-500 bg-red-500/10",
    green: "text-green-400 bg-green-400/10",
    blue: "text-blue-400 bg-blue-400/10",
    yellow: "text-yellow-400 bg-yellow-400/10",
    purple: "text-purple-400 bg-purple-400/10",
  };
  return (
    <div className="border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-white leading-none">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-white/40 text-xs mt-0.5">{label}</div>
        {sub && <div className="text-white/30 text-[11px] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Live dot ─────────────────────────────────────────────────
function LiveDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-green-400" : "bg-white/20"}`} />
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function AdminSiteStats() {
  const { user, loading } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const utils = trpc.useUtils();
  const { data: stats, isLoading, refetch, dataUpdatedAt } = trpc.siteAnalytics.getStats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  // Track last refresh time from dataUpdatedAt
  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Manual refresh
  function handleRefresh() {
    refetch();
    setLastRefreshed(new Date());
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-white/30">Loading...</div>
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/40 mb-4">Admin access required</div>
          <a href={getLoginUrl()} className="text-red-500 hover:underline text-sm">Sign in</a>
        </div>
      </div>
    );
  }

  const activeCount = stats?.activeNow?.length ?? 0;

  // Build 24-hour chart (fill missing hours with 0)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const row = stats?.hourlyToday?.find((r) => Number(r.hour) === h);
    return { hour: `${h}:00`, views: row ? Number(row.views) : 0 };
  });

  // Build 30-day chart
  const dailyData = (() => {
    const map = new Map<string, number>();
    stats?.dailyMonth?.forEach((r) => map.set(String(r.day).slice(0, 10), Number(r.views)));
    const out: { day: string; views: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key.slice(5), views: map.get(key) ?? 0 });
    }
    return out;
  })();

  return (
    <div className="min-h-screen bg-[#080808] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
                <ArrowLeft className="w-4 h-4" />
                Admin Panel
              </button>
            </Link>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-sm uppercase tracking-widest">Live Site Stats</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border transition-all ${
                autoRefresh
                  ? "border-green-500/40 text-green-400 bg-green-500/10"
                  : "border-white/20 text-white/40"
              }`}
            >
              {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/20 text-white/60 hover:text-white transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <div className="text-white/20 text-xs hidden sm:block">
              Updated {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Active Now Banner ─────────────────────────────── */}
        <div className={`border p-4 flex items-center justify-between ${
          activeCount > 0 ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-3">
            <LiveDot active={activeCount > 0} />
            <div>
              <span className="text-2xl font-bold text-white">{activeCount}</span>
              <span className="text-white/50 text-sm ml-2">
                {activeCount === 1 ? "visitor" : "visitors"} active right now
              </span>
            </div>
          </div>
          {activeCount > 0 && (
            <div className="hidden md:flex flex-wrap gap-2 max-w-lg">
              {stats?.activeNow?.slice(0, 8).map((s) => (
                <span key={s.sessionId} className="text-xs bg-white/5 border border-white/10 px-2 py-1 text-white/50 truncate max-w-[180px]">
                  {s.path}
                </span>
              ))}
              {(stats?.activeNow?.length ?? 0) > 8 && (
                <span className="text-xs text-white/30">+{(stats?.activeNow?.length ?? 0) - 8} more</span>
              )}
            </div>
          )}
        </div>

        {/* ── Overview Stats ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Eye} label="Views Today" value={stats?.views.today ?? 0} color="red" />
          <StatCard icon={TrendingUp} label="Views This Week" value={stats?.views.week ?? 0} color="blue" />
          <StatCard icon={Globe} label="Total Page Views" value={stats?.views.total ?? 0} color="purple" />
          <StatCard
            icon={Users}
            label="Unique Sessions Today"
            value={stats?.sessions.today ?? 0}
            sub={`${stats?.sessions.total ?? 0} all-time`}
            color="green"
          />
        </div>

        {/* ── Charts Row ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly today */}
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Views by Hour — Today</div>
              <Clock className="w-4 h-4 text-white/20" />
            </div>
            {hourlyData.every((d) => d.views === 0) ? (
              <div className="text-white/20 text-sm text-center py-8">No views recorded today yet</div>
            ) : (
              <>
                <MiniBarChart data={hourlyData} labelKey="hour" valueKey="views" color="#D10000" height={100} />
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                </div>
              </>
            )}
          </div>

          {/* Daily last 30 days */}
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Daily Views — Last 30 Days</div>
              <TrendingUp className="w-4 h-4 text-white/20" />
            </div>
            {dailyData.every((d) => d.views === 0) ? (
              <div className="text-white/20 text-sm text-center py-8">No views recorded yet</div>
            ) : (
              <>
                <MiniBarChart data={dailyData} labelKey="day" valueKey="views" color="#3b82f6" height={100} />
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>30d ago</span><span>15d ago</span><span>Today</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Top Pages + Recent Activity ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top pages */}
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-4">Top Pages — Last 7 Days</div>
            {!stats?.topPages?.length ? (
              <div className="text-white/20 text-sm text-center py-8">No data yet</div>
            ) : (
              <div className="space-y-2">
                {stats.topPages.map((p, i) => {
                  const maxViews = Number(stats.topPages[0]?.views) || 1;
                  const pct = (Number(p.views) / maxViews) * 100;
                  return (
                    <div key={p.path} className="flex items-center gap-3">
                      <span className="text-white/20 text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-white/70 text-xs truncate">{p.path}</span>
                          <span className="text-white/40 text-xs ml-2 flex-shrink-0">{Number(p.views).toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-4">Recent Page Views</div>
            {!stats?.recentViews?.length ? (
              <div className="text-white/20 text-sm text-center py-8">No views recorded yet</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {stats.recentViews.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs py-1 border-b border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.userId ? "bg-blue-400" : "bg-white/20"}`} />
                    <span className="text-white/60 truncate flex-1">{v.path}</span>
                    <span className="text-white/20 flex-shrink-0">
                      {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {v.userId && (
                      <span className="text-blue-400/60 text-[10px] flex-shrink-0">user</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Active Sessions Detail ────────────────────────── */}
        {activeCount > 0 && (
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-4">
              Active Sessions ({activeCount})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {stats?.activeNow?.map((s) => (
                <div key={s.sessionId} className="flex items-center gap-2 border border-white/10 bg-white/[0.02] px-3 py-2">
                  <LiveDot active />
                  <div className="min-w-0">
                    <div className="text-white/70 text-xs truncate">{s.path}</div>
                    <div className="text-white/20 text-[10px]">
                      {s.userId ? `User #${s.userId}` : "Anonymous"} ·{" "}
                      {new Date(s.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Logged-in vs Anonymous ────────────────────────── */}
        {(stats?.views.total ?? 0) > 0 && (
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-4">Logged-in vs Anonymous</div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${((stats?.views.loggedIn ?? 0) / (stats?.views.total || 1)) * 100}%` }}
                  />
                  <div className="h-full bg-white/10 flex-1" />
                </div>
              </div>
              <div className="flex gap-4 text-xs flex-shrink-0">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  {stats?.views.loggedIn ?? 0} logged-in
                </span>
                <span className="flex items-center gap-1.5 text-white/30">
                  <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />
                  {(stats?.views.total ?? 0) - (stats?.views.loggedIn ?? 0)} anonymous
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
