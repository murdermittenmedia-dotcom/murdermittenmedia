import { useEffect, useRef } from "react";
import { Activity, Eye, ExternalLink, Flame, Radio, SkipForward, ThumbsDown, Upload, Youtube } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { useFakeLiveChat } from "@/hooks/useFakeLiveChat";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { SyncedYouTubePlayer, type SyncedYouTubePlayerHandle } from "@/components/SyncedYouTubePlayer";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

type BroadcastSubmission = {
  id: number;
  artistName: string;
  songTitle: string;
  status: string;
  submissionType: "youtube" | "file";
  youtubeUrl: string | null;
  fileUrl: string | null;
  fireCount: number;
  trashCount: number;
  position: number;
  userId?: number | null;
  skippedLine?: boolean;
};

function getYouTubeId(url: string | null) {
  if (!url) return null;
  return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
}

export default function BroadcastReview() {
  const { reviewIsLive } = useLiveStatus();
  const { data, isLoading } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchOnWindowFocus: false,
  });
  const { viewerCount } = useFakeLiveChat({ isReviewLive: data?.state?.isLive ?? reviewIsLive });
  const syncedPlayerRef = useRef<SyncedYouTubePlayerHandle>(null);

  useEffect(() => {
    document.title = "Live Music Review | Murder Mitten Media";
    return () => { document.title = "Murder Mitten Media"; };
  }, []);

  const isOnAir = data?.state?.isLive ?? reviewIsLive;
  const current = (isOnAir ? data?.currentPlaying : null) as BroadcastSubmission | null | undefined;
  const queue = ((data?.submissions ?? []) as BroadcastSubmission[])
    .filter((submission) => (submission.status === "pending" || submission.status === "playing") && submission.id !== current?.id)
    .sort((a, b) => (a.skippedLine === b.skippedLine ? a.position - b.position : a.skippedLine ? -1 : 1))
    .slice(0, 5);
  const youtubeId = current?.submissionType === "youtube" ? getYouTubeId(current.youtubeUrl) : null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] text-white selection:bg-red-600/40">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1920px] flex-col px-4 py-4 sm:px-7 sm:py-6 lg:px-10 lg:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(209,0,0,0.18),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(110,0,0,0.12),transparent_34%),linear-gradient(135deg,#070707,#100607_56%,#080808)]" />
        <div className="pointer-events-none absolute inset-3 border border-white/[0.07] sm:inset-6 lg:inset-8" />

        <header className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4 sm:pb-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img src={LOGO} alt="Murder Mitten Media" className="h-10 w-10 rounded-full border border-red-600/60 object-cover shadow-[0_0_24px_rgba(209,0,0,0.25)] sm:h-12 sm:w-12" />
            <div className="min-w-0"><p className="truncate font-['Anton'] text-xl uppercase leading-none sm:text-3xl">Murder Mitten <span className="text-red-600">Media</span></p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/40 sm:text-[10px]">Live Music Review · Broadcast Feed</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3"><div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] sm:px-4 sm:text-xs ${isOnAir ? "border-red-500/45 bg-red-500/10 text-red-200" : "border-white/15 bg-white/[0.04] text-white/40"}`}><span className={`h-2 w-2 rounded-full ${isOnAir ? "animate-pulse bg-red-500" : "bg-white/25"}`} />{isOnAir ? "On air" : "Offline"}</div>{isOnAir && <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 sm:px-4 sm:text-xs"><Eye className="h-3.5 w-3.5 text-red-400" /><span className="font-['Anton'] text-lg leading-none text-white sm:text-xl">{viewerCount.toLocaleString()}</span><span className="hidden text-white/45 sm:inline">Watching</span></div>}</div>
        </header>

        <div className="relative z-10 grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(350px,0.75fr)] lg:gap-7 lg:py-7">
          <section className="flex min-w-0 flex-col rounded-2xl border border-red-500/25 bg-black/25 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-red-300"><Radio className="h-4 w-4" /> Now playing</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/30">Live synchronized player</p></div>{current && <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/45"><span className="flex items-center gap-1.5"><Flame className="h-4 w-4 text-red-500" />{current.fireCount}</span><span className="flex items-center gap-1.5"><ThumbsDown className="h-4 w-4 text-white/45" />{current.trashCount}</span></div>}</div>
            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#030303] shadow-[0_0_50px_rgba(209,0,0,0.12)]">
              {isLoading ? <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-[0.25em] text-white/30">Loading broadcast…</div> : current ? <>{youtubeId ? <SyncedYouTubePlayer ref={syncedPlayerRef} videoId={youtubeId} submissionId={current.id} isAdmin={false} className="h-full w-full" /> : current.fileUrl ? <div className="flex h-full flex-col items-center justify-center gap-5 bg-[radial-gradient(circle,rgba(209,0,0,0.16),transparent_58%)]"><div className="flex h-20 w-20 items-center justify-center rounded-full border border-red-500/40 bg-red-600/15"><Radio className="h-9 w-9 text-red-400" /></div><AudioPlayButton url={current.fileUrl} title={current.songTitle} artist={current.artistName} sourcePage="Broadcast Review" submissionId={current.id} artistUserId={current.userId ?? undefined} size="lg" /><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Tap play to monitor audio</p></div> : <div className="flex h-full items-center justify-center text-sm text-white/40">Waiting for the audio source…</div>}</> : <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><Radio className="h-10 w-10 text-red-500/60" /><p className="font-['Anton'] text-3xl uppercase sm:text-5xl">Next review<br /><span className="text-red-600">loading</span></p><p className="text-xs uppercase tracking-[0.2em] text-white/35">{isOnAir ? "Preparing the next submission" : "The review is currently offline"}</p></div>}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-end justify-between gap-4"><div className="min-w-0"><p className="truncate font-['Anton'] text-3xl uppercase leading-none sm:text-5xl">{current?.songTitle ?? "Waiting for the next track"}</p><p className="mt-2 truncate text-base font-semibold text-white/55 sm:text-xl">{current?.artistName ?? "Murder Mitten Media"}</p></div>{current && <span className="hidden rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-200 sm:inline">On the mic</span>}</div></div>
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-white/12 bg-[#0b0b0b]/90 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-5">
            <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/50"><Activity className="h-4 w-4 text-red-500" /> Queue</p><h2 className="mt-1 font-['Anton'] text-3xl uppercase tracking-wide">Next 5 songs</h2></div><span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-200">{queue.length} waiting</span></div>
            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {queue.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-white/15 p-6 text-center"><SkipForward className="mb-3 h-7 w-7 text-white/20" /><p className="text-sm text-white/40">Queue is clear.</p><p className="mt-1 text-[10px] uppercase tracking-widest text-white/25">Waiting for new submissions</p></div> : queue.map((submission, index) => <div key={submission.id} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition-colors hover:border-red-500/30 hover:bg-red-500/[0.06]"><span className="w-7 text-center font-['Anton'] text-2xl text-red-600/75">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold uppercase text-white sm:text-base">{submission.songTitle}</p><p className="truncate text-xs text-white/40">{submission.artistName}</p></div><div className="flex shrink-0 flex-col items-end gap-1">{submission.skippedLine && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">Priority</span>}<span className="text-[9px] uppercase tracking-wider text-white/25">{submission.submissionType === "youtube" ? "YT" : "MP3"}</span></div></div>)}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-300"><Upload className="h-3.5 w-3.5" /> Submit a track</p><p className="mt-2 text-xs leading-relaxed text-white/45">Upload an MP3 or paste a YouTube link. Add your title, submit, and watch your position move in the queue.</p><a href="/review" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-500">Open submission form <ExternalLink className="h-3.5 w-3.5" /></a></div>
          </aside>
        </div>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30 sm:pt-5 sm:text-[10px]"><span>Detroit · Michigan</span><span className="hidden sm:inline">Where the Industry Watches the Trenches</span><span className="flex items-center gap-2"><Youtube className="h-3.5 w-3.5" /> Music Review Broadcast</span></footer>
      </div>
    </main>
  );
}
