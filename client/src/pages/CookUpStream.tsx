/* ============================================================
   MURDER MITTEN MEDIA — Live Cook Up Stream Page
   Broadcaster: camera/mic/screenshare via WebRTC (LiveKit) + RTMP key for OBS/Streamlabs
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
  Coins, Gift, Send, Users, ChevronLeft, Settings, Monitor,
  MonitorOff, Volume2, VolumeX, Info, CheckCircle2, AlertCircle,
  Maximize2, Minimize2,
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
import { Track, LocalTrack, LocalVideoTrack, LocalAudioTrack, createLocalTracks, VideoPresets } from "livekit-client";

// ── Gift emoji map ────────────────────────────────────────────
const GIFT_EMOJIS: Record<string, string> = {
  // Original gifts
  "Mic Drop": "🎤",
  "Fire": "🔥",
  "Diamond": "💎",
  "Crown": "👑",
  "Rocket": "🚀",
  "100": "💯",
  // New custom gifts
  "Detroit Fist": "✊",
  "Murder Mitten": "🧤",
  "Trap Star": "⭐",
  "Grillz": "😁",
  "Gold Chain": "📿",
  "Bando": "🏚️",
  "Dope Bag": "💊",
  "Drip": "💧",
  "Guap": "💰",
  "Shooter": "🔫",
  "Mitten King": "🏆",
  "Plug": "🔌",
  "Whip": "🚗",
  "Ice": "🧊",
  "Flame Verse": "🎵",
  "Crimson Wave": "🌊",
  "MMM Logo": "🎙️",
  "Street Cred": "📜",
  "Legendary Drop": "💫",
  "God Tier": "🌟",
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-white/10 hover:border-white/30",
  uncommon: "border-green-500/30 hover:border-green-400/60",
  rare: "border-blue-500/30 hover:border-blue-400/60",
  epic: "border-purple-500/30 hover:border-purple-400/60",
  legendary: "border-orange-500/40 hover:border-orange-400/70",
  mythic: "border-red-500/50 hover:border-red-400/80",
};

const RARITY_LABEL: Record<string, string> = {
  common: "",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-orange-400",
  mythic: "text-red-400",
};

// ── Audio quality presets ─────────────────────────────────────
const AUDIO_PRESETS = [
  { label: "High (Studio)", sampleRate: 48000, bitrate: 256000, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  { label: "Medium (Balanced)", sampleRate: 44100, bitrate: 128000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  { label: "Low (Save Data)", sampleRate: 22050, bitrate: 64000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
];

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
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const audioTracks = useTracks([
    { source: Track.Source.Microphone, withPlaceholder: false },
    { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
  ]);
  const participants = useParticipants();

  // Prefer screenshare over camera
  const remoteScreenShare = tracks.find(t => !t.participant.isLocal && t.publication && t.source === Track.Source.ScreenShare) as TrackReference | undefined;
  const remoteCamera = tracks.find(t => !t.participant.isLocal && t.publication && t.source === Track.Source.Camera) as TrackReference | undefined;
  const remoteVideo = remoteScreenShare || remoteCamera;
  const remoteAudio = audioTracks.filter(t => !t.participant.isLocal && t.publication) as TrackReference[];

  // Apply volume to all audio tracks
  useEffect(() => {
    audioRefs.current.forEach(audio => {
      audio.volume = volume;
    });
  }, [volume]);

  const toggleFullscreen = () => {
    if (!isFullscreen && videoContainerRef.current) {
      const elem = videoContainerRef.current;
      const requestFullscreen = elem.requestFullscreen || (elem as any).webkitRequestFullscreen || (elem as any).mozRequestFullScreen || (elem as any).msRequestFullscreen;
      if (requestFullscreen) {
        requestFullscreen.call(elem).catch(() => {
          setIsFullscreen(true);
        });
        setIsFullscreen(true);
      }
    } else {
      const exitFullscreen = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen || (document as any).msExitFullscreen;
      if (exitFullscreen) {
        exitFullscreen.call(document).catch(() => {
          setIsFullscreen(false);
        });
      }
      setIsFullscreen(false);
    }
  };

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
    <div ref={videoContainerRef} className={`w-full h-full flex flex-col relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] relative group">
        <VideoTrack trackRef={remoteVideo} className="w-full h-full object-contain" />
        
        {/* Desktop controls (hover-based) */}
        <div className="absolute inset-0 hidden lg:flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
          {/* Top controls */}
          <div className="flex justify-end gap-2">
            <button
              onClick={toggleFullscreen}
              className="bg-black/60 hover:bg-black/80 text-white p-2 rounded transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Bottom controls */}
          <div className="flex items-center gap-3 bg-black/60 rounded px-3 py-2 w-fit">
            {/* Volume control */}
            <div className="flex items-center gap-2">
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-white/60" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/60" />
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600"
                title="Volume"
              />
              <span className="text-xs text-white/60 w-6">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
        
        {/* Mobile controls (always visible) */}
        <div className="absolute inset-0 flex lg:hidden flex-col justify-between p-2 bg-gradient-to-t from-black/60 to-transparent">
          {/* Top controls */}
          <div className="flex justify-end gap-1">
            <button
              onClick={toggleFullscreen}
              className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
          
          {/* Bottom controls - Mobile */}
          <div className="flex items-center gap-2 bg-black/60 rounded px-2 py-1.5 w-fit text-xs">
            {volume === 0 ? (
              <VolumeX className="w-3 h-3 text-white/60 shrink-0" />
            ) : (
              <Volume2 className="w-3 h-3 text-white/60 shrink-0" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-0.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600"
              title="Volume"
            />
            <span className="text-white/60 w-5">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </div>
      {remoteAudio.map(t => (
        <AudioTrack
          key={`${t.participant.identity}-${t.source}`}
          trackRef={t}
        />
      ))}
    </div>
  );
}

// ── Broadcaster controls ──────────────────────────────────────
function BroadcasterVideo({ onEnd, audioPresetIdx, isAdmin, onFullscreenChange }: { onEnd: () => void; audioPresetIdx: number; isAdmin?: boolean; onFullscreenChange?: (fullscreen: boolean) => void }) {
  const room = useRoomContext();
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [screenAudioOn, setScreenAudioOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const localCamTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]).filter(t => t.participant.isLocal && t.publication) as TrackReference[];
  const localScreenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]).filter(t => t.participant.isLocal && t.publication) as TrackReference[];
  const localVideo = localScreenTracks[0] || localCamTracks[0];

  const preset = AUDIO_PRESETS[audioPresetIdx] ?? AUDIO_PRESETS[0];

  const startCamera = async () => {
    try {
      await room.localParticipant.setCameraEnabled(true, {
        resolution: VideoPresets.h720.resolution,
      });
      setCamOn(true);
    } catch (e) {
      toast.error("Could not access camera. Check browser permissions.");
    }
  };

  const stopCamera = async () => {
    await room.localParticipant.setCameraEnabled(false);
    setCamOn(false);
  };

  const startMic = async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: preset.echoCancellation,
        noiseSuppression: preset.noiseSuppression,
        autoGainControl: preset.autoGainControl,
        sampleRate: preset.sampleRate,
      });
      setMicOn(true);
    } catch (e) {
      toast.error("Could not access microphone. Check browser permissions.");
    }
  };

  const stopMic = async () => {
    await room.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
  };

  const startScreenShare = async () => {
    try {
      // Request screenshare with audio (desktop audio capture)
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: preset.sampleRate,
        },
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        const lkVideoTrack = new LocalVideoTrack(videoTrack, undefined, false);
        await room.localParticipant.publishTrack(lkVideoTrack, {
          source: Track.Source.ScreenShare,
          videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
        });
        setScreenOn(true);

        // Auto-stop when user clicks "Stop sharing" in browser
        videoTrack.addEventListener("ended", () => {
          stopScreenShare();
        });
      }

      if (audioTrack) {
        const lkAudioTrack = new LocalAudioTrack(audioTrack, undefined, false);
        await room.localParticipant.publishTrack(lkAudioTrack, {
          source: Track.Source.ScreenShareAudio,
        });
        setScreenAudioOn(true);
        toast.success("Screen + desktop audio captured!");
      } else {
        toast.success("Screen captured! (No desktop audio — check 'Share audio' in the browser dialog)");
      }
    } catch (e: any) {
      if (e.name !== "NotAllowedError") {
        toast.error("Could not start screenshare: " + e.message);
      }
    }
  };

  const stopScreenShare = async () => {
    const screenTracks = Array.from(room.localParticipant.getTrackPublications().values());
    for (const pub of screenTracks) {
      if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
        await room.localParticipant.unpublishTrack(pub.track as LocalTrack);
      }
    }
    setScreenOn(false);
    setScreenAudioOn(false);
  };

  const toggleMute = () => {
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (micPub?.track) {
      if (muted) {
        (micPub.track as LocalAudioTrack).unmute();
      } else {
        (micPub.track as LocalAudioTrack).mute();
      }
      setMuted(v => !v);
    }
  };

  const toggleFullscreen = () => {
    if (!fullscreen && videoContainerRef.current) {
      videoContainerRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
    // Also update parent component state
    onFullscreenChange?.(!fullscreen);
  };

  return (
    <div className={`w-full h-full flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`} ref={videoContainerRef}>
      {/* Video preview */}
      <div className="relative flex-1 bg-[#0a0a0a] overflow-hidden min-h-[200px] flex items-center justify-center">
        {localVideo ? (
          <VideoTrack trackRef={localVideo} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <VideoOff className="w-10 h-10 text-white/10" />
            <p className="text-white/20 text-xs">No video source active</p>
          </div>
        )}

        {/* LIVE badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Screenshare + audio badges */}
        {screenOn && (
          <div className="absolute top-3 left-20 flex items-center gap-1 bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded-sm">
            <Monitor className="w-3 h-3" />
            Screen
            {screenAudioOn && <span className="ml-1 text-green-300">+ Audio</span>}
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 text-white/40 hover:text-white bg-black/40 p-1.5 rounded z-40"
          title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-[#0f0f0f] border-t border-white/10">
        {/* Camera */}
        <Button
          onClick={camOn ? stopCamera : startCamera}
          variant="outline"
          size="sm"
          className={`border-white/20 ${camOn ? "text-white" : "text-red-400 border-red-600/40"}`}
          title={camOn ? "Turn off camera" : "Turn on camera"}
        >
          {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          <span className="ml-1.5 text-xs hidden sm:inline">{camOn ? "Cam On" : "Cam Off"}</span>
        </Button>

        {/* Mic */}
        <Button
          onClick={micOn ? stopMic : startMic}
          variant="outline"
          size="sm"
          className={`border-white/20 ${micOn ? "text-white" : "text-red-400 border-red-600/40"}`}
          title={micOn ? "Turn off mic" : "Turn on mic"}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span className="ml-1.5 text-xs hidden sm:inline">{micOn ? "Mic On" : "Mic Off"}</span>
        </Button>

        {/* Mute toggle (when mic is on) */}
        {micOn && (
          <Button
            onClick={toggleMute}
            variant="outline"
            size="sm"
            className={`border-white/20 ${muted ? "text-yellow-400 border-yellow-600/40" : "text-white"}`}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="ml-1.5 text-xs hidden sm:inline">{muted ? "Muted" : "Live"}</span>
          </Button>
        )}

        {/* Screenshare */}
        <Button
          onClick={screenOn ? stopScreenShare : startScreenShare}
          variant="outline"
          size="sm"
          className={`border-white/20 ${screenOn ? "text-blue-400 border-blue-600/40" : "text-white/60"}`}
          title={screenOn ? "Stop screenshare" : "Share screen (includes desktop audio)"}
        >
          {screenOn ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          <span className="ml-1.5 text-xs hidden sm:inline">{screenOn ? "Stop Share" : "Share Screen"}</span>
        </Button>

        {/* End stream */}
        <Button
          onClick={onEnd}
          variant="outline"
          size="sm"
          className="border-red-600/60 text-red-400 hover:bg-red-600/10 ml-auto"
        >
          End Stream
        </Button>
        {isAdmin && (
          <Button
            onClick={onEnd}
            size="sm"
            className="bg-red-900/40 border border-red-600/60 text-red-300 hover:bg-red-900/60"
            title="Admin: Force end this stream"
          >
            ⏹ Admin End
          </Button>
        )}
      </div>

      {/* Audio quality indicator */}
      <div className="px-3 py-1.5 bg-[#0a0a0a] border-t border-white/5 flex items-center gap-2">
        <Volume2 className="w-3 h-3 text-white/20" />
        <span className="text-white/30 text-xs">Audio: {preset.label}</span>
        {!preset.echoCancellation && (
          <span className="text-green-500/60 text-xs ml-1">· Studio mode (no processing)</span>
        )}
      </div>
    </div>
  );
}

// ── OBS / Streamlabs Setup Guide ──────────────────────────────
function OBSGuide({ rtmpUrl, rtmpKey }: { rtmpUrl: string; rtmpKey: string }) {
  const [tab, setTab] = useState<"obs" | "streamlabs">("obs");

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-blue-400" />
        <span className="text-white/80 text-sm font-semibold">Stream with OBS or Streamlabs</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-md p-0.5">
        {(["obs", "streamlabs"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${tab === t ? "bg-red-600 text-white" : "text-white/40 hover:text-white"}`}
          >
            {t === "obs" ? "OBS Studio" : "Streamlabs"}
          </button>
        ))}
      </div>

      {/* Credentials */}
      <div className="space-y-2">
        <div>
          <label className="text-white/30 text-xs block mb-1 uppercase tracking-widest">RTMP Server URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-green-400 truncate font-mono">{rtmpUrl}</code>
            <Button size="sm" variant="outline" className="h-8 border-white/20 shrink-0" onClick={() => copyText(rtmpUrl, "RTMP URL")}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div>
          <label className="text-white/30 text-xs block mb-1 uppercase tracking-widest">Stream Key</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-yellow-400 truncate font-mono">{rtmpKey}</code>
            <Button size="sm" variant="outline" className="h-8 border-white/20 shrink-0" onClick={() => copyText(rtmpKey, "Stream Key")}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Step-by-step instructions */}
      {tab === "obs" ? (
        <div className="space-y-2">
          <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">OBS Studio Setup</p>
          {[
            "Open OBS Studio → click Settings (bottom right)",
            "Go to Stream tab",
            'Set Service to "Custom..."',
            "Paste the RTMP Server URL into the Server field",
            "Paste the Stream Key into the Stream Key field",
            "Click Apply → OK",
            "Add your audio sources: Desktop Audio + Mic/Aux",
            'Click Start Streaming — you\'re live!',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
              <span className="text-white/60 text-xs leading-relaxed">{step}</span>
            </div>
          ))}
          <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
            <strong>Pro tip:</strong> In OBS Audio Settings, set Sample Rate to 48 kHz and use "High Quality Resampling" for studio-quality audio.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Streamlabs Setup</p>
          {[
            "Open Streamlabs Desktop",
            "Click the Settings gear icon (bottom left)",
            "Go to Stream tab",
            'Set Stream Type to "Custom Streaming Server"',
            "Paste the RTMP Server URL into the URL field",
            "Paste the Stream Key into the Stream Key field",
            "Click Done",
            "Add Desktop Audio + Mic sources in your scene",
            "Click Go Live — you're live!",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
              <span className="text-white/60 text-xs leading-relaxed">{step}</span>
            </div>
          ))}
          <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
            <strong>Pro tip:</strong> In Streamlabs Audio Settings, enable "High-quality audio" and set bitrate to 320 kbps for the best sound.
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/10 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-white/30 text-xs">Keep this stream key private. Anyone with it can broadcast to your stream.</p>
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
  const { data: streamerTokenData } = trpc.live.getStreamerToken.useQuery(
    { streamId },
    { enabled: !!stream && isAuthenticated && stream.status !== "ended" && !!user && stream.userId === user.id }
  );
  const { data: coinBalance, refetch: refetchBalance } = trpc.coins.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: giftTypes } = trpc.coins.getGiftTypes.useQuery();
  const { data: streamGifts } = trpc.gifts.getForStream.useQuery({ streamId }, { refetchInterval: 8000 });

  const isStreamer = isAuthenticated && !!user && !!stream && user.id === stream.userId;

  const [showRtmp, setShowRtmp] = useState(false);
  const [titleEdit, setTitleEdit] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [audioPresetIdx, setAudioPresetIdx] = useState(0);
  const [broadcasterFullscreen, setBroadcasterFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<"browser" | "obs" | null>(null);

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
  const [chatMessages, setChatMessages] = useState<{ id: number; user: string; userId?: number; text: string; isGift?: boolean }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Show gifts in chat
  useEffect(() => {
    if (!streamGifts) return;
    streamGifts.forEach(g => {
      const emoji = GIFT_EMOJIS[g.giftType?.name ?? ""] || g.giftType?.emoji || "🎁";
      const from = g.from?.artistName || g.from?.name || "Someone";
      addFloatingGift(emoji, g.giftType?.name ?? "Gift", from);
    });
  }, [streamGifts?.length]);

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
    setChatMessages(prev => [...prev, { id: Date.now(), user: user?.artistName || user?.name || "Viewer", userId: user?.id, text: chatInput.trim() }]);
    setChatInput("");
  };

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://mmm-wk6ms581.livekit.cloud";
  // Always use LiveKit-issued URL and key from the DB — never fall back to manually built values
  const currentRtmpUrl = stream?.rtmpUrl ?? "";
  const currentRtmpKey = stream?.rtmpKey ?? "";
  const currentIngressId = (stream as any)?.ingressId ?? null;

  // ── Ingress status polling (every 10s while OBS panel is open) ──
  const { data: ingressStatusData, refetch: refetchIngressStatus } = trpc.live.ingressStatus.useQuery(
    { streamId },
    {
      enabled: isStreamer && showRtmp && !!currentIngressId,
      refetchInterval: showRtmp ? 10000 : false,
    }
  );
  const ingressStatus = ingressStatusData?.status ?? (currentIngressId ? 'CHECKING...' : 'NO_INGRESS');

  // ── Regenerate stream key mutation ──
  const regenerateMutation = trpc.live.regenerateStreamKey.useMutation({
    onSuccess: (data) => {
      toast.success("New stream key generated! Update OBS/Streamlabs with the new credentials.");
      refetchStream();
      refetchIngressStatus();
    },
    onError: (err) => toast.error("Failed to regenerate: " + err.message),
  });

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
          <Link href="/cookup">
            <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white">
              <ChevronLeft className="w-4 h-4 mr-2" />Back to Cook Up
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = stream.streamer?.artistName || stream.streamer?.name || "Unknown";

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      <SiteNav />

      <div className={`flex-1 flex flex-col lg:flex-row max-w-[1600px] mx-auto w-full lg:px-4 lg:py-4 gap-0 lg:gap-4 ${broadcasterFullscreen ? 'lg:flex-col' : ''}`}>

        {/* ── Left: Video ── */}
        <div className="flex-1 flex flex-col min-w-0 max-h-[calc(100vh-200px)] order-first lg:order-none">

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
                    onKeyDown={e => {
                      if (e.key === "Enter") updateTitleMutation.mutate({ streamId, title: titleEdit });
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={() => updateTitleMutation.mutate({ streamId, title: titleEdit })} className="h-7 bg-red-600 hover:bg-red-700 text-white text-xs">Save</Button>
                </div>
              ) : (
                <span
                  className={`font-semibold text-sm truncate ${isStreamer ? "cursor-pointer hover:text-red-400" : ""}`}
                  onClick={() => { if (isStreamer) { setTitleEdit(stream.title); setEditingTitle(true); } }}
                  title={isStreamer ? "Click to edit title" : undefined}
                >
                  {stream.title}
                </span>
              )}
            </div>
            <span className="text-white/30 text-xs shrink-0">{displayName}</span>
            {isStreamer && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="border-white/20 text-white/60 hover:text-white h-7 text-xs">
                  <Settings className="w-3 h-3 mr-1" />
                  Settings
                </Button>
              </div>
            )}
            {user?.role === "admin" && stream?.status === "live" && (
              <Button
                onClick={() => endMutation.mutate({ streamId })}
                size="sm"
                className="bg-red-900/40 border border-red-600/60 text-red-300 hover:bg-red-900/60 h-7 text-xs shrink-0"
                title="Admin: Force end this stream"
              >
                Admin End
              </Button>
            )}
          </div>

          {/* Streamer settings panel */}
          {showSettings && isStreamer && (
            <div className="bg-[#111] border-b border-white/10 px-4 py-4 space-y-4">
              {/* Audio quality */}
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Audio Quality</p>
                <div className="flex flex-wrap gap-2">
                  {AUDIO_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setAudioPresetIdx(i)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${audioPresetIdx === i ? "bg-red-600 border-red-600 text-white" : "border-white/20 text-white/50 hover:text-white hover:border-white/40"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-white/20 text-xs mt-1">
                  {AUDIO_PRESETS[audioPresetIdx].echoCancellation
                    ? "Echo cancellation + noise suppression enabled"
                    : "Raw audio — best for music production (no processing)"}
                </p>
              </div>

              {/* OBS/Streamlabs guide */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowRtmp(!showRtmp)}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-xs font-semibold uppercase tracking-widest"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {showRtmp ? "Hide" : "Show"} OBS / Streamlabs Setup
                  </button>
                  {/* Ingress connection status badge */}
                  {showRtmp && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      ingressStatus === 'ACTIVE' ? 'bg-green-600/20 text-green-400 border border-green-600/40' :
                      ingressStatus === 'ENDPOINT_BUFFERING' || ingressStatus === 'RECONNECTING' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/40' :
                      ingressStatus === 'ENDPOINT_INACTIVE' ? 'bg-white/10 text-white/40 border border-white/20' :
                      'bg-white/5 text-white/30 border border-white/10'
                    }`}>
                      {ingressStatus === 'ACTIVE' ? '🟢 OBS Connected' :
                       ingressStatus === 'ENDPOINT_BUFFERING' ? '🟡 Buffering...' :
                       ingressStatus === 'RECONNECTING' ? '🟡 Reconnecting...' :
                       ingressStatus === 'ENDPOINT_INACTIVE' ? '⚪ Waiting for OBS' :
                       ingressStatus === 'NO_INGRESS' ? '🔴 No Ingress' :
                       ingressStatus}
                    </span>
                  )}
                </div>
                {showRtmp && (
                  <>
                    <OBSGuide rtmpUrl={currentRtmpUrl} rtmpKey={currentRtmpKey} />
                    {/* Regenerate stream key button */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-white/30 text-xs mb-2">If OBS/Streamlabs won't connect, regenerate your stream key to get a fresh ingress.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("This will disconnect any active OBS session and generate new credentials. Continue?")) {
                            regenerateMutation.mutate({ streamId });
                          }
                        }}
                        disabled={regenerateMutation.isPending}
                        className="border-yellow-600/40 text-yellow-400 hover:bg-yellow-600/10 hover:text-yellow-300 text-xs"
                      >
                        {regenerateMutation.isPending ? "Regenerating..." : "🔄 Regenerate Stream Key / Reset OBS Connection"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Video area */}
          <div className="relative bg-[#0a0a0a] flex-1 flex items-center justify-center overflow-hidden w-full min-h-[200px] lg:aspect-video">

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

            {/* Broadcaster mode — browser */}
            {isStreamer && broadcastMode === "browser" && streamerTokenData && (
              <LiveKitRoom
                serverUrl={livekitUrl}
                token={streamerTokenData.streamerToken}
                connect={true}
                audio={false}
                video={false}
                className="w-full h-full absolute inset-0"
              >
                <BroadcasterVideo
                  onEnd={() => endMutation.mutate({ streamId })}
                  audioPresetIdx={audioPresetIdx}
                  isAdmin={user?.role === "admin"}
                  onFullscreenChange={setBroadcasterFullscreen}
                />
              </LiveKitRoom>
            )}

            {/* Broadcaster mode — OBS/Streamlabs (just show the viewer feed) */}
            {isStreamer && broadcastMode === "obs" && viewerTokenData && (
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
            {isStreamer && broadcastMode === "obs" && (
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-2 rounded-lg text-xs text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  OBS/Streamlabs mode — stream from your software
                </div>
                <Button
                  onClick={() => endMutation.mutate({ streamId })}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs"
                >
                  End Stream
                </Button>
              </div>
            )}

            {/* Broadcaster mode — choose method */}
            {isStreamer && !broadcastMode && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
                <Radio className="w-12 h-12 text-red-500/40 animate-pulse" />
                <div className="text-center">
                  <p className="text-white/60 text-sm font-semibold mb-1">Choose how to broadcast</p>
                  <p className="text-white/30 text-xs">You're live — pick your source</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <button
                    onClick={() => setBroadcastMode("browser")}
                    className="flex-1 flex flex-col items-center gap-2 p-4 border border-white/10 bg-white/[0.03] hover:border-red-600/50 hover:bg-red-600/5 rounded-lg transition-all group"
                  >
                    <Video className="w-6 h-6 text-white/40 group-hover:text-red-400" />
                    <span className="text-white/70 text-sm font-semibold">Browser Camera</span>
                    <span className="text-white/30 text-xs text-center">Use your webcam, mic, and screen share directly in the browser</span>
                  </button>
                  <button
                    onClick={() => { setBroadcastMode("obs"); setShowSettings(true); setShowRtmp(true); }}
                    className="flex-1 flex flex-col items-center gap-2 p-4 border border-white/10 bg-white/[0.03] hover:border-blue-600/50 hover:bg-blue-600/5 rounded-lg transition-all group"
                  >
                    <Monitor className="w-6 h-6 text-white/40 group-hover:text-blue-400" />
                    <span className="text-white/70 text-sm font-semibold">OBS / Streamlabs</span>
                    <span className="text-white/30 text-xs text-center">Stream from OBS or Streamlabs for maximum quality and control</span>
                  </button>
                </div>
                <p className="text-white/20 text-xs text-center max-w-xs">
                  OBS/Streamlabs gives you the best audio quality for music production sessions
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

          {/* ── LIVE STATS BAR ── */}
          <div className="bg-[#0c0c0c] border-t border-white/10 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {/* Viewer count */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/40">Viewers</span>
              <span className="text-white font-semibold">{stream.viewerCount ?? 0}</span>
              {(stream.peakViewerCount ?? 0) > 0 && (
                <span className="text-white/25 text-[10px]">peak {stream.peakViewerCount}</span>
              )}
            </div>
            {/* Total gifts */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-white/40">Gifts</span>
              <span className="text-white font-semibold">{streamGifts?.length ?? 0}</span>
            </div>
            {/* Total coins gifted */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-yellow-400/60">🪙</span>
              <span className="text-white/40">Coins Gifted</span>
              <span className="text-yellow-400 font-semibold">{stream.totalGiftCoins ?? 0}</span>
            </div>
            {/* Live Rewards earned (streamer only) */}
            {isStreamer && (stream.totalGiftUsd ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-green-400/60">💰</span>
                <span className="text-white/40">Live Rewards</span>
                <span className="text-green-400 font-semibold">${((stream.totalGiftUsd ?? 0) / 100).toFixed(2)}</span>
              </div>
            )}
            {/* Most recent gift */}
            {streamGifts && streamGifts.length > 0 && (() => {
              const latest = streamGifts[streamGifts.length - 1];
              const emoji = GIFT_EMOJIS[latest.giftType?.name ?? ""] || latest.giftType?.emoji || "🎁";
              const from = latest.from?.artistName || latest.from?.name || "Someone";
              return (
                <div className="flex items-center gap-1 text-xs ml-auto">
                  <span className="text-white/25">Latest:</span>
                  <span>{emoji}</span>
                  <span className="text-white/50">{latest.giftType?.name ?? "Gift"}</span>
                  <span className="text-white/25">from</span>
                  <span className="text-red-400">{from}</span>
                </div>
              );
            })()}
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
                  const rarity = (gt as any).rarity || "common";
                  const canAfford = isAuthenticated && (coinBalance?.balance ?? 0) >= gt.coinCost;
                  const borderClass = canAfford ? RARITY_BORDER[rarity] || RARITY_BORDER.common : "border-white/5 opacity-40";
                  return (
                    <button
                      key={gt.id}
                      onClick={() => handleSendGift(gt.id)}
                      disabled={!canAfford || sendGiftMutation.isPending}
                      title={(gt as any).description || gt.name}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-all bg-white/5
                        ${canAfford ? `${borderClass} hover:bg-white/10 cursor-pointer` : "border-white/5 bg-white/[0.02] cursor-not-allowed"}`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <span className={`text-xs font-semibold ${RARITY_LABEL[rarity] || "text-white/70"}`}>{gt.name}</span>
                      <span className="text-yellow-400/70 text-xs">{gt.coinCost} 🪙</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Chat ── */}
        <div className={`w-full ${broadcasterFullscreen ? 'lg:h-40' : 'lg:w-80 xl:w-96'} flex flex-col bg-[#0f0f0f] border-t lg:border-t-0 lg:border-l border-white/10 lg:rounded-r-lg order-last lg:order-none`}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-white/40" />
            <span className="text-white/60 text-sm font-semibold">Live Chat</span>
          </div>
          <div className={`flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] ${broadcasterFullscreen ? 'max-h-24' : 'max-h-[400px] lg:max-h-none'}`}>
            {chatMessages.length === 0 && (
              <p className="text-white/20 text-xs text-center py-8">No messages yet. Say something!</p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`text-sm ${msg.isGift ? "text-yellow-400" : "text-white/80"}`}>
                {msg.userId ? (
                  <Link href={`/profile/${msg.userId}`} className="font-semibold text-red-400 mr-1 hover:text-red-300 cursor-pointer">
                    {msg.user}
                  </Link>
                ) : (
                  <span className="font-semibold text-red-400 mr-1">{msg.user}</span>
                )}
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
