/**
 * JudgeLiveBroadcast — native browser mic + camera broadcast for judges
 * Uses LiveKit client SDK to publish directly from the browser.
 * No OBS or RTMP ingress required.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, LocalTrack, createLocalVideoTrack, createLocalAudioTrack, Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface JudgeLiveBroadcastProps {
  broadcastId: number;
  token: string;
  livekitUrl: string;
  onStop: () => void;
}

export function JudgeLiveBroadcast({ broadcastId, token, livekitUrl, onStop }: JudgeLiveBroadcastProps) {
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);

  // Connect to LiveKit room and publish mic + camera
  useEffect(() => {
    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setConnected(false);
    });

    (async () => {
      try {
        // Request mic + camera permissions
        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack({ resolution: { width: 1280, height: 720, frameRate: 30 } }),
          createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true }),
        ]);

        if (cancelled) {
          videoTrack.stop();
          audioTrack.stop();
          return;
        }

        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);

        // Attach local video preview
        if (localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }

        // Connect to room
        await room.connect(livekitUrl, token);
        if (cancelled) { await room.disconnect(); return; }

        // Publish both tracks
        await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
        await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });

        if (!cancelled) {
          setConnected(true);
          setConnecting(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Failed to connect";
          setError(msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Camera/mic permission denied. Please allow access in your browser."
            : msg);
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [token, livekitUrl]);

  // Attach local video track to video element after track is set
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.attach(localVideoRef.current);
    }
  }, [localVideoTrack]);

  const toggleMic = useCallback(async () => {
    if (!localAudioTrack) return;
    try {
      if (micOn) {
        await localAudioTrack.mute();
        setMicOn(false);
      } else {
        await localAudioTrack.unmute();
        setMicOn(true);
      }
    } catch (e) {
      toast.error("Failed to toggle mic");
    }
  }, [micOn, localAudioTrack]);

  const toggleCam = useCallback(async () => {
    if (!localVideoTrack) return;
    try {
      if (camOn) {
        await localVideoTrack.mute();
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCamOn(false);
      } else {
        await localVideoTrack.unmute();
        if (localVideoRef.current) localVideoTrack.attach(localVideoRef.current);
        setCamOn(true);
      }
    } catch (e) {
      toast.error("Failed to toggle camera");
    }
  }, [camOn, localVideoTrack]);

  const handleStop = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
    }
    onStop();
  }, [onStop]);

  if (error) {
    return (
      <div className="border border-red-500/40 bg-red-500/10 rounded p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-red-400 text-sm font-semibold mb-1">Broadcast Error</div>
          <div className="text-white/60 text-xs">{error}</div>
          <button
            onClick={onStop}
            className="mt-3 text-xs border border-red-500/50 text-red-400 px-3 py-1.5 hover:bg-red-500/10 transition-colors rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-green-500/40 bg-black/60 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2">
          {connecting ? (
            <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
          <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">
            {connecting ? "Connecting…" : "🟢 Live"}
          </span>
        </div>
        <button
          onClick={handleStop}
          className="text-white/40 hover:text-red-400 transition-colors"
          title="Stop broadcasting"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Local video preview */}
      <div className="relative aspect-video bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity ${camOn ? "opacity-100" : "opacity-0"}`}
        />
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-white/30" />
          </div>
        )}
        {connecting && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-green-400 animate-spin mx-auto mb-2" />
              <div className="text-white/60 text-xs">Starting broadcast…</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-3 py-2.5 border-t border-white/10">
        <button
          onClick={toggleMic}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
            micOn
              ? "bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
              : "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
          }`}
          disabled={connecting}
        >
          {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          {micOn ? "Mic On" : "Mic Off"}
        </button>
        <button
          onClick={toggleCam}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
            camOn
              ? "bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
              : "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
          }`}
          disabled={connecting}
        >
          {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          {camOn ? "Cam On" : "Cam Off"}
        </button>
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 transition-all ml-auto"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

/**
 * JudgeBroadcastViewer — viewer side: subscribes to a judge's LiveKit room and shows their video+audio
 */
interface JudgeBroadcastViewerProps {
  roomName: string;
  livekitUrl: string;
  viewerToken: string;
  judgeName: string;
  judgeUserId: number;
}

export function JudgeBroadcastViewer({ roomName, livekitUrl, viewerToken, judgeName, judgeUserId }: JudgeBroadcastViewerProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (cancelled) return;
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
        setHasVideo(true);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) setHasVideo(false);
    });

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) setConnected(true);
    });

    room.connect(livekitUrl, viewerToken).catch(() => {});

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [livekitUrl, viewerToken]);

  return (
    <div className="border border-green-500/30 bg-black/40 rounded overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${hasVideo ? "opacity-100" : "opacity-0"}`}
        />
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {connected ? (
                <>
                  <VideoOff className="w-6 h-6 text-white/30 mx-auto mb-1" />
                  <div className="text-white/30 text-xs">Camera off</div>
                </>
              ) : (
                <>
                  <Loader2 className="w-5 h-5 text-green-400 animate-spin mx-auto mb-1" />
                  <div className="text-white/40 text-xs">Connecting…</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-green-500/20">
        <div className="flex items-center justify-between">
          <a href={`/profile/${judgeUserId}`} className="text-white/80 text-xs font-semibold hover:text-white truncate">
            {judgeName}
          </a>
          <div className="text-green-400 text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>
    </div>
  );
}
