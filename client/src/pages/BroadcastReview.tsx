import { useEffect } from "react";
import { Activity, Flame, Radio, SkipForward, ThumbsDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLiveStatus } from "@/hooks/useLiveStatus";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

type BroadcastSubmission = {
  id: number;
  artistName: string;
  songTitle: string;
  status: string;
  fireCount: number;
  trashCount: number;
  position: number;
};

export default function BroadcastReview() {
  const { reviewIsLive } = useLiveStatus();
  const { data, isLoading } = trpc.queue.getAll.useQuery(undefined, {
    enabled: reviewIsLive,
    refetchInterval: reviewIsLive ? 5_000 : false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    document.title = "Live Music Review | Murder Mitten Media";
    return () => {
      document.title = "Murder Mitten Media";
    };
  }, []);

  const current = data?.currentPlaying as BroadcastSubmission | null | undefined;
  const queue = ((data?.submissions ?? []) as BroadcastSubmission[])
    .filter((submission) => submission.status === "pending" && submission.id !== current?.id)
    .sort((a, b) => a.position - b.position)
    .slice(0, 4);

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-16 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(209,0,0,0.16),transparent_34%),linear-gradient(135deg,#080808_0%,#100708_52%,#080808_100%)]" />
        <div className="pointer-events-none absolute inset-6 border border-white/[0.07] sm:inset-10 lg:inset-14" />
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4 sm:pb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src={LOGO} alt="Murder Mitten Media" className="h-10 w-10 rounded-full border border-red-600/60 object-cover sm:h-14 sm:w-14" />
            <div>
              <p className="font-['Anton'] text-xl uppercase leading-none sm:text-3xl">Murder Mitten <span className="text-red-600">Media</span></p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">Music Review Broadcast</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 sm:px-4 sm:py-2 sm:text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live Review
          </div>
        </div>

        <div className="relative z-10 grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:gap-16 lg:py-16">
          <section className="safe-zone flex min-h-[45vh] flex-col justify-center border-l-4 border-red-600 pl-6 sm:pl-10">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.38em] text-red-400 sm:text-sm"><Radio className="h-4 w-4" /> On the Mitten Panel</p>
            {isLoading ? <div className="space-y-4"><div className="h-16 w-4/5 animate-pulse bg-white/10" /><div className="h-8 w-2/5 animate-pulse bg-white/10" /></div> : current ? <>
              <h1 className="max-w-5xl font-['Anton'] text-[clamp(3.5rem,10vw,9.5rem)] uppercase leading-[0.86] tracking-tight">{current.songTitle}</h1>
              <p className="mt-6 text-2xl font-semibold text-white/65 sm:text-4xl">{current.artistName}</p>
              <div className="mt-10 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45 sm:gap-5 sm:text-sm">
                <span className="flex items-center gap-2"><Flame className="h-5 w-5 text-red-500" /> {current.fireCount} fire</span>
                <span className="flex items-center gap-2"><ThumbsDown className="h-5 w-5 text-white/60" /> {current.trashCount} trash</span>
              </div>
            </> : <div><h1 className="font-['Anton'] text-6xl uppercase leading-none sm:text-8xl">Next track<br /><span className="text-red-600">loading</span></h1><p className="mt-5 text-white/50">The Mitten Panel is preparing the next review.</p></div>}
          </section>

          <aside className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-white/60"><Activity className="h-4 w-4 text-red-500" /> Queue</div><span className="text-[10px] uppercase tracking-widest text-white/30">Next up</span></div>
            {queue.length === 0 ? <div className="border border-dashed border-white/15 p-6 text-sm text-white/35">Queue is clear. Stay tuned for the next submission.</div> : queue.map((submission, index) => <div key={submission.id} className="flex items-center gap-4 border border-white/10 bg-white/[0.035] p-4 sm:p-5"><span className="font-['Anton'] text-3xl text-red-600/70">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><p className="truncate font-['Anton'] text-xl uppercase sm:text-2xl">{submission.songTitle}</p><p className="truncate text-sm text-white/45">{submission.artistName}</p></div><SkipForward className="ml-auto h-4 w-4 shrink-0 text-white/25" /></div>)}
          </aside>
        </div>

        <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-[9px] font-bold uppercase tracking-[0.24em] text-white/30 sm:pt-6 sm:text-[11px]"><span>Detroit · Michigan</span><span className="hidden sm:inline">Where the Industry Watches the Trenches</span><span>Live broadcast view</span></footer>
      </div>
    </main>
  );
}
