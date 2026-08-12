import { useMemo, useState } from "react";
import { Activity, ArrowLeft, BarChart3, ExternalLink, Eye, Loader2, MousePointerClick, Smartphone, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatCard({ icon: Icon, label, value, detail, accent }: { icon: typeof Eye; label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ color: accent, backgroundColor: `${accent}22` }}><Icon className="h-5 w-5" /></div>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Live</span>
      </div>
      <p className="mt-5 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-white/55">{label}</p>
      <p className="mt-2 text-xs text-white/35">{detail}</p>
    </div>
  );
}

export default function LinkAnalytics() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [days, setDays] = useState(30);
  const [selectedPageId, setSelectedPageId] = useState<number | undefined>();
  const adminPages = trpc.linkPages.adminPages.useQuery(undefined, { enabled: Boolean(isAdmin) });
  const activePageId = isAdmin ? (selectedPageId ?? adminPages.data?.[0]?.id) : undefined;
  const analyticsInput = useMemo(() => activePageId ? { pageId: activePageId, days } : { days }, [activePageId, days]);
  const analytics = trpc.linkPages.analytics.useQuery(analyticsInput, {
    enabled: Boolean(user) && (!isAdmin || Boolean(activePageId)),
    refetchInterval: 10_000,
  });

  if (authLoading || analytics.isLoading) return <div className="min-h-screen bg-[#080808] text-white grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>;
  if (!user) return <div className="min-h-screen bg-[#080808] text-white grid place-items-center p-6"><div className="text-center"><h1 className="font-['Anton'] text-4xl uppercase">Sign in to view analytics</h1><p className="mt-3 text-white/50">Only a page owner or administrator can access these insights.</p><Link href="/" className="mt-6 inline-flex border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-widest">Back home</Link></div></div>;
  if (analytics.error) return <div className="min-h-screen bg-[#080808] text-white grid place-items-center p-6"><div className="max-w-md text-center"><h1 className="font-['Anton'] text-4xl uppercase">Analytics unavailable</h1><p className="mt-3 text-white/50">{analytics.error.message}</p><Link href="/create-a-link" className="mt-6 inline-flex border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-widest">Back to Create A Link</Link></div></div>;

  const data = analytics.data;
  const stats = data?.analytics?.summary;
  const daily = data?.analytics?.daily ?? [];
  const topLinks = data?.analytics?.topLinks ?? [];
  const referrers = data?.analytics?.referrers ?? [];
  const devices = data?.analytics?.devices ?? [];
  const maxViews = Math.max(...daily.map((row) => row.views), 1);
  const maxClicks = Math.max(...topLinks.map((row) => row.clicks), 1);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href={isAdmin ? "/admin" : "/create-a-link"} className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/45 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Back</Link>
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-red-600/15 text-red-500"><BarChart3 className="h-6 w-6" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-500">Creator intelligence</p><h1 className="font-['Anton'] text-4xl uppercase tracking-wide sm:text-5xl">Link Analytics</h1></div></div>
            <p className="mt-3 max-w-2xl text-sm text-white/50">Live views, audience signals, and link performance for {data?.page?.displayName || data?.page?.slug || "your page"}. Refreshes every 10 seconds.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isAdmin && <select value={activePageId ?? ""} onChange={(event) => setSelectedPageId(event.target.value ? Number(event.target.value) : undefined)} className="h-10 min-w-56 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white outline-none"><option value="" className="bg-[#111]">Select creator page</option>{adminPages.data?.map((page) => <option key={page.id} value={page.id} className="bg-[#111]">{page.displayName || page.slug} {page.isPublished ? "" : "(draft)"}</option>)}</select>}
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white outline-none"><option value={7} className="bg-[#111]">Last 7 days</option><option value={30} className="bg-[#111]">Last 30 days</option><option value={90} className="bg-[#111]">Last 90 days</option></select>
          </div>
        </header>

        {!data?.analytics ? <div className="py-20 text-center text-white/45">No analytics data yet. Share your published link page to start collecting insights.</div> : <>
          <section className="grid gap-4 py-7 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Live viewers" value={formatNumber(stats?.liveViewers ?? 0)} detail="Active in the last 90 seconds" accent="#ff3030" />
            <StatCard icon={Eye} label="Page views" value={formatNumber(stats?.views ?? 0)} detail={`${formatNumber(stats?.uniqueVisitors ?? 0)} unique visitors`} accent="#f59e0b" />
            <StatCard icon={MousePointerClick} label="Link clicks" value={formatNumber(stats?.clicks ?? 0)} detail={`${stats?.clickThroughRate ?? 0}% click-through rate`} accent="#22c55e" />
            <StatCard icon={Activity} label="Tracking status" value="ON" detail="Privacy-conscious event tracking" accent="#38bdf8" />
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Performance</p><h2 className="mt-1 text-xl font-black">Views and clicks</h2></div><Activity className="h-5 w-5 text-white/30" /></div>
              <div className="mt-6 space-y-3">{daily.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No activity in this period yet.</p> : daily.map((row) => <div key={row.date} className="grid grid-cols-[76px_1fr_56px] items-center gap-3 text-xs"><span className="text-white/45">{row.date.slice(5)}</span><div className="h-8 overflow-hidden rounded-lg bg-white/5"><div className="flex h-full items-center rounded-lg bg-gradient-to-r from-red-600/80 to-red-400/40 px-2 text-[10px] font-bold" style={{ width: `${Math.max((row.views / maxViews) * 100, row.views ? 8 : 0)}%` }}>{row.views ? `${row.views} views` : ""}</div></div><span className="text-right text-white/45">{row.clicks} clicks</span></div>)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl sm:p-6"><div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-cyan-300" /><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Audience</p><h2 className="mt-1 text-xl font-black">Devices</h2></div></div><div className="mt-6 space-y-4">{devices.length === 0 ? <p className="text-sm text-white/40">No device data yet.</p> : devices.map((device) => <div key={device.deviceType} className="flex items-center justify-between gap-3"><span className="text-sm capitalize text-white/70">{device.deviceType}</span><span className="text-sm font-black">{formatNumber(device.visits)}</span></div>)}</div></div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400">Conversion</p><h2 className="mt-1 text-xl font-black">Top links</h2></div><MousePointerClick className="h-5 w-5 text-green-400" /></div><div className="mt-5 space-y-4">{topLinks.length === 0 ? <p className="text-sm text-white/40">No link clicks yet.</p> : topLinks.map((link) => <div key={link.itemId ?? link.title}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="truncate text-white/75">{link.title}</span><span className="shrink-0 font-black">{formatNumber(link.clicks)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-green-400" style={{ width: `${Math.max((link.clicks / maxClicks) * 100, 8)}%` }} /></div></div>)}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Acquisition</p><h2 className="mt-1 text-xl font-black">Referrers</h2></div><ExternalLink className="h-5 w-5 text-amber-300" /></div><div className="mt-5 space-y-3">{referrers.length === 0 ? <p className="text-sm text-white/40">No referrer data yet.</p> : referrers.map((referrer) => <div key={referrer.referrerHost} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 text-sm last:border-0"><span className="truncate text-white/70">{referrer.referrerHost}</span><span className="shrink-0 font-black">{formatNumber(referrer.visits)}</span></div>)}</div></div>
          </section>
        </>}
      </div>
    </main>
  );
}
