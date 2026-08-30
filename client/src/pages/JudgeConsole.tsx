import { Link } from "wouter";
import { Mic, Radio, ShieldCheck, SkipForward, Video, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { JudgeLiveBroadcast } from "@/components/JudgeLiveBroadcast";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

type BroadcastCredentials = {
  broadcastId: number;
  token: string;
  livekitUrl: string;
};

export default function JudgeConsole() {
  const { user, loading } = useAuth();
  const [broadcast, setBroadcast] = useState<BroadcastCredentials | null>(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<"ready" | "requesting" | "blocked" | "idle">("idle");
  const isJudge = user?.role === "judge" || user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: existingBroadcast } = trpc.review.getMyBroadcast.useQuery(undefined, { enabled: isJudge });
  const { data: queueData, refetch: refetchQueue } = trpc.queue.getAll.useQuery(undefined, { enabled: isJudge, refetchInterval: 5000 });
  const judgeSkipVote = trpc.review.judgeVoteToSkip.useMutation({
    onSuccess: (result) => {
      void refetchQueue();
      toast.success(result.autoAdvanced ? "Judge skip vote reached the threshold — next track loaded." : `Judge skip vote counted (${result.votes}).`);
    },
    onError: (error) => toast.error(error.message),
  });
  const startBroadcast = trpc.review.startBroadcast.useMutation({
    onSuccess: (result) => {
      setBroadcast({ broadcastId: result.broadcast.id, token: result.token, livekitUrl: result.livekitUrl });
      void utils.review.getActive.invalidate();
      void utils.review.getMyBroadcast.invalidate();
      toast.success("You are live on the Judge Panel.");
    },
    onError: (error) => toast.error(error.message),
  });

  const leaveStage = () => {
    setBroadcast(null);
    void utils.review.getActive.invalidate();
    void utils.review.getMyBroadcast.invalidate();
  };

  const joinJudgePanel = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support camera and microphone broadcasting.");
      setMediaStatus("blocked");
      return;
    }
    setRequestingMedia(true);
    setMediaStatus("requesting");
    try {
      const preview = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } });
      preview.getTracks().forEach((track) => track.stop());
      setMediaStatus("ready");
      startBroadcast.mutate();
    } catch (error: any) {
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      setMediaStatus("blocked");
      toast.error(denied ? "Camera and microphone access is required to join the Mitten Panel." : "Unable to access your camera or microphone. Please try again.");
    } finally {
      setRequestingMedia(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#080808]" />;
  if (!user) {
    window.location.href = getLoginUrl("/judge");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-28">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Authorized Judge Access
            </div>
            <h1 className="font-['Anton'] text-4xl uppercase tracking-wide sm:text-5xl">Mitten <span className="text-red-500">Panel</span></h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">Join the live Music Review panel with your native camera and microphone. Your video and voice appear alongside the review track for viewers.</p>
          </div>
          <Link href="/review" className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 transition-colors hover:border-white/30 hover:text-white">Back to Review</Link>
        </div>

        {!isJudge ? (
          <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.06] p-6">
            <h2 className="font-['Anton'] text-2xl uppercase text-yellow-200">Judge access required</h2>
            <p className="mt-2 max-w-xl text-sm text-white/60">Open the invitation link sent by the admin, sign in with the invited account, and accept it before entering the Mitten Panel.</p>
            <Link href="/review" className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500">Return to Music Review</Link>
          </section>
        ) : broadcast ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <JudgeLiveBroadcast broadcastId={broadcast.broadcastId} token={broadcast.token} livekitUrl={broadcast.livekitUrl} onStop={leaveStage} />
            <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">On Stage</h2>
              <p className="mt-2 text-xs leading-relaxed text-white/50">Your camera and voice are sent only through the Mitten Panel. Review music remains a separate synchronized player for viewers.</p>
              <div className="mt-5 space-y-3 text-xs text-white/60">
                <div className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 text-green-400" /><span>Use the mic button to mute yourself without leaving the panel.</span></div>
                <div className="flex gap-2"><Video className="mt-0.5 h-4 w-4 text-green-400" /><span>Use the camera button to hide or restore your video.</span></div>
                <div className="flex gap-2"><Volume2 className="mt-0.5 h-4 w-4 text-green-400" /><span>Viewer judge-audio controls do not alter review music playback.</span></div>
              </div>
              {queueData?.currentPlaying && <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/70">Current review</p>
                <p className="mt-1 truncate text-xs text-white/65">{queueData.currentPlaying.songTitle} · {queueData.currentPlaying.artistName}</p>
                <button type="button" onClick={() => judgeSkipVote.mutate({ submissionId: queueData.currentPlaying!.id })} disabled={judgeSkipVote.isPending} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-yellow-400/35 bg-yellow-400/[0.08] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-yellow-100 hover:bg-yellow-400/[0.16] disabled:opacity-50"><SkipForward className="h-3.5 w-3.5" /> {judgeSkipVote.isPending ? "Counting vote…" : "Judge Vote To Skip"}</button>
              </div>}
            </aside>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/[0.12] via-[#0c0c0c] to-[#080808] p-7">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/30 bg-green-500/10"><Radio className="h-6 w-6 text-green-300" /></div>
              <h2 className="font-['Anton'] text-3xl uppercase">Join Judge Panel</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">One button starts the panel: it asks for camera and microphone permission, then opens your live video and voice controls. The stage has room for up to five live judges.</p>
              {existingBroadcast && <p className="mt-4 rounded-lg border border-yellow-400/25 bg-yellow-400/[0.06] p-3 text-xs text-yellow-100">A previous panel connection is still marked active. Joining now safely replaces it with a fresh secure session.</p>}
              <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${mediaStatus === "ready" ? "border-green-400/30 bg-green-400/[0.08] text-green-100" : mediaStatus === "blocked" ? "border-red-400/30 bg-red-400/[0.08] text-red-100" : "border-white/10 bg-black/20 text-white/55"}`}>
                <span className="font-bold uppercase tracking-wider">Camera & Mic: </span>
                {mediaStatus === "requesting" ? "Browser permission request open — choose Allow." : mediaStatus === "ready" ? "Allowed — connecting you to the live panel." : mediaStatus === "blocked" ? "Blocked — allow both permissions in your browser, then try again." : "Not requested yet — Join Judge Panel will ask for both."}
              </div>
              <button type="button" onClick={joinJudgePanel} disabled={requestingMedia || startBroadcast.isPending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                <Video className="h-4 w-4" /> {requestingMedia ? "Checking Camera & Mic…" : startBroadcast.isPending ? "Connecting to Judge Panel…" : "Join Judge Panel"}
              </button>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Camera & Mic Setup</h2>
              <ol className="mt-4 space-y-3 text-xs leading-relaxed text-white/55">
                <li><span className="mr-2 text-red-300">01</span>Use Chrome, Safari, or another current browser.</li>
                <li><span className="mr-2 text-red-300">02</span>Allow camera and microphone access when asked.</li>
                <li><span className="mr-2 text-red-300">03</span>Your live camera preview appears right after joining. Keep the panel open while you are live.</li>
              </ol>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
