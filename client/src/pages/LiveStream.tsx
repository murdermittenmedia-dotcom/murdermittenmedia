/* ============================================================
   MURDER MITTEN MEDIA — Live Stream Page
   Streams via Streamlabs → YouTube
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { SiteNav } from "@/components/SiteNav";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";
// YouTube channel ID for Murder Mitten Media — used for the live embed
const YT_CHANNEL_ID = "UCMurderMittenMedia";
const YT_CHANNEL_URL = "https://www.youtube.com/@MurderMittenMedia";

export default function LiveStream() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: queueData, refetch } = trpc.queue.getAll.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const setLiveMutation = trpc.queue.setLive.useMutation({
    onSuccess: () => { toast.success("Live status updated!"); refetch(); },
    onError: (err) => toast.error("Error: " + err.message),
  });

  const isLive = queueData?.state?.isLive ?? false;
  const liveMessage = queueData?.state?.liveMessage ?? "";

  const [adminMsg, setAdminMsg] = useState("");

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav transparent />

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="pt-32 pb-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          {/* Live badge */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {isLive ? (
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
            {isLive ? <><span className="text-red-600">LIVE</span> STREAM</> : <>LIVE <span className="text-red-600">STREAM</span></>}
          </h1>

          {isLive && liveMessage && (
            <div className="inline-block border border-red-600/40 bg-red-600/10 text-red-300 text-sm px-6 py-2 mb-4">
              {liveMessage}
            </div>
          )}

          {!isLive && (
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              We're not live right now. Subscribe below to get notified when we go live on YouTube via Streamlabs.
            </p>
          )}
        </div>
      </section>

      <div className="container pb-20 max-w-5xl mx-auto">

        {/* ── ADMIN LIVE TOGGLE ───────────────────────────────── */}
        {isAdmin && (
          <div className="mb-6 border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold mb-3">Admin — Live Controls</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={adminMsg}
                onChange={e => setAdminMsg(e.target.value)}
                placeholder="Optional message (e.g. 'Music Review Session')"
                className="flex-1 bg-white/[0.05] border border-white/15 text-white placeholder-white/25 px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/60"
              />
              <button
                onClick={() => setLiveMutation.mutate({ isLive: true, message: adminMsg || undefined })}
                disabled={setLiveMutation.isPending || isLive}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all"
              >
                🔴 Go Live
              </button>
              <button
                onClick={() => setLiveMutation.mutate({ isLive: false })}
                disabled={setLiveMutation.isPending || !isLive}
                className="border border-white/20 hover:border-white text-white/60 hover:text-white disabled:opacity-40 px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all"
              >
                End Stream
              </button>
            </div>
            <p className="text-white/30 text-xs mt-2">
              Toggle this when you start/end your Streamlabs stream on YouTube. The site will show the live banner automatically.
            </p>
          </div>
        )}

        {/* ── YOUTUBE EMBED ───────────────────────────────────── */}
        <div className="mb-8 relative border border-white/10">
          {isLive ? (
            // When live: embed the YouTube live stream directly
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/live_stream?channel=UCMurderMittenMedia&autoplay=1`}
                title="Murder Mitten Media Live Stream"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (
            // When offline: show the channel page embed (latest content)
            <div className="aspect-video w-full bg-white/[0.03] flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <img src={LOGO} alt="Murder Mitten Media" className="w-20 h-20 rounded-full object-cover mx-auto mb-4 opacity-60" />
                <div className="font-['Anton'] text-2xl uppercase text-white/40 mb-2">Stream is Offline</div>
                <p className="text-white/25 text-sm max-w-sm">
                  We stream live on YouTube via Streamlabs. Subscribe and turn on notifications to never miss a session.
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
          )}
        </div>

        {/* ── INFO CARDS ──────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: "🎙", title: "Music Reviews", desc: "Live track reviews from Michigan artists. Submit yours at /review" },
            { icon: "🎤", title: "Artist Interviews", desc: "Real conversations with real artists — no scripts, no filters" },
            { icon: "🔴", title: "Powered by Streamlabs", desc: "We stream live to YouTube using Streamlabs. Subscribe to get notified" },
          ].map(card => (
            <div key={card.title} className="border border-white/10 bg-white/[0.02] p-5 text-center">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="font-['Anton'] text-lg uppercase mb-1">{card.title}</div>
              <div className="text-white/40 text-xs leading-relaxed">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* ── SUBSCRIBE CTA ───────────────────────────────────── */}
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

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs">© 2022–{new Date().getFullYear()} Murder Mitten Media ™ · Detroit, MI</div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href={YT_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">YouTube</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
