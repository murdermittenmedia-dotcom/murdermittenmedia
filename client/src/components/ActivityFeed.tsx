import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { io } from "socket.io-client";
import { trpc } from "@/lib/trpc";

type ActivityEvent = {
  id: string;
  kind: "review" | "battle" | "community";
  title: string;
  detail: string;
  href: string;
  createdAt: string | Date;
};

export function ActivityFeed() {
  const { data: initialEvents = [], isLoading } = trpc.activity.getRecent.useQuery({ limit: 12 }, { refetchInterval: 30_000, refetchOnWindowFocus: false });
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const socket = io({ path: "/api/socket.io", transports: ["websocket", "polling"] });
    const handleNewEvent = (event: { id: number; type: string; message: string; metadata: string | null; createdAt: string | Date }) => {
      const next: ActivityEvent = {
        id: `event-${event.id}`,
        kind: event.type === "battle" ? "battle" : event.type === "community" ? "community" : "review",
        title: event.message,
        detail: event.metadata ?? "Latest activity from Murder Mitten Media",
        href: event.type === "battle" ? "/music-wars" : event.type === "community" ? "/forum" : "/review",
        createdAt: event.createdAt,
      };
      setLiveEvents((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 12));
    };
    socket.on("activity:new_event", handleNewEvent);
    return () => {
      socket.off("activity:new_event", handleNewEvent);
      socket.disconnect();
    };
  }, []);

  const events = useMemo(() => {
    const merged = [...liveEvents, ...(initialEvents as ActivityEvent[])];
    return merged.filter((event, index, list) => list.findIndex((item) => item.id === event.id) === index).slice(0, 12);
  }, [initialEvents, liveEvents]);

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse border border-white/10 bg-white/[0.03]" />)}</div>;
  }

  if (events.length === 0) {
    return <div className="border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-white/40">New platform activity will appear here as the community moves.</div>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#080808] to-transparent" aria-hidden="true" />
      <div className="flex snap-x gap-4 overflow-x-auto pb-3 pr-2 [scrollbar-color:#7f1d1d_transparent]">
        {events.map((event) => (
          <Link key={event.id} href={event.href} className="group flex min-h-36 w-[min(82vw,280px)] shrink-0 snap-start flex-col border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-red-600/50 hover:bg-red-950/10 md:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]">
            <div className="mb-5 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">
              <span>{event.kind === "review" ? "Music Review" : event.kind === "battle" ? "Music Wars" : "Community"}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-white/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            <h3 className="line-clamp-2 font-['Anton'] text-xl uppercase leading-tight text-white transition-colors group-hover:text-red-400">{event.title}</h3>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/40">{event.detail}</p>
            <time className="mt-auto pt-4 text-[10px] uppercase tracking-widest text-white/25">{new Date(event.createdAt).toLocaleDateString()}</time>
          </Link>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-[10px] uppercase tracking-[0.2em] text-white/25"><Activity className="h-3 w-3" aria-hidden="true" /> Swipe to explore</div>
    </div>
  );
}
