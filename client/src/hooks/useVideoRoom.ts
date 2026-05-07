/**
 * useVideoRoom — WebRTC video room hook
 *
 * Handles camera capture + peer-to-peer video streaming via socket.io signaling.
 * Works alongside useAudioRoom (shares the same socket connection concept but
 * manages separate RTCPeerConnections for video tracks).
 *
 * Usage:
 *   const { localVideoRef, remoteStreams, cameraActive, toggleCamera, participants } = useVideoRoom({
 *     enabled: true,
 *     room: "music_review",
 *     username: "DJ Mitten",
 *     role: "admin",
 *     userId: 1,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type VideoParticipant = {
  socketId: string;
  username: string;
  role: "admin" | "judge" | "contestant" | "viewer";
  userId?: number;
  cameraActive: boolean;
  micActive: boolean;
  avatarUrl?: string;
};

export type RemoteStream = {
  socketId: string;
  username: string;
  role: string;
  stream: MediaStream;
  avatarUrl?: string;
};

type UseVideoRoomOptions = {
  enabled: boolean;
  room: string;
  username: string;
  role: "admin" | "judge" | "contestant" | "viewer";
  userId?: number;
  avatarUrl?: string;
};

export function useVideoRoom({
  enabled,
  room,
  username,
  role,
  userId,
  avatarUrl,
}: UseVideoRoomOptions) {
  const [participants, setParticipants] = useState<VideoParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeerConnection = useCallback((targetSocketId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Add local video track if we have one
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("webrtc:ice_candidate", {
          to: targetSocketId,
          candidate: event.candidate,
          kind: "video",
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      const participant = participants.find(p => p.socketId === targetSocketId);
      setRemoteStreams(prev => {
        const existing = prev.find(s => s.socketId === targetSocketId);
        if (existing) {
          return prev.map(s => s.socketId === targetSocketId ? { ...s, stream } : s);
        }
        return [...prev, {
          socketId: targetSocketId,
          username: participant?.username ?? "Unknown",
          role: participant?.role ?? "viewer",
          stream,
          avatarUrl: participant?.avatarUrl,
        }];
      });
    };

    peersRef.current.set(targetSocketId, pc);

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit("webrtc:offer", {
            to: targetSocketId,
            offer: pc.localDescription,
            kind: "video",
          });
        } catch (e) {
          console.error("[VideoRoom] Offer error:", e);
        }
      };
    }

    return pc;
  }, [participants]);

  const cleanup = useCallback(() => {
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    socketRef.current?.emit("room:leave");
    socketRef.current?.disconnect();
    socketRef.current = null;
    setRemoteStreams([]);
    setCameraActive(false);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (!mounted) return;
      setIsConnected(true);
      socket.emit("room:join", { username, role, userId, room, avatarUrl });
    });

    socket.on("room:participants", (list: VideoParticipant[]) => {
      if (!mounted) return;
      setParticipants(list);
    });

    socket.on("room:existing_peers", (peers: VideoParticipant[]) => {
      if (!mounted) return;
      // Only connect to peers who have camera active
      peers.filter(p => p.cameraActive).forEach(peer => {
        if (!peersRef.current.has(peer.socketId)) {
          createPeerConnection(peer.socketId, true);
        }
      });
    });

    socket.on("video:start_stream", ({ peers }: { peers: string[] }) => {
      if (!mounted) return;
      // A peer turned on their camera — connect to them
      peers.forEach(socketId => {
        if (!peersRef.current.has(socketId)) {
          createPeerConnection(socketId, false);
        }
      });
    });

    socket.on("webrtc:offer", async ({ from, offer, kind }: { from: string; offer: RTCSessionDescriptionInit; kind?: string }) => {
      if (kind && kind !== "video") return;
      let pc = peersRef.current.get(from);
      if (!pc) pc = createPeerConnection(from, false);
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { to: from, answer, kind: "video" });
      } catch (e) {
        console.error("[VideoRoom] Answer error:", e);
      }
    });

    socket.on("webrtc:answer", async ({ from, answer, kind }: { from: string; answer: RTCSessionDescriptionInit; kind?: string }) => {
      if (kind && kind !== "video") return;
      const pc = peersRef.current.get(from);
      if (pc) await pc.setRemoteDescription(answer);
    });

    socket.on("webrtc:ice_candidate", async ({ from, candidate, kind }: { from: string; candidate: RTCIceCandidateInit; kind?: string }) => {
      if (kind && kind !== "video") return;
      const pc = peersRef.current.get(from);
      if (pc) await pc.addIceCandidate(candidate);
    });

    socket.on("webrtc:peer_left", ({ socketId }: { socketId: string }) => {
      const pc = peersRef.current.get(socketId);
      if (pc) { pc.close(); peersRef.current.delete(socketId); }
      setRemoteStreams(prev => prev.filter(s => s.socketId !== socketId));
    });

    socket.on("video:peer_stopped", ({ socketId }: { socketId: string }) => {
      setRemoteStreams(prev => prev.filter(s => s.socketId !== socketId));
    });

    socket.on("video:camera_toggled", ({ active }: { active: boolean }) => {
      if (!mounted) return;
      if (!active && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCameraActive(false);
      }
    });

    socket.on("disconnect", () => {
      if (mounted) setIsConnected(false);
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, room, username, role, userId, avatarUrl, createPeerConnection, cleanup]);

  const toggleCamera = useCallback(async () => {
    if (role === "viewer") return;

    if (cameraActive) {
      // Turn off camera
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCameraActive(false);
      socketRef.current?.emit("video:toggle_camera", { active: false });
      // Close all peer connections (they'll re-establish if needed)
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    } else {
      // Turn on camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false, // Audio is handled by useAudioRoom
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local preview to avoid echo
        }
        setCameraActive(true);
        socketRef.current?.emit("video:toggle_camera", { active: true });

        // Connect to all participants who also have camera active
        participants
          .filter(p => p.cameraActive && p.socketId !== socketRef.current?.id)
          .forEach(peer => {
            if (!peersRef.current.has(peer.socketId)) {
              createPeerConnection(peer.socketId, true);
            } else {
              // Renegotiate existing connection to add video track
              const pc = peersRef.current.get(peer.socketId)!;
              stream.getTracks().forEach(track => pc.addTrack(track, stream));
            }
          });
      } catch (err) {
        setError("Camera access denied. Please allow camera permissions.");
        console.error("[VideoRoom] Camera error:", err);
      }
    }
  }, [cameraActive, role, participants, createPeerConnection]);

  const adminToggleParticipantCamera = useCallback((targetSocketId: string, active: boolean) => {
    socketRef.current?.emit("video:set_camera", { targetSocketId, active });
  }, []);

  return {
    participants,
    remoteStreams,
    cameraActive,
    isConnected,
    error,
    localVideoRef,
    toggleCamera,
    adminToggleParticipantCamera,
    socket: socketRef.current,
  };
}
