/**
 * useAdminMicBroadcast
 *
 * Enables the admin to broadcast their microphone audio to all radio listeners
 * using a one-to-many WebRTC pattern:
 *
 * Admin side:
 *   - Captures mic via getUserMedia
 *   - Signals `radio:mic_broadcast_start` to server
 *   - Creates a WebRTC PeerConnection for each new listener that connects
 *   - Sends mic audio track to each listener
 *
 * Listener side:
 *   - Connects to the same socket room
 *   - Receives `radio:mic_broadcast_active` when admin starts broadcasting
 *   - Creates a WebRTC PeerConnection to the admin broadcaster
 *   - Receives the mic audio stream and plays it via an <audio> element
 *
 * Usage:
 *   const { isBroadcasting, isAdminMicLive, toggleBroadcast, adminMicVolume, setAdminMicVolume }
 *     = useAdminMicBroadcast({ room: "music_review", isAdmin, socketRef })
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
  /** Username of the admin — needed so the server registers them as a room participant */
  username?: string;
  /** User ID of the admin */
  userId?: number;
}

export function useAdminMicBroadcast({ room, isAdmin, enabled = true, username = "Admin", userId }: UseAdminMicBroadcastOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Admin state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Map of listener socketId → RTCPeerConnection (admin side)
  const listenerPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Listener state
  const [isAdminMicLive, setIsAdminMicLive] = useState(false);
  const [broadcasterSocketId, setBroadcasterSocketId] = useState<string | null>(null);
  const adminAudioRef = useRef<HTMLAudioElement | null>(null);
  const listenerPcRef = useRef<RTCPeerConnection | null>(null);
  const [adminMicVolume, setAdminMicVolume] = useState(0.9);

  // ── Create admin→listener peer connection ──────────────────────────────
  const createListenerPeer = useCallback((listenerSocketId: string, micStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add mic tracks to the peer connection
    micStream.getAudioTracks().forEach(track => {
      pc.addTrack(track, micStream);
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
      // This is required for radio:mic_broadcast_start to work (server checks participant.role === "admin")
      socket.emit("room:join", {
        username,
        role: isAdmin ? "admin" : "viewer",
        userId,
        room,
      });
      // Request current broadcast state on connect
      socket.emit("radio:mic_get_state", { room });
    });

    // ── Admin side: a new listener wants to receive the broadcast ──────────
    socket.on("radio:mic_broadcast_active", (data: { broadcasterSocketId: string }) => {
      if (isAdmin) {
        // Another admin connected — ignore (we are the broadcaster)
        return;
      }
      // Listener: admin mic is live, initiate WebRTC connection to broadcaster
      setIsAdminMicLive(true);
      setBroadcasterSocketId(data.broadcasterSocketId);
    });

    socket.on("radio:mic_broadcast_inactive", () => {
      setIsAdminMicLive(false);
      setBroadcasterSocketId(null);
      // Clean up listener peer connection
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

      // Create or reuse peer connection to the broadcaster
      if (listenerPcRef.current) {
        listenerPcRef.current.close();
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      listenerPcRef.current = pc;

      pc.ontrack = (event) => {
        // Play the admin's mic audio
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
    // When a new listener connects and we're broadcasting, they'll receive
    // radio:mic_broadcast_active and send us a request to get an offer.
    // We handle this by listening for a "radio:mic_listener_ready" event.
    socket.on("radio:mic_listener_ready", ({ listenerSocketId }: { listenerSocketId: string }) => {
      if (!isAdmin || !isBroadcasting || !micStreamRef.current) return;
      createListenerPeer(listenerSocketId, micStreamRef.current);
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

  // ── Admin: start/stop broadcasting ─────────────────────────────────────
  const startBroadcast = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      setIsBroadcasting(true);

      // Tell server we're broadcasting
      socketRef.current?.emit("radio:mic_broadcast_start");

      // The server will notify all current listeners via radio:mic_broadcast_active.
      // Each listener will then send radio:mic_listener_ready back to us,
      // and we'll create peer connections for each.
    } catch (err) {
      console.error("[AdminMicBroadcast] Failed to get mic:", err);
      throw err;
    }
  }, [isAdmin]);

  const stopBroadcast = useCallback(() => {
    if (!isAdmin) return;

    // Stop mic tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

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
  // When isAdminMicLive becomes true (from radio:mic_broadcast_active),
  // tell the admin we're ready so they can send us an offer.
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
