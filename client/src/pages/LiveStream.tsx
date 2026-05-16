/* ============================================================
   MURDER MITTEN MEDIA -- Live Stream Page
   Smart redirect: if Music Wars or Music Review is live,
   show a prominent banner + redirect button to that page.
   Otherwise show the offline state with YouTube channel link.
   ============================================================ */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
const YT_CHANNEL_URL = "https://www.youtube.com/@MurderMittenMedia";

export default function LiveStream() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, navigate] = useLocation();

  // Music Review live status
  const { data: queueData, refetch: refetchQueue } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 15000,
  });

  // Music Wars live status
  const { data: eventData, refetch: refetchEvent } = trpc.events.getNext.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const setLiveMutation = trpc.queue.setLive.useMutation({
    onSuccess: () => { toast.success("Live status updated!"); refetchQueue(); },
    onError: (err) => toast.error("Error: " + err.message),
  });

  const setWarLiveMutation = trpc.events.setLive.useMutation({
    onSuccess: () => { toast.success("Music Wars live status updated!"); refetchEvent(); },
    onError: (err) => toast.error("Error: " + err.message),
  });

  const reviewIsLive = queueData?.state?.isLive ?? false;
  const warsIsLive = eventData?.isLive ?? false;
  const anyLive = reviewIsLive || warsIsLive;

  // Auto-redirect if exactly one event is live
  useEffect(() => {
    if (reviewIsLive && !warsIsLive) {
      const t = setTimeout(() => navigate("/review"), 3000);
      return () => clearTimeout(t);
    }
    if (warsIsLive && !reviewIsLive) {
      const t = setTimeout(() => navigate("/music-wars"), 3000);
      return () => clearTimeout(t);
    }
  }, [reviewIsLive, warsIsLive, navigate]);

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav transparent />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="pt-32 pb-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          {/* Live badge */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {anyLive ? (
              <>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                <span className="text-sm text-red-400 uppercase tracking-[0.3em] font-bold">🔴 Live Now</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <span className="text-xs text-white/30 uppercase tracking-[0.3em] font-semibold">Currently Offline</span>
              </>
            )}
          </div>

          <h1 className="font-['Anton'] text-5xl md:text-7xl uppercase mb-4 leading-tight">
            {anyLive
              ? <><span className="text-red-600">LIVE</span> NOW</>
              : <>LIVE <span className="text-red-600">STREAM</span></>
            }
          </h1>

          {!anyLive && (
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              We're not live right now. Subscribe below to get notified when we go live.
            </p>
          )}
        </div>
      </section>

      <div className="container pb-20 max-w-4xl mx-auto px-4">

        {/* ── ADMIN CONTROLS ─────────────────────────────── */}
        {isAdmin && (
          <div className="mb-8 border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-4">
            <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold">Admin — Live Controls</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Music Review live toggle */}
              <div className="border border-white/10 bg-white/[0.02] p-4">
                <div className="text-white/60 text-xs uppercase tracking-widest mb-3">Music Review</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLiveMutation.mutate({ isLive: true, message: "Music Review is live!" })}
                    disabled={setLiveMutation.isPending || reviewIsLive}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    🔴 Go Live
                  </button>
                  <button
                    onClick={() => setLiveMutation.mutate({ isLive: false })}
                    disabled={setLiveMutation.isPending || !reviewIsLive}
                    className="flex-1 border border-white/20 hover:border-white text-white/60 hover:text-white disabled:opacity-40 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    End
                  </button>
                </div>
                <div className={`mt-2 text-xs ${reviewIsLive ? "text-red-400" : "text-white/30"}`}>
                  {reviewIsLive ? "● Live now → /review" : "○ Offline"}
                </div>
              </div>
              {/* Music Wars live toggle */}
              <div className="border border-white/10 bg-white/[0.02] p-4">
                <div className="text-white/60 text-xs uppercase tracking-widest mb-3">Music Wars</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWarLiveMutation.mutate({ isLive: true })}
                    disabled={setWarLiveMutation.isPending || warsIsLive}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    🔴 Go Live
                  </button>
                  <button
                    onClick={() => setWarLiveMutation.mutate({ isLive: false })}
                    disabled={setWarLiveMutation.isPending || !warsIsLive}
                    className="flex-1 border border-white/20 hover:border-white text-white/60 hover:text-white disabled:opacity-40 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    End
                  </button>
                </div>
                <div className={`mt-2 text-xs ${warsIsLive ? "text-red-400" : "text-white/30"}`}>
                  {warsIsLive ? "● Live now → /music-wars" : "○ Offline"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE EVENT CARDS ────────────────────────────── */}
        {anyLive ? (
          <div className="space-y-4 mb-10">
            {reviewIsLive && (
              <div className="border border-red-600/50 bg-red-600/10 p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Live Now</span>
                  </div>
                  <h2 className="font-['Anton'] text-3xl uppercase mb-1">Music <span className="text-red-600">Review</span></h2>
                  <p className="text-white/50 text-sm">Live track reviews are happening right now. Submit your music and get reviewed live.</p>
                  {!warsIsLive && (
                    <p className="text-white/30 text-xs mt-2">Redirecting you in 3 seconds…</p>
                  )}
                </div>
                <a
                  href="/review"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)] whitespace-nowrap"
                >
                  Join Now →
                </a>
              </div>
            )}

            {warsIsLive && (
              <div className="border border-red-600/50 bg-red-600/10 p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 text-xs uppercase tracking-widest font-bold">Live Now</span>
                  </div>
                  <h2 className="font-['Anton'] text-3xl uppercase mb-1">Music <span className="text-red-600">Wars</span></h2>
                  <p className="text-white/50 text-sm">
                    {eventData?.title ? `"${eventData.title}" is live.` : "Music Wars battles are happening right now. Watch, vote, and compete."}
                  </p>
                  {!reviewIsLive && (
                    <p className="text-white/30 text-xs mt-2">Redirecting you in 3 seconds…</p>
                  )}
                </div>
                <a
                  href="/music-wars"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)] whitespace-nowrap"
                >
                  Join Now →
                </a>
              </div>
            )}
          </div>
        ) : (
          /* ── OFFLINE STATE ──────────────────────────────── */
          <div className="mb-10">
            <div className="aspect-video w-full bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center gap-6 mb-8">
              <div className="text-center">
                <img src={LOGO} alt="Murder Mitten Media" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 opacity-60" />
                <div className="font-['Anton'] text-2xl uppercase text-white/40 mb-2">Stream is Offline</div>
                <p className="text-white/25 text-sm max-w-sm">
                  We stream live on YouTube. Subscribe and turn on notifications to never miss a session.
                </p>
              </div>
              <a
                href={`${YT_CHANNEL_URL}/live`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
              >
                Open YouTube Channel →
              </a>
            </div>

            {/* Info cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: "🎙", title: "Music Reviews", desc: "Live track reviews from Michigan artists. Submit yours at /review", href: "/review" },
                { icon: "⚔️", title: "Music Wars", desc: "Live artist battles — spin the wheel, vote, and compete", href: "/music-wars" },
                { icon: "🎤", title: "One Mics", desc: "Raw uncut freestyles and artist showcases", href: "/mic" },
              ].map(card => (
                <a key={card.title} href={card.href} className="border border-white/10 bg-white/[0.02] p-5 text-center hover:border-red-600/40 transition-colors group">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="font-['Anton'] text-lg uppercase mb-1 group-hover:text-red-400 transition-colors">{card.title}</div>
                  <div className="text-white/40 text-xs leading-relaxed">{card.desc}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBSCRIBE CTA ───────────────────────────────── */}
        <div className="border border-red-600/30 bg-red-600/5 p-8 text-center">
          <div className="font-['Anton'] text-3xl uppercase mb-2">
            Never Miss a <span className="text-red-600">Live</span>
          </div>
          <p className="text-white/50 text-sm mb-6">
            Subscribe and turn on notifications to get alerted every time we go live on YouTube.
          </p>
          <a
            href={`${YT_CHANNEL_URL}?sub_confirmation=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-red-600 hover:bg-red-700 text-white px-10 py-3 text-sm font-semibold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(209,0,0,0.4)]"
          >
            Subscribe on YouTube →
          </a>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs">© 2022-{new Date().getFullYear()} Murder Mitten Media ™ · The Mitten</div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href={YT_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
