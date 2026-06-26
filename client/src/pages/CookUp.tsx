/* ============================================================
   MURDER MITTEN MEDIA — Live Cook Up
   Browse page: thumbnail grid of all active live streams
   ============================================================ */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Radio, Plus, Users, Coins } from "lucide-react";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export default function LiveCookUp() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showGoLive, setShowGoLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: streams, refetch } = trpc.live.list.useQuery(undefined, { refetchInterval: 10000 });
  const { data: myStream } = trpc.live.getMyStream.useQuery(undefined, { enabled: isAuthenticated });
  const { data: coinBalance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.live.create.useMutation({
    onSuccess: (data) => {
      toast.success("You're live! Setting up your stream...");
      navigate(`/cookup/${data.streamId}`);
    },
    onError: (err) => {
      toast.error("Failed to start stream: " + err.message);
      setCreating(false);
    },
  });

  const handleGoLive = () => {
    if (!streamTitle.trim()) { toast.error("Enter a stream title"); return; }
    setCreating(true);
    createMutation.mutate({ title: streamTitle.trim() });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-white/10 bg-[#0f0f0f]">
        <div className="container py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="font-['Anton'] text-2xl tracking-wider">LIVE COOK UP</h1>
              <p className="text-white/40 text-xs uppercase tracking-widest">Studio Sessions · Producer Sets · Live Rap</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold">{coinBalance?.balance ?? 0}</span>
                <span className="text-white/40">coins</span>
                <Link href="/coins" className="ml-2 text-xs text-red-400 hover:text-red-300 underline">Buy</Link>
              </div>
            )}
            {isAuthenticated ? (
              myStream ? (
                <Button
                  onClick={() => navigate(`/cookup/${myStream.id}`)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <Radio className="w-4 h-4 mr-2 animate-pulse" />
                  Back to My Stream
                </Button>
              ) : (
                <Button
                  onClick={() => setShowGoLive(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Go Live
                </Button>
              )
            ) : (
              <a href={getLoginUrl("/live")}>
                <Button className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                  Sign In to Go Live
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Go Live Modal */}
      {showGoLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="font-['Anton'] text-xl mb-1">START YOUR STREAM</h2>
            <p className="text-white/40 text-sm mb-4">Give your session a name. You can stream from your browser camera or use OBS/Streamlabs with the RTMP key provided.</p>
            <Input
              placeholder="e.g. Late Night Beat Session, Freestyle Friday..."
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGoLive()}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30 mb-4"
              maxLength={100}
            />
            <div className="flex gap-3">
              <Button
                onClick={handleGoLive}
                disabled={creating || !streamTitle.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {creating ? "Starting..." : "🔴 Go Live"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGoLive(false)}
                className="border-white/20 text-white/60 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Streams grid */}
      <div className="container py-8">
        {!streams || streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-white/40 text-lg font-semibold mb-2">No Live Streams Right Now</h2>
            <p className="text-white/20 text-sm max-w-sm">
              Be the first to go live! Start a studio session, producer set, or freestyle and let the community tune in.
            </p>
            {isAuthenticated && (
              <Button
                onClick={() => setShowGoLive(true)}
                className="mt-6 bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start a Stream
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-white/30 text-sm mb-6 uppercase tracking-widest">
              {streams.length} stream{streams.length !== 1 ? "s" : ""} live now
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StreamCard({ stream }: { stream: any }) {
  const displayName = stream.streamer?.artistName || stream.streamer?.name || "Unknown Artist";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Link href={`/cookup/${stream.id}`}>
      <div className="group cursor-pointer border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-white/[0.06] transition-all duration-200 rounded-lg overflow-hidden">
        {/* Thumbnail area */}
        <div className="relative aspect-video bg-[#111] flex items-center justify-center">
          {stream.thumbnailUrl ? (
            <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center text-lg font-bold text-red-400">
                {initials}
              </div>
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
          )}
          {/* LIVE badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
          {/* Viewer count */}
          {stream.viewerCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white/70 text-xs px-2 py-0.5 rounded-sm">
              <Users className="w-3 h-3" />
              {stream.viewerCount}
            </div>
          )}
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-white font-semibold text-sm truncate group-hover:text-red-400 transition-colors">{stream.title}</p>
          <p className="text-white/40 text-xs mt-0.5 truncate">{displayName}</p>
          {stream.totalGiftCoins > 0 && (
            <p className="text-yellow-400/70 text-xs mt-1 flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {stream.totalGiftCoins.toLocaleString()} coins gifted
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
