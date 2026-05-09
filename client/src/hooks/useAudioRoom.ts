import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type AudioRole = "admin" | "judge" | "contestant" | "user" | "viewer";

export interface AudioParticipant {
  socketId: string;
  username: string;
  role: AudioRole;
  micActive: boolean;
  isSpeaking: boolean;   // voice activity detected
  isMuted: boolean;      // intentionally muted by self or admin
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [participants, setParticipants] = useState<AudioParticipant[]>([]);
  // All users start muted by default — must press Talk button to activate mic
  const [micActive, setMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [wasKicked, setWasKicked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Voice chat mix volume (0–1) — applied to all remote audio elements
  const [voiceVolume, setVoiceVolumeState] = useState(0.8);
  const voiceVolumeRef = useRef(0.8);

  // Voice activity detection using Web Audio API
  const startVAD = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      vadIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 12; // threshold — adjust if too sensitive
        setIsSpeaking(prev => {
          if (prev !== speaking) {
            socketRef.current?.emit("audio:speaking", { speaking });
          }
          return speaking;
        });
      }, 100);
    } catch {
      // VAD not critical — silently fail
    }
  }, []);

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    analyserRef.current = null;
    setIsSpeaking(false);
  }, []);

  const createPeerConnection = useCallback((targetSocketId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      let audio = audioElementsRef.current.get(targetSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElementsRef.current.set(targetSocketId, audio);
      }
      audio.srcObject = event.streams[0];
      // Apply current voice volume to this new audio element
      audio.volume = voiceVolumeRef.current;
    };

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
    stopVAD();
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
  }, [stopVAD]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const init = async () => {
      try {
        // All non-viewers get mic access (judges/admins start unmuted, others start muted)
        if (role !== "viewer") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
          const startEnabled = role === "judge" || role === "admin";
          stream.getAudioTracks().forEach(t => { t.enabled = startEnabled; });
          if (startEnabled) startVAD(stream);
        }

        const socket = io(window.location.origin, {
          path: "/api/socket.io",
          query: { room },
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!mounted) return;
          setIsConnected(true);
          socket.emit("audio:join", {
            username,
            role,
            userId,
            room,
            isMuted: !(role === "judge" || role === "admin"),
          });
        });

        // Admin kicked this user from the room
        socket.on("audio:kicked", ({ reason }: { reason: string }) => {
          if (!mounted) return;
          setWasKicked(true);
          setIsConnected(false);
          setParticipants([]);
          cleanup();
          alert(reason);
        });

        socket.on("audio:participants", (list: AudioParticipant[]) => {
          if (!mounted) return;
          setParticipants(list);
        });

        socket.on("audio:existing_peers", (peers: AudioParticipant[]) => {
          peers.forEach(peer => {
            if (!peersRef.current.has(peer.socketId)) {
              createPeerConnection(peer.socketId, true);
            }
          });
        });

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

        // Admin toggled our mic (forced mute/unmute)
        socket.on("audio:mic_toggled", ({ active }: { active: boolean }) => {
          if (!mounted) return;
          setMicActive(active);
          setIsMuted(!active);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = active; });
          }
          if (active && localStreamRef.current) startVAD(localStreamRef.current);
          else stopVAD();
        });

        // Another participant's speaking state changed
        socket.on("audio:participant_speaking", ({ socketId, speaking }: { socketId: string; speaking: boolean }) => {
          if (!mounted) return;
          setParticipants(prev => prev.map(p =>
            p.socketId === socketId ? { ...p, isSpeaking: speaking } : p
          ));
        });

        // Another participant's mute state changed
        socket.on("audio:participant_muted", ({ socketId, isMuted: muted }: { socketId: string; isMuted: boolean }) => {
          if (!mounted) return;
          setParticipants(prev => prev.map(p =>
            p.socketId === socketId ? { ...p, isMuted: muted, micActive: !muted } : p
          ));
        });

        socket.on("disconnect", () => {
          if (mounted) setIsConnected(false);
        });

      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to access microphone");
      }
    };

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [enabled, room, username, role, userId, createPeerConnection, cleanup, startVAD, stopVAD]);

  // Self-mute/unmute — available to ALL roles that have mic access
  const toggleMic = useCallback(() => {
    if (role === "viewer") return; // pure viewers have no mic
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicActive(!newMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    }
    if (!newMuted && localStreamRef.current) startVAD(localStreamRef.current);
    else stopVAD();
    socketRef.current?.emit("audio:toggle_mic", { active: !newMuted, isMuted: newMuted });
  }, [isMuted, role, startVAD, stopVAD]);

  // Admin force-mute or unmute any participant by their socket ID
  const adminToggleParticipantMic = useCallback((targetSocketId: string, active: boolean) => {
    socketRef.current?.emit("audio:set_mic", { targetSocketId, active });
  }, []);

  // Admin kick a participant from the voice room
  const kickParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit("audio:kick", { targetSocketId });
  }, []);

  // Legacy name kept for backward compat
  const activateContestantMic = adminToggleParticipantMic;

  /** Set the voice chat mix volume (0–1) for all remote audio streams */
  const setVoiceVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    voiceVolumeRef.current = clamped;
    setVoiceVolumeState(clamped);
    // Apply immediately to all active audio elements
    audioElementsRef.current.forEach(audio => {
      audio.volume = clamped;
    });
  }, []);

  return {
    participants,
    micActive,
    isMuted,
    isSpeaking,
    isConnected,
    error,
    wasKicked,
    voiceVolume,
    setVoiceVolume,
    toggleMic,
    activateContestantMic,
    adminToggleParticipantMic,
    kickParticipant,
    socket: socketRef.current,
  };
}
