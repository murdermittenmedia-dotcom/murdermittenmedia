/**
 * useAdminMicBroadcast
 *
 * Enables the admin to broadcast their microphone audio MIXED with the music
 * into a single WebRTC stream for all radio listeners.
 *
 * Architecture:
 * - Admin side: captures mic via getUserMedia, routes both mic and the music
 *   HTMLAudioElement through Web Audio API (AudioContext), mixes them into a
 *   single MediaStream via MediaStreamDestination, then sends that combined
 *   stream to each listener via WebRTC peer connections.
 * - Listener side: receives the combined stream and plays it through an <audio>
 *   element. The listener hears both music + admin mic as one stream.
 *
 * The music continues playing through the admin's local speakers normally —
 * the Web Audio API capture doesn't interrupt playback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface UseAdminMicBroadcastOptions {
  room: "music_review" | "music_wars";
  isAdmin: boolean;
  enabled?: boolean;
  username?: string;
  userId?: number;
  /** Function to get the music HTMLAudioElement for mixing */
  getAudioElement?: () => HTMLAudioElement | null;
}

export function useAdminMicBroadcast({
  room,
  isAdmin,
  enabled = true,
  username = "Admin",
  userId,
  getAudioElement,
}: UseAdminMicBroadcastOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Admin state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  // Map of listener socketId → RTCPeerConnection (admin side)
  const listenerPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Listener state
  const [isAdminMicLive, setIsAdminMicLive] = useState(false);
  const [broadcasterSocketId, setBroadcasterSocketId] = useState<string | null>(null);
  const adminAudioRef = useRef<HTMLAudioElement | null>(null);
  const listenerPcRef = useRef<RTCPeerConnection | null>(null);
  const [adminMicVolume, setAdminMicVolume] = useState(0.9);

  // ── Create admin→listener peer connection ──────────────────────────────
  const createListenerPeer = useCallback((listenerSocketId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add the mixed stream tracks to the peer connection
    stream.getAudioTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("radio:mic_ice", {
          to: listenerSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("radio:mic_offer", {
          to: listenerSocketId,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error("[AdminMicBroadcast] offer creation failed:", err);
      }
    };

    listenerPeersRef.current.set(listenerSocketId, pc);
    return pc;
  }, []);

  // ── Connect to socket and set up signaling ──────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const socket: Socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Register as a participant so the server knows our role
      socket.emit("room:join", {
        username,
        role: isAdmin ? "admin" : "viewer",
        userId,
        room,
      });
      // Request current broadcast state on connect
      socket.emit("radio:mic_get_state", { room });
    });

    // ── Listener side: admin mic is live ──────────────────────────────────
    socket.on("radio:mic_broadcast_active", (data: { broadcasterSocketId: string }) => {
      if (isAdmin) return; // We are the broadcaster
      setIsAdminMicLive(true);
      setBroadcasterSocketId(data.broadcasterSocketId);
    });

    socket.on("radio:mic_broadcast_inactive", () => {
      setIsAdminMicLive(false);
      setBroadcasterSocketId(null);
      if (listenerPcRef.current) {
        listenerPcRef.current.close();
        listenerPcRef.current = null;
      }
      if (adminAudioRef.current) {
        adminAudioRef.current.srcObject = null;
      }
    });

    // ── Admin side: receive answer from a listener ─────────────────────────
    socket.on("radio:mic_answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (!isAdmin) return;
      const pc = listenerPeersRef.current.get(from);
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(answer).catch(console.error);
      }
    });

    // ── Listener side: receive offer from admin broadcaster ────────────────
    socket.on("radio:mic_offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (isAdmin) return;

      if (listenerPcRef.current) {
        listenerPcRef.current.close();
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      listenerPcRef.current = pc;

      pc.ontrack = (event) => {
        // Play the combined (music + mic) stream
        if (!adminAudioRef.current) {
          adminAudioRef.current = new Audio();
          adminAudioRef.current.autoplay = true;
        }
        adminAudioRef.current.srcObject = event.streams[0];
        adminAudioRef.current.volume = adminMicVolume;
        adminAudioRef.current.play().catch(() => {
          // Autoplay blocked — will play on next user interaction
        });
        setIsAdminMicLive(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("radio:mic_ice", { to: from, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsAdminMicLive(false);
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("radio:mic_answer", { to: from, answer: pc.localDescription });
    });

    // ── Both sides: relay ICE candidates ──────────────────────────────────
    socket.on("radio:mic_ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (isAdmin) {
        const pc = listenerPeersRef.current.get(from);
        if (pc) await pc.addIceCandidate(candidate).catch(console.error);
      } else {
        if (listenerPcRef.current) {
          await listenerPcRef.current.addIceCandidate(candidate).catch(console.error);
        }
      }
    });

    // ── Admin side: new listener joined while broadcasting ─────────────────
    socket.on("radio:mic_listener_ready", ({ listenerSocketId }: { listenerSocketId: string }) => {
      if (!isAdmin || !mixedStreamRef.current) return;
      createListenerPeer(listenerSocketId, mixedStreamRef.current);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, room, isAdmin, createListenerPeer]);

  // Update admin audio volume when it changes
  useEffect(() => {
    if (adminAudioRef.current) {
      adminAudioRef.current.volume = adminMicVolume;
    }
  }, [adminMicVolume]);

  // ── Admin: create mixed stream (mic + music) using Web Audio API ────────
  const createMixedStream = useCallback(async (): Promise<MediaStream> => {
    // Get mic stream
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStreamRef.current = micStream;

    // Create AudioContext for mixing
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    // Create a destination node that produces a MediaStream
    const destination = ctx.createMediaStreamDestination();

    // Source 1: Microphone
    const micSource = ctx.createMediaStreamSource(micStream);
    const micGain = ctx.createGain();
    micGain.gain.value = 1.0; // Full mic volume
    micSource.connect(micGain);
    micGain.connect(destination);

    // Source 2: Music (from the audio player element)
    // Use captureStream() instead of createMediaElementSource() to avoid
    // disconnecting the audio element from its default output.
    // captureStream() creates a copy of the audio output as a MediaStream
    // WITHOUT affecting the original playback — admin still hears music normally.
    const audioEl = getAudioElement?.();
    if (audioEl) {
      try {
        // captureStream() is available on HTMLMediaElement in modern browsers
        const capturedStream = (audioEl as any).captureStream?.() || (audioEl as any).mozCaptureStream?.();
        if (capturedStream && capturedStream.getAudioTracks().length > 0) {
          const musicSource = ctx.createMediaStreamSource(capturedStream);
          const musicGain = ctx.createGain();
          musicGain.gain.value = 1.0; // Full music volume in the mix
          musicSource.connect(musicGain);
          musicGain.connect(destination);
        } else {
          console.warn("[AdminMicBroadcast] captureStream() returned no audio tracks");
        }
      } catch (err) {
        console.warn("[AdminMicBroadcast] Could not capture music stream:", err);
        // Fallback: just broadcast mic only
      }
    }

    const mixed = destination.stream;
    mixedStreamRef.current = mixed;
    return mixed;
  }, [getAudioElement]);

  // ── Admin: start/stop broadcasting ─────────────────────────────────────
  const startBroadcast = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const stream = await createMixedStream();
      setIsBroadcasting(true);

      // Tell server we're broadcasting
      socketRef.current?.emit("radio:mic_broadcast_start");

      // The server will notify all current listeners via radio:mic_broadcast_active.
      // Each listener will then send radio:mic_listener_ready back to us,
      // and we'll create peer connections for each.
      // Also create peers for any listeners already connected
      // (they'll receive the broadcast_active event and send listener_ready)
      void stream; // stream is stored in mixedStreamRef
    } catch (err) {
      console.error("[AdminMicBroadcast] Failed to start broadcast:", err);
      throw err;
    }
  }, [isAdmin, createMixedStream]);

  const stopBroadcast = useCallback(() => {
    if (!isAdmin) return;

    // Stop mic tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Clear mixed stream
    mixedStreamRef.current = null;

    // Close all listener peer connections
    listenerPeersRef.current.forEach(pc => pc.close());
    listenerPeersRef.current.clear();

    setIsBroadcasting(false);
    socketRef.current?.emit("radio:mic_broadcast_stop");
  }, [isAdmin]);

  const toggleBroadcast = useCallback(async () => {
    if (isBroadcasting) {
      stopBroadcast();
    } else {
      await startBroadcast();
    }
  }, [isBroadcasting, startBroadcast, stopBroadcast]);

  // ── Listener: signal to admin that we're ready to receive ──────────────
  useEffect(() => {
    if (!isAdminMicLive || isAdmin || !broadcasterSocketId || !socketRef.current) return;
    socketRef.current.emit("radio:mic_listener_ready", {
      broadcasterSocketId,
      listenerSocketId: socketRef.current.id,
    });
  }, [isAdminMicLive, isAdmin, broadcasterSocketId]);

  return {
    // Admin
    isBroadcasting,
    toggleBroadcast,
    startBroadcast,
    stopBroadcast,
    // Listener
    isAdminMicLive,
    adminMicVolume,
    setAdminMicVolume,
  };
}
