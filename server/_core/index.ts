import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { setActivityBroadcaster } from "../activity";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { chatMessages, reviewPlusMemberships } from "../../drizzle/schema";
import { storageGetSignedUrl } from "../storage";
import { getWheelOfNamesEntries, createWheelOfNamesSpin, clearWheelOfNamesEntries, getTodaysWheelOfNamesSpin, updateSubmissionStatus, completeReviewSubmission, setCurrentPlaying, getLiveReviewPlaybackState, setLiveReviewPlaybackState } from "../db";
import { registerStripeWebhook } from "../stripe-webhook";
import { sanitizeChatAvatarUrl } from "../../shared/chat-avatar";
import { shouldProcessReviewTrackEnd } from "../../shared/review-radio-transition";
import { sdk } from "./sdk";
import { and, desc, eq } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

type RoomParticipant = {
  userId?: number;
  username: string;
  role: "admin" | "judge" | "contestant" | "viewer";
  room: string;
  micActive: boolean;
  cameraActive: boolean;
  avatarUrl?: string;
};

// Track audio/video room participants: socketId -> participant
const roomParticipants = new Map<string, RoomParticipant>();

// ─── Radio State (server-side source of truth) ────────────────────────────────
type RadioState = {
  submissionId: number | null;
  artistName: string;
  songTitle: string;
  audioUrl: string | null;       // direct presigned S3 URL (expires ~1hr)
  youtubeUrl: string | null;
  submissionType: string;
  startedAt: number | null;      // Date.now() when track started
  pausedAt: number | null;       // seconds into track when paused (null = playing)
  fileKey: string | null;        // original S3 key for re-signing
  // YouTube timestamp sync: admin broadcasts currentTime every ~2s
  ytCurrentTime: number | null;  // admin's YouTube player currentTime in seconds
  ytState: number | null;        // YouTube player state: -1=unstarted, 1=playing, 2=paused, 3=buffering
  ytUpdatedAt: number | null;    // Date.now() when ytCurrentTime was last updated
};

let radioState: RadioState = {
  submissionId: null,
  artistName: "",
  songTitle: "",
  audioUrl: null,
  youtubeUrl: null,
  submissionType: "file",
  startedAt: null,
  pausedAt: null,
  fileKey: null,
  ytCurrentTime: null,
  ytState: null,
  ytUpdatedAt: null,
};

// Track the last played song so admin can put it back on the deck
let lastRadioState: RadioState | null = null;
let reviewTrackTransitionInFlight: number | null = null;

const emptyRadioState = (): RadioState => ({
  submissionId: null,
  artistName: "",
  songTitle: "",
  audioUrl: null,
  youtubeUrl: null,
  submissionType: "file",
  startedAt: null,
  pausedAt: null,
  fileKey: null,
  ytCurrentTime: null,
  ytState: null,
  ytUpdatedAt: null,
});

function getAuthoritativePlaybackPositionMs(now = Date.now()) {
  if (!radioState.submissionId) return 0;
  if (radioState.pausedAt !== null) return Math.max(0, Math.round(radioState.pausedAt * 1000));
  if (!radioState.startedAt) return 0;
  return Math.max(0, now - radioState.startedAt);
}

async function persistAuthoritativeRadioState() {
  const playbackState = !radioState.submissionId
    ? "stopped"
    : radioState.pausedAt !== null
      ? "paused"
      : "playing";
  await setLiveReviewPlaybackState({
    currentPlayingId: radioState.submissionId,
    playbackState,
    startedAt: radioState.startedAt,
    positionMs: getAuthoritativePlaybackPositionMs(),
  });
}

async function hydrateAuthoritativeRadioState() {
  const persisted = await getLiveReviewPlaybackState();
  const state = persisted?.state;
  const submission = persisted?.submission;
  if (!state?.currentPlayingId || !submission || state.livePlaybackState === "stopped") {
    radioState = emptyRadioState();
    return;
  }

  const fileKey = submission.fileUrl?.replace(/^\/manus-storage\//, "") ?? submission.fileKey ?? null;
  let audioUrl: string | null = null;
  if (submission.submissionType !== "youtube" && fileKey) {
    try { audioUrl = await storageGetSignedUrl(fileKey); } catch { audioUrl = submission.fileUrl ?? null; }
  }
  const storedPositionMs = state.livePlaybackPositionMs ?? 0;
  const startedAt = state.livePlaybackState === "playing"
    ? (state.livePlaybackStartedAt ?? Date.now() - storedPositionMs)
    : state.livePlaybackStartedAt;
  radioState = {
    submissionId: submission.id,
    artistName: submission.artistName,
    songTitle: submission.songTitle,
    audioUrl,
    youtubeUrl: submission.youtubeUrl,
    submissionType: submission.submissionType,
    startedAt,
    pausedAt: state.livePlaybackState === "paused" ? storedPositionMs / 1000 : null,
    fileKey,
    ytCurrentTime: null,
    ytState: null,
    ytUpdatedAt: null,
  };
}

// ─── Music Wars Radio State ────────────────────────────────────────────────────
type WarsRadioTrack = {
  contestantName: string;
  songTitle: string;
  songUrl: string;
  contestantNumber: number; // 1, 2, or 3 (triple threat)
};
type WarsRadioState = {
  tracks: WarsRadioTrack[];
  currentIndex: number;
  startedAt: number | null;
  pausedAt: number | null;
  isPlaying: boolean;
  tripleTheatMode: boolean;
};
let warsRadioState: WarsRadioState = {
  tracks: [],
  currentIndex: 0,
  startedAt: null,
  pausedAt: null,
  isPlaying: false,
  tripleTheatMode: false,
};

// Track the last played Wars Radio track so admin can put it back
let lastWarsRadioState: WarsRadioState | null = null;

// Track which socket is the active admin mic broadcaster per room
// Map<roomName, broadcasterSocketId>
const micBroadcasters = new Map<string, string>();

function getRoomList(room: string) {
  const all = Array.from(roomParticipants.entries())
    .filter(([, p]) => p.room === room)
    .map(([id, p]) => ({ socketId: id, ...p }));

  // Deduplicate by userId: if the same logged-in user has multiple sockets
  // (e.g. useAudioRoom + useAdminMicBroadcast both create a socket), keep only
  // the entry where micActive is true, or the first one if none are active.
  const seen = new Map<number, typeof all[0]>();
  const anonymous: typeof all = [];
  for (const entry of all) {
    if (!entry.userId) {
      anonymous.push(entry);
      continue;
    }
    const existing = seen.get(entry.userId);
    if (!existing) {
      seen.set(entry.userId, entry);
    } else {
      // Prefer the entry that has micActive=true (the audio socket)
      if (entry.micActive && !existing.micActive) {
        seen.set(entry.userId, entry);
      }
    }
  }
  return [...Array.from(seen.values()), ...anonymous];
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Socket.io for real-time chat + WebRTC signaling ──────
  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  (app as any).io = io;
  setActivityBroadcaster((event) => io.emit("activity:new_event", event));

  try {
    await hydrateAuthoritativeRadioState();
  } catch (error) {
    console.error("[radio] Unable to restore the saved Music Review transport state:", error);
  }

  const broadcastAuthoritativeRadioState = () => {
    if (!radioState.submissionId) {
      io.emit("radio:state", null);
      return;
    }
    io.emit("radio:state", {
      ...radioState,
      currentTime: getAuthoritativePlaybackPositionMs() / 1000,
    });
  };

  const broadcastPresence = () => io.emit("presence:count", io.engine.clientsCount);

  io.on("connection", (socket) => {
    const room = socket.handshake.query.room as string;
    broadcastPresence();
    socket.on("disconnect", broadcastPresence);
    const validRooms = ["music_wars", "music_review", "promo_wheel"];
    if (validRooms.includes(room)) {
      socket.join(room);
    }
    if (room === "music_review") {
      void sdk.authenticateRequest(socket.request as any).then((user) => {
        if (!user) return;
        socket.to("music_review").emit("review:participant_joined", {
          userId: user.id,
          username: user.artistName || user.name || "A listener",
          role: user.role === "admin" ? "admin" : user.role === "judge" ? "judge" : "user",
          timestamp: Date.now(),
        });
      }).catch(() => undefined);
    }
    const isAuthoritativeReviewAdmin = async () => {
      const user = await sdk.authenticateRequest(socket.request as any).catch(() => null);
      return user?.role === "admin";
    };

    // ── Chat ──────────────────────────────────────────────────
    socket.on("chat:send", async (data: {
      username: string;
      message: string;
      room: string;
      userId?: number;
      avatarUrl?: string | null;
      isAdmin?: boolean;
      accountLabels?: string[] | null;
      role?: "admin" | "judge" | "contestant" | "user";
    }) => {
      if (!data.message?.trim() || !data.username?.trim()) return;
      if (data.message.length > 500) return;

      const sender = await sdk.authenticateRequest(socket.request as any).catch(() => null);
      if (!sender || sender.id !== data.userId || data.room !== room || !validRooms.includes(data.room)) return;

      const db = await getDb();
      const [membership] = db ? await db.select({
        status: reviewPlusMemberships.status,
        currentPeriodEnd: reviewPlusMemberships.currentPeriodEnd,
        chatAccent: reviewPlusMemberships.chatAccent,
        chatIcon: reviewPlusMemberships.chatIcon,
        chatStyle: reviewPlusMemberships.chatStyle,
      }).from(reviewPlusMemberships).where(and(
        eq(reviewPlusMemberships.userId, sender.id),
        eq(reviewPlusMemberships.status, "active"),
      )).orderBy(desc(reviewPlusMemberships.createdAt)).limit(1) : [];
      const isReviewPlus = data.room === "music_review" && !!membership && (!membership.currentPeriodEnd || membership.currentPeriodEnd.getTime() > Date.now());

      const msg = {
        id: Date.now(),
        username: (sender.artistName || sender.name || data.username).slice(0, 32),
        message: data.message.slice(0, 500),
        room: data.room,
        isAdmin: sender.role === "admin",
        role: sender.role,
        accountLabels: Array.isArray(data.accountLabels) ? data.accountLabels.slice(0, 8) : [],
        userId: sender.id,
        avatarUrl: sanitizeChatAvatarUrl(sender.avatarUrl),
        isReviewPlus,
        chatAccent: isReviewPlus ? membership.chatAccent : null,
        chatIcon: isReviewPlus ? membership.chatIcon : null,
        chatStyle: isReviewPlus ? membership.chatStyle : null,
        createdAt: new Date(),
      };

      try {
        if (db) {
          await db.insert(chatMessages).values({
            userId: sender.id,
            username: msg.username,
            message: msg.message,
            room: data.room as "music_wars" | "music_review",
            isAdmin: msg.isAdmin,
          });
        }
      } catch (e) { /* Non-fatal */ }

      io.to(data.room).emit("chat:message", msg);
    });

    socket.on("review:skip_requested", async (data: { submissionId?: number }) => {
      if (room !== "music_review" || !Number.isInteger(data?.submissionId)) return;
      const requester = await sdk.authenticateRequest(socket.request as any).catch(() => null);
      if (!requester || radioState.submissionId !== data.submissionId) return;
      const event = {
        submissionId: data.submissionId as number,
        songTitle: radioState.songTitle || "the current track",
        requestedBy: requester.artistName || requester.name || "A listener",
        timestamp: Date.now(),
      };
      io.emit("site:review_skip_requested", event);
      io.to("music_review").emit("review:skip_requested", event);
    });

    // ── Wheel events ──────────────────────────────────────────
    socket.on("wheel:spin", () => {
      io.to("music_wars").emit("wheel:spinning");
    });

    socket.on("wheel:result", (data: { winner: string }) => {
      io.to("music_wars").emit("wheel:winner", data);
    });

    // Admin BattlePlayer controls are relayed to every other Music Wars viewer.
    socket.on("wars:battle_playback", (data: {
      action: "play" | "pause" | "seek" | "next" | "previous";
      trackIndex?: number;
      currentTime?: number;
    }) => {
      if (room !== "music_wars") return;
      if (!data || !["play", "pause", "seek", "next", "previous"].includes(data.action)) return;
      socket.to("music_wars").emit("wars:battle_playback", data);
    });

    // Relay spin state changes (contestant 1 picked, reset, etc.)
    socket.on("wheel:spin_state", (data: { spinCount: number; contestant1Id: number | null; contestant1Name: string | null }) => {
      io.to("music_wars").emit("wheel:spin_state", data);
    });

    // ── Audio/Video Room ──────────────────────────────────────
    socket.on("room:join", (data: {
      username: string;
      role: "admin" | "judge" | "contestant" | "viewer";
      userId?: number;
      room: string;
      avatarUrl?: string;
    }) => {
      const participant: RoomParticipant = {
        userId: data.userId,
        username: data.username,
        role: data.role,
        room: data.room,
        // judges and admins start with mic active; others start muted
        micActive: data.role === "judge" || data.role === "admin",
        cameraActive: false,
        avatarUrl: data.avatarUrl,
      };
      roomParticipants.set(socket.id, participant);

      const list = getRoomList(data.room);
      io.to(data.room).emit("room:participants", list);
      // Send existing participants to the new joiner for WebRTC handshake
      socket.emit("room:existing_peers", list.filter(p => p.socketId !== socket.id));
    });

    // Legacy audio:join support (backward compat)
    socket.on("audio:join", (data: {
      username: string;
      role: "admin" | "judge" | "contestant" | "viewer";
      userId?: number;
      room: string;
      avatarUrl?: string;
    }) => {
      const participant: RoomParticipant = {
        userId: data.userId,
        username: data.username,
        role: data.role,
        room: data.room,
        micActive: data.role === "judge" || data.role === "admin",
        cameraActive: false,
        avatarUrl: data.avatarUrl,
      };
      roomParticipants.set(socket.id, participant);
      const list = getRoomList(data.room);
      io.to(data.room).emit("audio:participants", list);
      io.to(data.room).emit("room:participants", list);
      socket.emit("audio:existing_peers", list.filter(p => p.socketId !== socket.id));
      socket.emit("room:existing_peers", list.filter(p => p.socketId !== socket.id));
    });

    // WebRTC signaling: offer/answer/ice-candidate relay (shared for audio + video)
    socket.on("webrtc:offer", (data: { to: string; offer: RTCSessionDescriptionInit; kind?: "audio" | "video" }) => {
      io.to(data.to).emit("webrtc:offer", { from: socket.id, offer: data.offer, kind: data.kind });
    });

    socket.on("webrtc:answer", (data: { to: string; answer: RTCSessionDescriptionInit; kind?: "audio" | "video" }) => {
      io.to(data.to).emit("webrtc:answer", { from: socket.id, answer: data.answer, kind: data.kind });
    });

    socket.on("webrtc:ice_candidate", (data: { to: string; candidate: RTCIceCandidateInit; kind?: "audio" | "video" }) => {
      io.to(data.to).emit("webrtc:ice_candidate", { from: socket.id, candidate: data.candidate, kind: data.kind });
    });

    // ── Mic controls ──────────────────────────────────────────
    // Admin force-toggle a participant's mic
    socket.on("audio:set_mic", (data: { targetSocketId: string; active: boolean }) => {
      const requester = roomParticipants.get(socket.id);
      if (!requester || (requester.role !== "admin" && requester.role !== "judge")) return;
      const target = roomParticipants.get(data.targetSocketId);
      if (target) {
        target.micActive = data.active;
        io.to(data.targetSocketId).emit("audio:mic_toggled", { active: data.active });
        const list = getRoomList(target.room);
        io.to(target.room).emit("audio:participants", list);
        io.to(target.room).emit("room:participants", list);
      }
    });

    // User self-toggles mic (all roles can toggle — even regular users)
    socket.on("audio:toggle_mic", (data: { active: boolean; isMuted?: boolean }) => {
      const participant = roomParticipants.get(socket.id);
      if (!participant) return;
      participant.micActive = data.active;
      const list = getRoomList(participant.room);
      io.to(participant.room).emit("audio:participants", list);
      io.to(participant.room).emit("room:participants", list);
    });
    // Admin kicks a participant from the voice room
    socket.on("audio:kick", (data: { targetSocketId: string }) => {
      const requester = roomParticipants.get(socket.id);
      if (!requester || requester.role !== "admin") return;
      const target = roomParticipants.get(data.targetSocketId);
      if (!target) return;
      const targetRoom = target.room;
      // Notify the kicked user first
      io.to(data.targetSocketId).emit("audio:kicked", { reason: "You were removed from the voice room by the admin." });
      // Remove from participants map
      roomParticipants.delete(data.targetSocketId);
      const list = getRoomList(targetRoom);
      io.to(targetRoom).emit("audio:participants", list);
      io.to(targetRoom).emit("room:participants", list);
      io.to(targetRoom).emit("webrtc:peer_left", { socketId: data.targetSocketId });
    });

    // ── Camera controls ───────────────────────────────────────
    // User toggles their own camera
    socket.on("video:toggle_camera", (data: { active: boolean }) => {
      const participant = roomParticipants.get(socket.id);
      if (!participant) return;
      // Only judges, admins, and contestants can share camera
      if (participant.role === "viewer") return;
      participant.cameraActive = data.active;
      const list = getRoomList(participant.room);
      io.to(participant.room).emit("room:participants", list);
      // If turning on camera, trigger WebRTC renegotiation with all peers
      if (data.active) {
        const peers = list.filter(p => p.socketId !== socket.id);
        socket.emit("video:start_stream", { peers: peers.map(p => p.socketId) });
      } else {
        io.to(participant.room).emit("video:peer_stopped", { socketId: socket.id });
      }
    });

    // Admin force-toggle a participant's camera
    socket.on("video:set_camera", (data: { targetSocketId: string; active: boolean }) => {
      const requester = roomParticipants.get(socket.id);
      if (!requester || requester.role !== "admin") return;
      const target = roomParticipants.get(data.targetSocketId);
      if (target) {
        target.cameraActive = data.active;
        io.to(data.targetSocketId).emit("video:camera_toggled", { active: data.active });
        const list = getRoomList(target.room);
        io.to(target.room).emit("room:participants", list);
      }
    });

    // ── Admin Mic Broadcast (admin mic → all radio listeners) ──────────────
    // Admin starts broadcasting their mic to the radio feed
    socket.on("radio:mic_broadcast_start", () => {
      const participant = roomParticipants.get(socket.id);
      if (!participant || participant.role !== "admin") return;
      // Track the broadcaster socket ID per room
      micBroadcasters.set(participant.room, socket.id);
      // Notify all listeners in the room that admin mic is live
      io.to(participant.room).emit("radio:mic_broadcast_active", { broadcasterSocketId: socket.id });
      console.log(`[radio:mic_broadcast_start] Admin mic active in room: ${participant.room}`);
    });

    // Admin stops broadcasting their mic
    socket.on("radio:mic_broadcast_stop", () => {
      const participant = roomParticipants.get(socket.id);
      if (!participant) return;
      if (micBroadcasters.get(participant.room) === socket.id) {
        micBroadcasters.delete(participant.room);
        io.to(participant.room).emit("radio:mic_broadcast_inactive");
        console.log(`[radio:mic_broadcast_stop] Admin mic stopped in room: ${participant.room}`);
      }
    });

    // Relay WebRTC offer from admin broadcaster to a specific listener
    socket.on("radio:mic_offer", (data: { to: string; offer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit("radio:mic_offer", { from: socket.id, offer: data.offer });
    });

    // Relay WebRTC answer from listener back to admin broadcaster
    socket.on("radio:mic_answer", (data: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit("radio:mic_answer", { from: socket.id, answer: data.answer });
    });

    // Relay ICE candidates between admin and listeners
    socket.on("radio:mic_ice", (data: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.to).emit("radio:mic_ice", { from: socket.id, candidate: data.candidate });
    });

    // Listener signals to the admin broadcaster that they are ready to receive
    socket.on("radio:mic_listener_ready", (data: { broadcasterSocketId: string; listenerSocketId: string }) => {
      // Relay to the admin broadcaster so they can send an offer
      io.to(data.broadcasterSocketId).emit("radio:mic_listener_ready", { listenerSocketId: socket.id });
    });

    // Listener joins the radio room and requests current mic broadcast state
    socket.on("radio:mic_get_state", (data: { room: string }) => {
      const broadcasterSocketId = micBroadcasters.get(data.room);
      if (broadcasterSocketId) {
        // Tell the listener who the broadcaster is so they can initiate WebRTC
        socket.emit("radio:mic_broadcast_active", { broadcasterSocketId });
      } else {
        socket.emit("radio:mic_broadcast_inactive");
      }
    });

    // ── Live Radio Controls (admin → ALL viewers site-wide) ──────────────
    // Admin loads a track: server resolves presigned URL, broadcasts to everyone
    socket.on("radio:load", async (data: {
      submissionId: number | null;
      artistName?: string;
      songTitle?: string;
      fileKey?: string | null;
      fileUrl?: string | null;   // /manus-storage/ path — we resolve it here
      youtubeUrl?: string | null;
      submissionType?: string;
    }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      if (data.submissionId === null) {
        // Admin cleared the deck — also reset any playing songs in DB
        radioState = emptyRadioState();
        await persistAuthoritativeRadioState();
        try { await setCurrentPlaying(null); } catch (e) { /* non-fatal */ }
        io.emit("radio:stopped");
        io.emit("live:now_playing", null);
        return;
      }

      // Resolve presigned S3 URL server-side so all clients get a direct URL
      // IMPORTANT: fileUrl has the correct hash-suffixed key (e.g. queue-submissions/song_a1b2c3d4.mp3)
      // fileKey may be the original key without hash — always prefer fileUrl for key extraction
      let resolvedAudioUrl: string | null = null;
      const key = data.fileUrl?.replace(/^\/manus-storage\//, "") ?? data.fileKey ?? null;
      if (key && data.submissionType !== "youtube") {
        try {
          resolvedAudioUrl = await storageGetSignedUrl(key);
          console.log("[radio:load] Resolved presigned URL for key:", key);
        } catch (e) {
          console.error("[radio:load] Failed to resolve presigned URL for key:", key, e);
          // Fall back to /manus-storage/ path — client will try to handle it
          resolvedAudioUrl = data.fileUrl ?? null;
        }
      }

      // Save current state as last before overwriting
      if (radioState.submissionId) lastRadioState = { ...radioState };

      // Sync DB status: reset any previously-playing submission to 'pending',
      // then mark the new one as 'playing'. This ensures only one song ever
      // shows the LIVE badge in the queue, regardless of which button was used.
      try {
        await updateSubmissionStatus(data.submissionId, "playing");
        await setCurrentPlaying(data.submissionId);
      } catch (e) {
        console.error("[radio:load] Failed to update DB status:", e);
      }

      radioState = {
        submissionId: data.submissionId,
        artistName: data.artistName ?? "Unknown Artist",
        songTitle: data.songTitle ?? "Live Review",
        audioUrl: resolvedAudioUrl,
        youtubeUrl: data.youtubeUrl ?? null,
        submissionType: data.submissionType ?? "file",
        startedAt: Date.now(),
        pausedAt: null,
        fileKey: key,
        ytCurrentTime: null,
        ytState: null,
        ytUpdatedAt: null,
      };

      await persistAuthoritativeRadioState();
      broadcastAuthoritativeRadioState();

      const broadcast = { ...radioState };
      // Broadcast to music_review room (for the review page UI)
      io.to("music_review").emit("radio:playing", broadcast);
      // Broadcast site-wide so FloatingPlayer on ALL pages auto-plays
      io.emit("live:now_playing", {
        submissionId: broadcast.submissionId,
        artistName: broadcast.artistName,
        songTitle: broadcast.songTitle,
        audioUrl: broadcast.audioUrl,
        youtubeUrl: broadcast.youtubeUrl,
        submissionType: broadcast.submissionType,
        startedAt: broadcast.startedAt,
      });
    });

    // Admin pause/resume/seek — broadcast to all
    socket.on("radio:pause", async (data: { currentTime: number }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      if (!radioState.submissionId) return;
      radioState.pausedAt = data.currentTime;
      await persistAuthoritativeRadioState();
      broadcastAuthoritativeRadioState();
      io.emit("radio:paused", { pausedAt: data.currentTime });
    });

    socket.on("radio:resume", async (data: { currentTime: number }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      if (!radioState.submissionId) return;
      // Recalculate startedAt so late joiners can sync
      radioState.startedAt = Date.now() - data.currentTime * 1000;
      radioState.pausedAt = null;
      await persistAuthoritativeRadioState();
      broadcastAuthoritativeRadioState();
      io.emit("radio:resumed", { startedAt: radioState.startedAt });
    });

    socket.on("radio:seek", async (data: { currentTime: number }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      if (!radioState.submissionId) return;
      radioState.startedAt = Date.now() - data.currentTime * 1000;
      radioState.pausedAt = radioState.pausedAt !== null ? data.currentTime : null;
      await persistAuthoritativeRadioState();
      broadcastAuthoritativeRadioState();
      io.emit("radio:seeked", { currentTime: data.currentTime, startedAt: radioState.startedAt });
    });

    // Track ended — auto-advance to next pending track in queue
    socket.on("radio:track_ended", async (data?: { submissionId?: number }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      const completedId = radioState.submissionId;
      if (completedId === null) return;
      if (!shouldProcessReviewTrackEnd(completedId, data?.submissionId, reviewTrackTransitionInFlight)) return;
      reviewTrackTransitionInFlight = completedId;
      try {
        const db = await getDb();
        if (!db) return;
        // Import needed for query
        const { reviewSubmissions } = await import("../../drizzle/schema");
        const { eq, ne, asc, desc, and } = await import("drizzle-orm");
        // Mark current track as reviewed
        await completeReviewSubmission(completedId);
        // Find next pending track
        const pending = await db.select().from(reviewSubmissions)
          .where(and(eq(reviewSubmissions.status, "pending"), ne(reviewSubmissions.id, completedId)))
          .orderBy(desc(reviewSubmissions.skipPaymentConfirmed), asc(reviewSubmissions.position), asc(reviewSubmissions.createdAt))
          .limit(1);
        if (pending.length > 0) {
          const next = pending[0];
          // Keep the database queue cursor and status aligned with the live
          // transport so refreshes and late joins resolve the same track.
          await updateSubmissionStatus(next.id, "playing");
          await setCurrentPlaying(next.id);
          // Resolve presigned URL
          const key = next.fileUrl?.replace(/^\/manus-storage\//, "") ?? next.fileKey ?? null;
          let resolvedUrl: string | null = null;
          if (key && next.submissionType !== "youtube") {
            try { resolvedUrl = await storageGetSignedUrl(key); } catch (e) { resolvedUrl = next.fileUrl; }
          }
          radioState = {
            submissionId: next.id,
            artistName: next.artistName,
            songTitle: next.songTitle,
            audioUrl: resolvedUrl,
            youtubeUrl: next.youtubeUrl,
            submissionType: next.submissionType,
            startedAt: Date.now(),
            pausedAt: null,
            fileKey: key,
            ytCurrentTime: null,
            ytState: null,
            ytUpdatedAt: null,
          };
          await persistAuthoritativeRadioState();
          broadcastAuthoritativeRadioState();
          io.to("music_review").emit("radio:playing", { ...radioState });
          io.emit("live:now_playing", {
            submissionId: radioState.submissionId,
            artistName: radioState.artistName,
            songTitle: radioState.songTitle,
            audioUrl: radioState.audioUrl,
            youtubeUrl: radioState.youtubeUrl,
            submissionType: radioState.submissionType,
            startedAt: radioState.startedAt,
          });
          // Notify queue updated
          io.to("music_review").emit("review:queue_updated");
          console.log("[radio:track_ended] Auto-advanced to:", next.songTitle);
        } else {
          // No more tracks — stop radio
          await setCurrentPlaying(null);
          radioState = emptyRadioState();
          await persistAuthoritativeRadioState();
          broadcastAuthoritativeRadioState();
          io.emit("radio:stopped");
          io.emit("live:now_playing", null);
          io.to("music_review").emit("review:queue_updated");
          console.log("[radio:track_ended] Queue empty — radio stopped");
        }
      } catch (err) {
        console.error("[radio:track_ended] Error:", err);
      } finally {
        reviewTrackTransitionInFlight = null;
      }
    });

    // Admin broadcasts YouTube player currentTime every ~2s for viewer sync
    socket.on("youtube:tick", async (data: { submissionId: number; currentTime: number; state: number }) => {
      if (!await isAuthoritativeReviewAdmin()) return;
      // Only accept ticks for the currently playing submission
      if (data.submissionId !== radioState.submissionId) return;
      radioState.ytCurrentTime = data.currentTime;
      radioState.ytState = data.state;
      radioState.ytUpdatedAt = Date.now();
      // The server owns the durable transport clock even for embedded YouTube playback.
      if (data.state === 2) {
        radioState.pausedAt = data.currentTime;
      } else if (data.state === 1) {
        radioState.startedAt = radioState.ytUpdatedAt - data.currentTime * 1000;
        radioState.pausedAt = null;
      }
      await persistAuthoritativeRadioState();
      broadcastAuthoritativeRadioState();
      // Broadcast to all viewers (excluding the admin sender)
      socket.broadcast.emit("youtube:tick", {
        submissionId: data.submissionId,
        currentTime: data.currentTime,
        state: data.state,
        updatedAt: radioState.ytUpdatedAt,
      });
    });

    // Late-joining viewer requests current radio state
    socket.on("radio:get_state", async () => {
      if (!radioState.submissionId) {
        try { await hydrateAuthoritativeRadioState(); } catch (error) { console.error("[radio] Failed to hydrate state for late listener:", error); }
      }
      if (!radioState.submissionId) {
        socket.emit("radio:state", null);
        return;
      }
      // Calculate current position
      const currentTime = getAuthoritativePlaybackPositionMs() / 1000;
      // Include YouTube timestamp for late joiners
      socket.emit("radio:state", {
        ...radioState,
        currentTime,
        ytCurrentTime: radioState.ytCurrentTime,
        ytState: radioState.ytState,
        ytUpdatedAt: radioState.ytUpdatedAt,
      });
    });

    // Admin: put last played song back on the deck
    socket.on("radio:last_song", async () => {
      if (!await isAuthoritativeReviewAdmin()) return;
      if (!lastRadioState || !lastRadioState.submissionId) {
        socket.emit("radio:error", { message: "No previous song to restore" });
        return;
      }
      try {
        const db = await getDb();
        if (!db) return;
        const { reviewSubmissions } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        // Restore the submission to pending so it appears in the queue
        await db.update(reviewSubmissions)
          .set({ status: "pending" })
          .where(eq(reviewSubmissions.id, lastRadioState.submissionId));
        // Notify queue updated so admin sees it back in the queue
        io.to("music_review").emit("review:queue_updated");
        // Emit the last song info back to admin so they can load it
        socket.emit("radio:last_song_restored", {
          submissionId: lastRadioState.submissionId,
          artistName: lastRadioState.artistName,
          songTitle: lastRadioState.songTitle,
          fileKey: lastRadioState.fileKey,
        });
        console.log("[radio:last_song] Restored:", lastRadioState.songTitle);
      } catch (err) {
        console.error("[radio:last_song] Error:", err);
      }
    });

    // Legacy review:set_active support (backward compat)
    socket.on("review:set_active", async (data: {
      submissionId: number | null;
      artistName?: string;
      songTitle?: string;
      audioUrl?: string | null;
      youtubeUrl?: string | null;
      submissionType?: string;
      fileKey?: string | null;
    }) => {
      // Forward to radio:load handler logic
      socket.emit("radio:load", data);
    });

    // Admin broadcasts playback state (play/pause/seek) — legacy compat
    socket.on("review:playback", (data: { action: "play" | "pause" | "replay" | "skip" | "next"; currentTime?: number }) => {
      io.to("music_review").emit("review:playback", data);
    });
    // Admin broadcasts queue update (new submission, status change)
    socket.on("review:queue_updated", () => {
      io.to("music_review").emit("review:queue_updated");
    });
    // Broadcast reaction/vote changes to all clients in the room
    socket.on("review:reactions_updated", (data: { submissionId: number }) => {
      io.to("music_review").emit("review:reactions_updated", data);
    });

    // ── Review: Fake chat message relay (admin → all viewers) ──
    // Admin emits a fake chat message; server relays it to all OTHER viewers
    socket.on("review:fake_chat_message", (data: {
      username: string;
      text: string;
      userId?: number | null;
      timestamp: number;
    }) => {
      socket.to("music_review").emit("review:fake_chat_message", data);
    });

    // ── Review: Chat controls relay (admin → all viewers) ──────
    // Admin changes bot, speed, sentiment, and ghost vote settings; relay to viewers
    socket.on("review:chat_controls", async (data: {
      botEnabled?: boolean;
      botFrequency?: "low" | "normal" | "high";
      commentIntervalMs?: number;
      sentimentBias?: number;
      ghostFireIntervalSec?: number;
      ghostTrashIntervalSec?: number;
    }) => {
      const sender = await sdk.authenticateRequest(socket.request as any).catch(() => null);
      if (!sender || sender.role !== "admin") return;
      socket.to("music_review").emit("review:chat_controls", data);
    });

    // ── Review: Reaction trigger relay (admin → all viewers) ──
    // Admin triggers a reaction flood; relay to all viewers so their fake chat floods too
    socket.on("review:trigger_reaction", (data: { reaction: string; duration: number }) => {
      socket.to("music_review").emit("review:trigger_reaction", data);
    });

    // ── Music Wars Radio Events ─────────────────────────────────
    // Admin loads battle tracks (auto-called when battle is set)
    socket.on("wars_radio:load", (data: { tracks: WarsRadioTrack[] }) => {
      // Save previous state so admin can restore it
      if (warsRadioState.tracks.length > 0) lastWarsRadioState = { ...warsRadioState };
      warsRadioState = {
        tracks: data.tracks,
        currentIndex: 0,
        startedAt: Date.now(),
        pausedAt: null,
        isPlaying: true,
        tripleTheatMode: data.tracks.length > 2,
      };
      // Broadcast to music_wars room for UI updates
      io.to("music_wars").emit("wars_radio:playing", { ...warsRadioState });
      // Broadcast site-wide so FloatingPlayer on all pages auto-plays
      if (warsRadioState.tracks.length > 0) {
        const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
        io.emit("wars:now_playing", {
          url: currentTrack.songUrl,
          title: currentTrack.songTitle,
          artist: currentTrack.contestantName,
          startedAt: warsRadioState.startedAt,
        });
      }
    });

    socket.on("wars_radio:pause", (data: { currentTime: number }) => {
      warsRadioState.pausedAt = data.currentTime;
      warsRadioState.isPlaying = false;
      io.to("music_wars").emit("wars_radio:paused", { pausedAt: data.currentTime });
      io.emit("wars:paused", { pausedAt: data.currentTime });
    });

    socket.on("wars_radio:resume", (data: { currentTime: number }) => {
      warsRadioState.startedAt = Date.now() - data.currentTime * 1000;
      warsRadioState.pausedAt = null;
      warsRadioState.isPlaying = true;
      io.to("music_wars").emit("wars_radio:resumed", { startedAt: warsRadioState.startedAt });
      io.emit("wars:resumed", { startedAt: warsRadioState.startedAt });
    });

    socket.on("wars_radio:seek", (data: { currentTime: number }) => {
      warsRadioState.startedAt = Date.now() - data.currentTime * 1000;
      if (warsRadioState.pausedAt !== null) warsRadioState.pausedAt = data.currentTime;
      io.to("music_wars").emit("wars_radio:seeked", { currentTime: data.currentTime, startedAt: warsRadioState.startedAt });
      io.emit("wars:seeked", { currentTime: data.currentTime, startedAt: warsRadioState.startedAt });
    });

    socket.on("wars_radio:skip", () => {
      // Advance to next track in the battle playlist
      if (warsRadioState.currentIndex < warsRadioState.tracks.length - 1) {
        warsRadioState.currentIndex++;
        warsRadioState.startedAt = Date.now();
        warsRadioState.pausedAt = null;
        warsRadioState.isPlaying = true;
        io.to("music_wars").emit("wars_radio:playing", { ...warsRadioState });
        // Broadcast new track site-wide
        const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
        io.emit("wars:now_playing", {
          url: currentTrack.songUrl,
          title: currentTrack.songTitle,
          artist: currentTrack.contestantName,
          startedAt: warsRadioState.startedAt,
        });
      } else {
        // All tracks played
        warsRadioState.isPlaying = false;
        io.to("music_wars").emit("wars_radio:ended");
        io.emit("wars:stopped");
      }
    });

    socket.on("wars_radio:track_ended", () => {
      // Auto-advance to next contestant's track
      if (warsRadioState.currentIndex < warsRadioState.tracks.length - 1) {
        warsRadioState.currentIndex++;
        warsRadioState.startedAt = Date.now();
        warsRadioState.pausedAt = null;
        warsRadioState.isPlaying = true;
        io.to("music_wars").emit("wars_radio:playing", { ...warsRadioState });
        // Broadcast new track site-wide
        const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
        io.emit("wars:now_playing", {
          url: currentTrack.songUrl,
          title: currentTrack.songTitle,
          artist: currentTrack.contestantName,
          startedAt: warsRadioState.startedAt,
        });
      } else {
        // All tracks played — battle audio complete
        warsRadioState.isPlaying = false;
        io.to("music_wars").emit("wars_radio:ended");
        io.emit("wars:stopped");
      }
    });

    socket.on("wars_radio:stop", () => {
      warsRadioState = { tracks: [], currentIndex: 0, startedAt: null, pausedAt: null, isPlaying: false, tripleTheatMode: false };
      io.to("music_wars").emit("wars_radio:stopped");
      io.emit("wars:stopped");
    });

    socket.on("wars_radio:set_triple_threat", (data: { enabled: boolean }) => {
      warsRadioState.tripleTheatMode = data.enabled;
      io.to("music_wars").emit("wars_radio:triple_threat", { enabled: data.enabled });
    });

    // Late-joiner gets current wars radio state
    socket.on("wars_radio:get_state", () => {
      if (!warsRadioState.isPlaying && warsRadioState.tracks.length === 0) {
        socket.emit("wars_radio:state", null);
        return;
      }
      let currentTime = 0;
      if (warsRadioState.pausedAt !== null) {
        currentTime = warsRadioState.pausedAt;
      } else if (warsRadioState.startedAt) {
        currentTime = (Date.now() - warsRadioState.startedAt) / 1000;
      }
      socket.emit("wars_radio:state", { ...warsRadioState, currentTime });
    });

    // Admin: restore last Wars Radio state
    socket.on("wars_radio:last_song", () => {
      if (!lastWarsRadioState || lastWarsRadioState.tracks.length === 0) {
        socket.emit("wars_radio:error", { message: "No previous Wars Radio state to restore" });
        return;
      }
      // Restore the previous state and replay from the beginning
      warsRadioState = {
        ...lastWarsRadioState,
        startedAt: Date.now(),
        pausedAt: null,
        isPlaying: true,
      };
      io.to("music_wars").emit("wars_radio:playing", { ...warsRadioState });
      if (warsRadioState.tracks.length > 0) {
        const currentTrack = warsRadioState.tracks[warsRadioState.currentIndex];
        io.emit("wars:now_playing", {
          url: currentTrack.songUrl,
          title: currentTrack.songTitle,
          artist: currentTrack.contestantName,
          startedAt: warsRadioState.startedAt,
        });
      }
      socket.emit("wars_radio:last_song_restored", {
        tracks: warsRadioState.tracks,
        tripleTheatMode: warsRadioState.tripleTheatMode,
      });
      console.log("[wars_radio:last_song] Restored:", warsRadioState.tracks.map(t => t.songTitle).join(", "));
    });

    // ── Leave / disconnect ────────────────────────────────────
    const handleLeave = () => {
      const participant = roomParticipants.get(socket.id);
      if (participant) {
        roomParticipants.delete(socket.id);
        // If this socket was the admin mic broadcaster, stop the broadcast
        if (micBroadcasters.get(participant.room) === socket.id) {
          micBroadcasters.delete(participant.room);
          io.to(participant.room).emit("radio:mic_broadcast_inactive");
        }
        const list = getRoomList(participant.room);
        io.to(participant.room).emit("audio:participants", list);
        io.to(participant.room).emit("room:participants", list);
        io.to(participant.room).emit("webrtc:peer_left", { socketId: socket.id });
        io.to(participant.room).emit("video:peer_stopped", { socketId: socket.id });
      }
    };

    socket.on("audio:leave", handleLeave);
    socket.on("room:leave", handleLeave);
    socket.on("disconnect", handleLeave);
  });

  // MUST register Stripe webhook BEFORE express.json() for raw body signature verification
  registerStripeWebhook(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  // ── Daily Wheel Auto-Spin (Heartbeat cron at 7pm daily) ──────
  app.post("/api/scheduled/daily-wheel-spin", async (req, res) => {
    try {
      // Verify this is a cron call via the x-manus-cron-task-uid header
      const cronTaskUid = req.headers["x-manus-cron-task-uid"];
      if (!cronTaskUid) {
        return res.status(403).json({ error: "cron-only endpoint" });
      }
      const today = new Date().toISOString().split('T')[0];
      // Skip if admin already manually spun today
      const existingSpin = await getTodaysWheelOfNamesSpin();
      if (existingSpin) {
        return res.json({ ok: true, skipped: "already spun today", winner: existingSpin.winnerName, timestamp: new Date().toISOString() });
      }
      const entries = await getWheelOfNamesEntries();
      if (entries.length === 0) {
        return res.json({ ok: true, skipped: "no entries", timestamp: new Date().toISOString() });
      }
      const winner = entries[Math.floor(Math.random() * entries.length)];
      const winnerIndex = entries.findIndex(e => e.id === winner.id);
      await createWheelOfNamesSpin(today, winner.userId || null, winner.name);
      await clearWheelOfNamesEntries();
      // Broadcast live spin to all viewers watching the promo wheel
      try {
        const SPIN_DURATION = 9000;
        io.to("promo_wheel").emit("wof:spin_start", {
          winnerIndex,
          names: entries.map(e => e.name),
          duration: SPIN_DURATION,
        });
        setTimeout(() => {
          io.to("promo_wheel").emit("wof:spin_result", { winnerName: winner.name });
        }, SPIN_DURATION + 500);
      } catch {}
      // Notify owner
      try {
        const { notifyOwner } = await import('./notification');
        await notifyOwner({ title: 'Daily Wheel Auto-Spun!', content: `Today's winner is: ${winner.name}` });
      } catch {}
      return res.json({ ok: true, winner: winner.name, timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('[daily-wheel-spin] Error:', err);
      return res.status(500).json({ error: err?.message ?? 'Unknown error', timestamp: new Date().toISOString() });
    }
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
