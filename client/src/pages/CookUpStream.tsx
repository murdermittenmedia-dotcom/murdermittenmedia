/* ============================================================
   MURDER MITTEN MEDIA — Live Cook Up Stream Page
   Broadcaster: camera/mic via WebRTC (LiveKit) + RTMP key display
   Viewer: watch stream + send gifts + live chat
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Radio, Mic, MicOff, Video, VideoOff, Copy, ExternalLink,
  Coins, Gift, Send, Users, ChevronLeft, Settings,
} from "lucide-react";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  AudioTrack,
  useRoomContext,
  useParticipants,
  type TrackReference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

// ── Gift emoji map ────────────────────────────────────────────
const GIFT_EMOJIS: Record<string, string> = {
  "Mic Drop": "🎤",
  "Fire": "🔥",
  "Diamond": "💎",
  "Crown": "👑",
  "Rocket": "🚀",
  "100": "💯",
};

// ── Floating gift animation ───────────────────────────────────
type FloatingGift = { id: number; emoji: string; name: string; from: string };

function FloatingGifts({ gifts }: { gifts: FloatingGift[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {gifts.map((g, i) => (
        <div
          key={g.id}
          className="absolute flex flex-col items-center"
          style={{
            bottom: "60px",
            left: `${20 + (i % 5) * 15}%`,
            animation: "floatUp 2.5s ease-out forwards",
          }}
        >
          <span className="text-4xl drop-shadow-lg">{g.emoji}</span>
          <span className="text-white/80 text-xs mt-1 bg-black/70 px-2 py-0.5 rounded-full whitespace-nowrap">
            {g.from} · {g.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Viewer video ──────────────────────────────────────────────
function ViewerVideo() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const audioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);
  const participants = useParticipants();

  const remoteVideo = tracks.find(t => !t.participant.isLocal && t.publication) as TrackReference | undefined;
  const remoteAudio = audioTracks.filter(t => !t.participant.isLocal && t.publication) as TrackReference[];

  if (!remoteVideo) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a]">
        <Radio className="w-12 h-12 text-red-500/30 animate-pulse mb-3" />
        <p className="text-white/20 text-sm">Waiting for streamer...</p>
        <p className="text-white/10 text-xs mt-1">{participants.filter(p => !p.isLocal).length} watching</p>
      </div>
    );
  }

  return (
    <>
      <VideoTrack trackRef={remoteVideo} className="w-full h-full object-cover" />
      {remoteAudio.map(t => <AudioTrack key={t.participant.identity} trackRef={t} />)}
    </>
  );
}

// ── Broadcaster video ─────────────────────────────────────────
function BroadcasterVideo({ onEnd }: { onEnd: () => void }) {
  const room = useRoomContext();
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const localTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]).filter(t => t.participant.isLocal && t.publication);
  const localVideo = localTracks[0] as TrackReference | undefined;

  const toggleCam = async () => { await room.localParticipant.setCameraEnabled(!camOn); setCamOn(v => !v); };
  const toggleMic = async () => { await room.localParticipant.setMicrophoneEnabled(!micOn); setMicOn(v => !v); };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative flex-1 bg-[#0a0a0a] overflow-hidden">
        {localVideo ? (
          <VideoTrack trackRef={localVideo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoOff className="w-12 h-12 text-white/10" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 p-3 bg-[#0f0f0f]">
        <Button onClick={toggleCam} variant="outline" size="sm" className={`border-white/20 ${!camOn ? "text-red-400 border-red-600/40" : "text-white"}`}>
          {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </Button>
        <Button onClick={toggleMic} variant="outline" size="sm" className={`border-white/20 ${!micOn ? "text-red-400 border-red-600/40" : "text-white"}`}>
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </Button>
        <Button onClick={onEnd} variant="outline" size="sm" className="border-red-600/40 text-red-400 hover:bg-red-600/10">
          End Stream
        </Button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CookUpStream() {
  const params = useParams<{ id: string }>();
  const streamId = parseInt(params.id ?? "0");
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: stream, refetch: refetchStream } = trpc.live.get.useQuery({ id: streamId }, { refetchInterval: 15000 });
  const { data: viewerTokenData } = trpc.live.getViewerToken.useQuery(
    { streamId },
    { enabled: !!stream && stream.status !== "ended" }
  );
  const { data: coinBalance, refetch: refetchBalance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: giftTypes } = trpc.coins.getGiftTypes.useQuery();
  const { data: streamGifts } = trpc.gifts.getForStream.useQuery({ streamId }, { refetchInterval: 8000 });

  const isStreamer = isAuthenticated && user?.id === stream?.userId;

  const [broadcasterToken, setBroadcasterToken] = useState<string | null>(null);
  const [rtmpInfo, setRtmpInfo] = useState<{ rtmpUrl: string; rtmpKey: string } | null>(null);
  const [showRtmp, setShowRtmp] = useState(false);
  const [titleEdit, setTitleEdit] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);

  const createMutation = trpc.live.create.useMutation({
    onSuccess: (data) => {
      setBroadcasterToken(data.streamerToken);
      setRtmpInfo({ rtmpUrl: data.rtmpUrl, rtmpKey: data.rtmpKey });
    },
    onError: (err) => toast.error("Failed to start: " + err.message),
  });

  const endMutation = trpc.live.end.useMutation({
    onSuccess: () => { toast.success("Stream ended"); navigate("/cookup"); },
    onError: (err) => toast.error(err.message),
  });

  const updateTitleMutation = trpc.live.updateTitle.useMutation({
    onSuccess: () => { toast.success("Title updated"); refetchStream(); setEditingTitle(false); },
  });

  const sendGiftMutation = trpc.gifts.send.useMutation({
    onSuccess: () => refetchBalance(),
    onError: (err) => toast.error(err.message),
  });

  // Floating gifts
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const floatCounter = useRef(0);
  const addFloatingGift = useCallback((emoji: string, name: string, from: string) => {
    const id = ++floatCounter.current;
    setFloatingGifts(prev => [...prev, { id, emoji, name, from }]);
    setTimeout(() => setFloatingGifts(prev => prev.filter(g => g.id !== id)), 3000);
  }, []);

  // Chat
  const [chatMessages, setChatMessages] = useState<{ id: number; user: string; text: string; isGift?: boolean }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleSendGift = (giftTypeId: number) => {
    if (!isAuthenticated) { toast.error("Sign in to send gifts"); return; }
    const gt = giftTypes?.find(g => g.id === giftTypeId);
    if (!gt) return;
    if ((coinBalance?.balance ?? 0) < gt.coinCost) { toast.error(`Need ${gt.coinCost} coins`); return; }
    sendGiftMutation.mutate({ streamId, giftTypeId });
    const emoji = GIFT_EMOJIS[gt.name] || gt.emoji || "🎁";
    addFloatingGift(emoji, gt.name, user?.artistName || user?.name || "You");
    setChatMessages(prev => [...prev, { id: Date.now(), user: user?.artistName || user?.name || "You", text: `sent ${gt.name} ${emoji}`, isGift: true }]);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { id: Date.now(), user: user?.artistName || user?.name || "Viewer", text: chatInput.trim() }]);
    setChatInput("");
  };

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://mmm-wk6ms581.livekit.cloud";

  if (!stream) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <SiteNav />
        <p className="text-white/30">Loading...</p>
      </div>
    );
  }

  if (stream.status === "ended") {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Radio className="w-12 h-12 text-white/10 mb-4" />
          <h2 className="text-white/50 text-xl font-semibold mb-2">Stream Ended</h2>
          <Link href="/cookup"><Button className="mt-4 bg-red-600 hover:bg-red-700 text-white"><ChevronLeft className="w-4 h-4 mr-2" />Back to Cook Up</Button></Link>
        </div>
      </div>
    );
  }

  const displayName = stream.streamer?.artistName || stream.streamer?.name || "Unknown";
  const currentRtmpUrl = rtmpInfo?.rtmpUrl || stream.rtmpUrl || "";
  const currentRtmpKey = rtmpInfo?.rtmpKey || stream.rtmpKey || stream.livekitRoomName;

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      <SiteNav />

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full lg:px-4 lg:py-4 gap-0 lg:gap-4">

        {/* ── Left: Video ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f0f] border-b border-white/10 lg:rounded-t-lg">
            <Link href="/cookup" className="text-white/40 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              {editingTitle && isStreamer ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={titleEdit}
                    onChange={e => setTitleEdit(e.target.value)}
                    className="bg-white/5 border-white/20 text-white h-7 text-sm"
                    onKeyDown={e => { if (e.key === "Enter") updateTitleMutation.mutate({ streamId, title: titleEdit }); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                  />
                  <Button size="sm" onClick={() => updateTitleMutation.mutate({ streamId, title: titleEdit })} className="h-7 bg-red-600 hover:bg-red-700 text-white text-xs">Save</Button>
                </div>
              ) : (
                <span
                  className={`font-semibold text-sm truncate ${isStreamer ? "cursor-pointer hover:text-red-400" : ""}`}
                  onClick={() => { if (isStreamer) { setTitleEdit(stream.title); setEditingTitle(true); } }}
                >
                  {stream.title}
                </span>
              )}
            </div>
            <span className="text-white/30 text-xs shrink-0">{displayName}</span>
            {isStreamer && (
              <Button variant="outline" size="sm" onClick={() => setShowRtmp(!showRtmp)} className="border-white/20 text-white/60 hover:text-white h-7 text-xs shrink-0">
                <Settings className="w-3 h-3 mr-1" />
                OBS Key
              </Button>
            )}
          </div>

          {/* RTMP panel */}
          {showRtmp && isStreamer && (
            <div className="bg-[#111] border-b border-white/10 px-4 py-3">
              <p className="text-white/40 text-xs mb-2 uppercase tracking-widest">OBS / Streamlabs Setup</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-white/30 text-xs block mb-1">RTMP URL</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-green-400 truncate">{currentRtmpUrl}</code>
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0 border-white/20" onClick={() => { navigator.clipboard.writeText(currentRtmpUrl); toast.success("Copied!"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-white/30 text-xs block mb-1">Stream Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-yellow-400 truncate">{currentRtmpKey}</code>
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0 border-white/20" onClick={() => { navigator.clipboard.writeText(currentRtmpKey); toast.success("Copied!"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-white/20 text-xs">OBS: Settings → Stream → Service: Custom → paste URL and Key above</p>
            </div>
          )}

          {/* Video area */}
          <div className="relative bg-[#0a0a0a] min-h-[280px] lg:min-h-[480px] flex-1">
            {/* Viewer mode */}
            {!isStreamer && viewerTokenData && (
              <LiveKitRoom
                serverUrl={livekitUrl}
                token={viewerTokenData.viewerToken}
                connect={true}
                audio={false}
                video={false}
                className="w-full h-full absolute inset-0"
              >
                <ViewerVideo />
              </LiveKitRoom>
            )}

            {/* Broadcaster mode — browser cam */}
            {isStreamer && broadcasterToken && (
              <LiveKitRoom
                serverUrl={livekitUrl}
                token={broadcasterToken}
                connect={true}
                audio={true}
                video={true}
                className="w-full h-full absolute inset-0"
              >
                <BroadcasterVideo onEnd={() => endMutation.mutate({ streamId })} />
              </LiveKitRoom>
            )}

            {/* Broadcaster mode — choose method */}
            {isStreamer && !broadcasterToken && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <Radio className="w-12 h-12 text-red-500/40 animate-pulse" />
                <p className="text-white/40 text-sm text-center">Choose how you want to broadcast</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => createMutation.mutate({ title: stream.title })}
                    disabled={createMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    {createMutation.isPending ? "Starting..." : "Use Browser Camera"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowRtmp(true); createMutation.mutate({ title: stream.title }); }}
                    className="border-white/20 text-white/60 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Use OBS / Streamlabs
                  </Button>
                </div>
                <p className="text-white/20 text-xs text-center max-w-sm">
                  OBS/Streamlabs: click the button above to get your RTMP URL and stream key, then paste them into OBS
                </p>
              </div>
            )}

            {/* Viewer waiting */}
            {!isStreamer && !viewerTokenData && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/20 text-sm">Connecting...</p>
              </div>
            )}

            {/* Floating gifts overlay */}
            <FloatingGifts gifts={floatingGifts} />
          </div>

          {/* Gift panel — viewers */}
          {!isStreamer && (
            <div className="bg-[#0f0f0f] border-t border-white/10 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Gift className="w-3 h-3" /> Send a Gift
                </span>
                {isAuthenticated ? (
                  <div className="flex items-center gap-1 text-xs text-yellow-400">
                    <Coins className="w-3 h-3" />
                    <span className="font-semibold">{coinBalance?.balance ?? 0}</span>
                    <span className="text-white/30 ml-0.5">coins</span>
                    <Link href="/coins" className="ml-2 text-red-400 hover:text-red-300 underline text-xs">Buy More</Link>
                  </div>
                ) : (
                  <a href={getLoginUrl(`/cookup/${streamId}`)} className="text-xs text-red-400 hover:text-red-300">Sign in to gift</a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {giftTypes?.map((gt) => {
                  const emoji = GIFT_EMOJIS[gt.name] || gt.emoji || "🎁";
                  const canAfford = isAuthenticated && (coinBalance?.balance ?? 0) >= gt.coinCost;
                  return (
                    <button
                      key={gt.id}
                      onClick={() => handleSendGift(gt.id)}
                      disabled={!canAfford || sendGiftMutation.isPending}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-all
                        ${canAfford ? "border-white/10 bg-white/5 hover:border-red-600/50 hover:bg-red-600/10 cursor-pointer" : "border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed"}`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <span className="text-white/70 text-xs font-semibold">{gt.name}</span>
                      <span className="text-yellow-400/70 text-xs">{gt.coinCost} 🪙</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Chat ── */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-[#0f0f0f] border-t lg:border-t-0 lg:border-l border-white/10 lg:rounded-r-lg">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-white/40" />
            <span className="text-white/60 text-sm font-semibold">Live Chat</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[400px] lg:max-h-none">
            {chatMessages.length === 0 && (
              <p className="text-white/20 text-xs text-center py-8">No messages yet. Say something!</p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`text-sm ${msg.isGift ? "text-yellow-400" : "text-white/80"}`}>
                <span className="font-semibold text-red-400 mr-1">{msg.user}</span>
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="px-3 py-3 border-t border-white/10">
            {isAuthenticated ? (
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  placeholder="Say something..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm h-8"
                  maxLength={200}
                />
                <Button size="sm" onClick={handleSendChat} className="bg-red-600 hover:bg-red-700 text-white h-8 w-8 p-0">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <a href={getLoginUrl(`/cookup/${streamId}`)} className="block text-center text-xs text-red-400 hover:text-red-300 py-1">
                Sign in to chat
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Float-up animation */}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 0.8; transform: translateY(-120px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-160px) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
