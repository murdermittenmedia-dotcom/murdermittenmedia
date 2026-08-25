import { Activity, CreditCard, FileText, Music, Radio, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getAdminOverviewMetrics } from "@/lib/adminOverview";

export type AdminOverviewDestination =
  | "users"
  | "orders"
  | "analytics"
  | "paidsubmissions"
  | "live"
  | "streams";

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "red" | "green" | "blue" | "amber";
  onClick: () => void;
}) {
  const tones = {
    red: "border-red-500/25 bg-red-500/[0.06] text-red-300",
    green: "border-green-500/25 bg-green-500/[0.06] text-green-300",
    blue: "border-blue-500/25 bg-blue-500/[0.06] text-blue-300",
    amber: "border-amber-500/25 bg-amber-500/[0.06] text-amber-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${tones[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">{label}</span>
        <Icon className="h-5 w-5 opacity-80" aria-hidden="true" />
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-sm text-white/45">{detail}</div>
    </button>
  );
}

export function AdminOverview({ onNavigate }: { onNavigate: (destination: AdminOverviewDestination) => void }) {
  const { data: queue } = trpc.queue.getAll.useQuery(undefined, { refetchInterval: 10_000 });
  const { data: analytics } = trpc.admin.analytics.useQuery(undefined, { refetchInterval: 30_000 });

  const metrics = getAdminOverviewMetrics(queue, analytics);
  const current = queue?.currentPlaying;

  return (
    <section aria-labelledby="admin-overview-heading" className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">Command center</p>
          <h2 id="admin-overview-heading" className="mt-2 font-['Anton'] text-4xl uppercase tracking-wide text-white">Overview</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/45">A live snapshot of the review room, queue, members, and payment workload.</p>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-widest ${queue?.state?.isLive ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-white/10 bg-white/[0.03] text-white/45"}`}>
          <span className={`h-2 w-2 rounded-full ${queue?.state?.isLive ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
          {queue?.state?.isLive ? "Live session" : "Session offline"}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Live status" value={queue?.state?.isLive ? "LIVE" : "OFFLINE"} detail={queue?.state?.liveMessage || "Open Music Review controls"} icon={Radio} tone={queue?.state?.isLive ? "green" : "blue"} onClick={() => onNavigate("live")} />
        <SummaryCard label="Queue" value={metrics.queueCount} detail={`${metrics.pendingCount} pending submissions`} icon={Music} tone="red" onClick={() => onNavigate("paidsubmissions")} />
        <SummaryCard label="Paid workload" value={metrics.paidWorkload} detail={`${metrics.skipTotal} skip-line orders`} icon={CreditCard} tone="amber" onClick={() => onNavigate("orders")} />
        <SummaryCard label="Members" value={metrics.memberCount ?? "—"} detail={`${metrics.recentSignups} recent signups`} icon={Users} tone="blue" onClick={() => onNavigate("users")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <button type="button" onClick={() => onNavigate("live")} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-left transition hover:border-red-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Currently playing</p>
              <h3 className="mt-3 text-2xl font-black text-white">{current?.songTitle || "No track loaded"}</h3>
              <p className="mt-1 text-sm text-white/45">{current?.artistName || "The room is waiting for the next submission."}</p>
            </div>
            <Activity className="h-6 w-6 text-red-400" aria-hidden="true" />
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/45">
            <span className="rounded-full border border-white/10 px-3 py-1.5">{queue?.state?.isLive ? "Shared playback active" : "Private preview / offline"}</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5">{submissions.length} queue items</span>
          </div>
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white">Activity snapshot</h3>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <button type="button" onClick={() => onNavigate("analytics")} className="flex w-full items-center justify-between border-b border-white/10 pb-3 text-left hover:text-white">
              <span className="text-white/45">Total votes</span><strong className="text-white">{analytics?.votes?.total ?? "—"}</strong>
            </button>
            <button type="button" onClick={() => onNavigate("analytics")} className="flex w-full items-center justify-between border-b border-white/10 pb-3 text-left hover:text-white">
              <span className="text-white/45">Forum posts</span><strong className="text-white">{analytics?.forumPosts?.total ?? "—"}</strong>
            </button>
            <button type="button" onClick={() => onNavigate("orders")} className="flex w-full items-center justify-between text-left hover:text-white">
              <span className="text-white/45">Pending skip orders</span><strong className="text-amber-300">{metrics.pendingSkipOrders}</strong>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
