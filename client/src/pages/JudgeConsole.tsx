import { Link } from "wouter";
import { Mic, Radio, ShieldCheck, Video, Volume2 } from "lucide-react";
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
  const isJudge = user?.role === "judge" || user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: existingBroadcast } = trpc.review.getMyBroadcast.useQuery(undefined, { enabled: isJudge });
  const startBroadcast = trpc.review.startBroadcast.useMutation({
    onSuccess: (result) => {
      setBroadcast({ broadcastId: result.broadcast.id, token: result.token, livekitUrl: result.livekitUrl });
      void utils.review.getActive.invalidate();
      void utils.review.getMyBroadcast.invalidate();
      toast.success("Green Room is ready. Allow your microphone and camera to join the Mitten Panel.");
    },
    onError: (error) => toast.error(error.message),
  });

  const leaveStage = () => {
    setBroadcast(null);
    void utils.review.getActive.invalidate();
    void utils.review.getMyBroadcast.invalidate();
  };

  const enterGreenRoom = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser does not support camera and microphone broadcasting.");
      return;
    }
    setRequestingMedia(true);
    try {
      const preview = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } });
      preview.getTracks().forEach((track) => track.stop());
      startBroadcast.mutate();
    } catch (error: any) {
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
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
            <p className="mt-2 max-w-2xl text-sm text-white/50">Enter the Green Room, then use your native microphone and camera to join the live Music Review panel.</p>
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
            </aside>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/[0.12] via-[#0c0c0c] to-[#080808] p-7">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/30 bg-green-500/10"><Radio className="h-6 w-6 text-green-300" /></div>
              <h2 className="font-['Anton'] text-3xl uppercase">Enter the Green Room</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">When you continue, the browser asks for camera and microphone permission. You control both controls after you connect. The stage has room for up to five live judges.</p>
              {existingBroadcast && <p className="mt-4 rounded-lg border border-yellow-400/25 bg-yellow-400/[0.06] p-3 text-xs text-yellow-100">A previous panel connection is still marked active. Continuing safely reconnects you with a fresh secure session.</p>}
              <button type="button" onClick={enterGreenRoom} disabled={requestingMedia || startBroadcast.isPending} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                <Mic className="h-4 w-4" /> {requestingMedia ? "Checking Camera & Mic…" : startBroadcast.isPending ? "Preparing Green Room…" : "Enter Green Room"}
              </button>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Before You Join</h2>
              <ol className="mt-4 space-y-3 text-xs leading-relaxed text-white/55">
                <li><span className="mr-2 text-red-300">01</span>Use Chrome, Safari, or another current browser.</li>
                <li><span className="mr-2 text-red-300">02</span>Allow camera and microphone access when asked.</li>
                <li><span className="mr-2 text-red-300">03</span>Keep the panel open while you are live.</li>
              </ol>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
