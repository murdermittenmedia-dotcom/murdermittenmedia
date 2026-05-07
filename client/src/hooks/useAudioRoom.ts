import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type AudioRole = "admin" | "judge" | "contestant" | "viewer";

export interface AudioParticipant {
  socketId: string;
  username: string;
  role: AudioRole;
  micActive: boolean;
  userId?: number;
}

interface UseAudioRoomOptions {
  room: "music_wars" | "music_review";
  username: string;
  role: AudioRole;
  userId?: number;
  enabled: boolean;
}

export function useAudioRoom({ room, username, role, userId, enabled }: UseAudioRoomOptions) {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [participants, setParticipants] = useState<AudioParticipant[]>([]);
  const [micActive, setMicActive] = useState(role === "judge" || role === "admin");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPeerConnection = useCallback((targetSocketId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming audio
    pc.ontrack = (event) => {
      let audio = audioElementsRef.current.get(targetSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElementsRef.current.set(targetSocketId, audio);
      }
      audio.srcObject = event.streams[0];
    };

    // ICE candidate relay
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc:ice_candidate", {
          to: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    peersRef.current.set(targetSocketId, pc);

    if (initiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socketRef.current?.emit("webrtc:offer", { to: targetSocketId, offer });
      });
    }

    return pc;
  }, []);

  const cleanup = useCallback(() => {
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    audioElementsRef.current.forEach(audio => { audio.srcObject = null; });
    audioElementsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
    setParticipants([]);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const init = async () => {
      try {
        // Get microphone access for judges/admins/contestants
        if (role !== "viewer") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
          // Start muted unless judge/admin
          stream.getAudioTracks().forEach(t => {
            t.enabled = role === "judge" || role === "admin";
          });
        }

        const socket = io(window.location.origin, {
          path: "/api/socket.io",
          query: { room },
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!mounted) return;
          setIsConnected(true);
          socket.emit("audio:join", { username, role, userId, room });
        });

        socket.on("audio:participants", (list: AudioParticipant[]) => {
          if (!mounted) return;
          setParticipants(list);
        });

        // Existing peers — we initiate connections to them
        socket.on("audio:existing_peers", (peers: AudioParticipant[]) => {
          peers.forEach(peer => {
            if (!peersRef.current.has(peer.socketId)) {
              createPeerConnection(peer.socketId, true);
            }
          });
        });

        // New peer joined — they will initiate, we wait for offer
        socket.on("webrtc:offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
          let pc = peersRef.current.get(from);
          if (!pc) pc = createPeerConnection(from, false);
          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc:answer", { to: from, answer });
        });

        socket.on("webrtc:answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
          const pc = peersRef.current.get(from);
          if (pc) await pc.setRemoteDescription(answer);
        });

        socket.on("webrtc:ice_candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
          const pc = peersRef.current.get(from);
          if (pc) await pc.addIceCandidate(candidate);
        });

        socket.on("webrtc:peer_left", ({ socketId }: { socketId: string }) => {
          const pc = peersRef.current.get(socketId);
          if (pc) { pc.close(); peersRef.current.delete(socketId); }
          const audio = audioElementsRef.current.get(socketId);
          if (audio) { audio.srcObject = null; audioElementsRef.current.delete(socketId); }
        });

        // Admin toggled our mic
        socket.on("audio:mic_toggled", ({ active }: { active: boolean }) => {
          if (!mounted) return;
          setMicActive(active);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = active; });
          }
        });

        socket.on("disconnect", () => {
          if (mounted) setIsConnected(false);
        });

      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to access microphone");
      }
    };

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, room, username, role, userId, createPeerConnection, cleanup]);

  const toggleMic = useCallback(() => {
    if (role !== "judge" && role !== "admin") return; // only judges/admins can self-toggle
    const newState = !micActive;
    setMicActive(newState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = newState; });
    }
    socketRef.current?.emit("audio:toggle_mic", { active: newState });
  }, [micActive, role]);

  const activateContestantMic = useCallback((targetSocketId: string, active: boolean) => {
    socketRef.current?.emit("audio:set_mic", { targetSocketId, active });
  }, []);

  return {
    participants,
    micActive,
    isConnected,
    error,
    toggleMic,
    activateContestantMic,
    socket: socketRef.current,
  };
}
