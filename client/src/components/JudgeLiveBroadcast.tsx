/**
 * JudgeLiveBroadcast — native browser mic + camera broadcast for judges
 * Uses LiveKit client SDK to publish directly from the browser.
 * No OBS or RTMP ingress required.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import { JUDGE_PANEL_LAYOUT } from "@/lib/musicReviewLayout";
import { Room, RoomEvent, LocalTrack, createLocalVideoTrack, createLocalAudioTrack, Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { shouldEndJudgeBroadcast } from "@/lib/musicReviewLive";

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
  const endBroadcastMutation = trpc.review.endBroadcast.useMutation();
  const activateBroadcastMutation = trpc.review.activateBroadcast.useMutation();
  const endedRef = useRef(false);
  const onStopRef = useRef(onStop);
  const endBroadcastRef = useRef(endBroadcastMutation.mutateAsync);
  const activateBroadcastRef = useRef(activateBroadcastMutation.mutateAsync);
  onStopRef.current = onStop;
  endBroadcastRef.current = endBroadcastMutation.mutateAsync;
  activateBroadcastRef.current = activateBroadcastMutation.mutateAsync;

  const finishBroadcast = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    void endBroadcastRef.current({ broadcastId }).catch(() => undefined);
    onStopRef.current();
  }, [broadcastId]);

  // Connect to LiveKit room and publish mic + camera
  useEffect(() => {
    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    room.on(RoomEvent.Disconnected, () => {
      if (shouldEndJudgeBroadcast("disconnected") && !cancelled) {
        setConnected(false);
        finishBroadcast();
      }
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
        await activateBroadcastRef.current({ broadcastId });

        if (!cancelled) {
          setConnected(true);
          setConnecting(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          // A server broadcast is created before the local connection begins. End it
          // on any media/transport failure so an empty room never occupies a judge slot.
          endedRef.current = true;
          void endBroadcastRef.current({ broadcastId }).catch(() => undefined);
          room.disconnect();
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
      finishBroadcast();
    };
  }, [token, livekitUrl, finishBroadcast]);

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
    finishBroadcast();
  }, [finishBroadcast]);

  if (error) {
    return (
      <div className="border border-red-500/40 bg-red-500/10 rounded p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-red-300 text-sm font-semibold mb-1">Camera or microphone needs attention</div>
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
    <div className="overflow-hidden rounded-xl border border-red-500/35 bg-black/70">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3 py-2">
        <div className="flex items-center gap-2">
          {connecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-300" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/85">{connecting ? "Opening your seat" : "Your seat is live"}</span>
          </div>
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
          Leave panel
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
  mutedAll?: boolean;
  autoEnableAudio?: boolean;
}
export type JudgeBroadcastViewerHandle = {
  enableAudio: () => Promise<void>;
};

export const JudgeBroadcastViewer = forwardRef<JudgeBroadcastViewerHandle, JudgeBroadcastViewerProps>(function JudgeBroadcastViewer({ roomName, livekitUrl, viewerToken, judgeName, judgeUserId, mutedAll = false, autoEnableAudio = false }, ref) {

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const remoteVideoTrackRef = useRef<Track | null>(null);
  const remoteAudioTrackRef = useRef<Track | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting" | "ended">("connecting");
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);
  audioUnlockedRef.current = audioUnlocked;

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (cancelled) return;
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        if (remoteVideoTrackRef.current === track) return;
        remoteVideoTrackRef.current?.detach(remoteVideoRef.current);
        track.attach(remoteVideoRef.current);
        remoteVideoTrackRef.current = track;
        setHasVideo(true);
      } else if (track.kind === Track.Kind.Audio) {
        // Attach audio to a dedicated audio element so judge mic is heard
        if (remoteAudioRef.current) {
          if (remoteAudioTrackRef.current === track) return;
          remoteAudioTrackRef.current?.detach(remoteAudioRef.current);
          track.attach(remoteAudioRef.current);
          remoteAudioTrackRef.current = track;
          if (audioUnlockedRef.current) remoteAudioRef.current.play().catch(() => undefined);
        }
        setHasAudio(true);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video && remoteVideoTrackRef.current === track) {
        if (remoteVideoRef.current) remoteVideoTrackRef.current?.detach(remoteVideoRef.current);
        remoteVideoTrackRef.current = null;
        setHasVideo(false);
      }
      if (track.kind === Track.Kind.Audio && remoteAudioTrackRef.current === track) {
        if (remoteAudioRef.current) remoteAudioTrackRef.current?.detach(remoteAudioRef.current);
        remoteAudioTrackRef.current = null;
        setHasAudio(false);
      }
    });

    room.on(RoomEvent.Connected, () => {
      if (!cancelled) { setConnected(true); setConnectionState("connected"); }
    });
    room.on(RoomEvent.Reconnecting, () => {
      if (!cancelled) setConnectionState("reconnecting");
    });
    room.on(RoomEvent.Reconnected, () => {
      if (!cancelled) { setConnected(true); setConnectionState("connected"); }
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) { setConnected(false); setConnectionState("ended"); }
    });

    room.connect(livekitUrl, viewerToken).catch(() => { if (!cancelled) setConnectionState("ended"); });

    return () => {
      cancelled = true;
      if (remoteVideoRef.current) remoteVideoTrackRef.current?.detach(remoteVideoRef.current);
      if (remoteAudioRef.current) remoteAudioTrackRef.current?.detach(remoteAudioRef.current);
      remoteVideoTrackRef.current = null;
      remoteAudioTrackRef.current = null;
      room.disconnect();
    };
  }, [livekitUrl, viewerToken]);

  const enableJudgeAudio = useCallback(async () => {
    try {
      await roomRef.current?.startAudio();
      setAudioUnlocked(true);
      await remoteAudioRef.current?.play();
    } catch {
      toast.error("Click again to enable judge audio");
    }
  }, []);

  useImperativeHandle(ref, () => ({ enableAudio: enableJudgeAudio }), [enableJudgeAudio]);

  useEffect(() => {
    if (autoEnableAudio) void enableJudgeAudio();
  }, [autoEnableAudio, enableJudgeAudio]);

  return (
    <div className="border border-green-500/30 bg-black/40 rounded overflow-hidden">
      {/* Hidden audio element for judge mic; browsers require a user gesture before playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={mutedAll || !audioUnlocked} />
      <div className="relative min-h-36 bg-black" style={{ aspectRatio: JUDGE_PANEL_LAYOUT.tileAspectRatio }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${hasVideo ? "opacity-100" : "opacity-0"}`}
        />
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {connectionState === "reconnecting" ? (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-400 animate-spin mx-auto mb-1" />
                  <div className="text-white/40 text-xs">Reconnecting to judge…</div>
                </>
              ) : connected ? (
                <>
                  <VideoOff className="w-5 h-5 text-white/30 mx-auto mb-1" />
                  <div className="text-white/30 text-xs">Camera off</div>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 text-green-400 animate-spin mx-auto mb-1" />
                  <div className="text-white/40 text-xs">Connecting…</div>
                </>
              )}
            </div>
          </div>
        )}
        {/* Mic indicator overlay */}
        {hasAudio && <div className={`absolute bottom-1 right-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${audioUnlocked && !mutedAll ? "bg-green-600/90 text-white" : "bg-black/80 text-white/55"}`}>{audioUnlocked && !mutedAll ? "Panel sound on" : "Panel sound off"}</div>}
      </div>
      <div className="px-3 py-2 border-t border-green-500/20">
        <div className="flex items-center justify-between">
          <a href={`/profile/${judgeUserId}`} className="text-white/85 text-sm font-semibold hover:text-white truncate">
            {judgeName}
          </a>
          <div className={`text-xs flex items-center gap-1 ${connectionState === "reconnecting" ? "text-yellow-300" : connectionState === "connected" ? "text-green-400" : "text-white/35"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connectionState === "reconnecting" ? "bg-yellow-400 animate-pulse" : connectionState === "connected" ? "bg-green-500 animate-pulse" : "bg-white/25"}`} />
            {connectionState === "reconnecting" ? "Reconnecting" : connectionState === "connected" ? "Live" : "Offline"}
          </div>
        </div>
      </div>
    </div>
  );
});
