import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { chatMessages } from "../../drizzle/schema";
import { storageGetSignedUrl } from "../storage";

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
};

function getRoomList(room: string) {
  return Array.from(roomParticipants.entries())
    .filter(([, p]) => p.room === room)
    .map(([id, p]) => ({ socketId: id, ...p }));
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

  io.on("connection", (socket) => {
    const room = socket.handshake.query.room as string;
    const validRooms = ["music_wars", "music_review"];
    if (validRooms.includes(room)) {
      socket.join(room);
    }

    // ── Chat ──────────────────────────────────────────────────
    socket.on("chat:send", async (data: {
      username: string;
      message: string;
      room: string;
      userId?: number;
      isAdmin?: boolean;
    }) => {
      if (!data.message?.trim() || !data.username?.trim()) return;
      if (data.message.length > 500) return;

      const msg = {
        id: Date.now(),
        username: data.username.slice(0, 32),
        message: data.message.slice(0, 500),
        room: data.room,
        isAdmin: data.isAdmin || false,
        createdAt: new Date(),
      };

      try {
        const db = await getDb();
        if (db) {
          await db.insert(chatMessages).values({
            userId: data.userId || null,
            username: msg.username,
            message: msg.message,
            room: data.room as "music_wars" | "music_review",
            isAdmin: msg.isAdmin,
          });
        }
      } catch (e) { /* Non-fatal */ }

      io.to(data.room).emit("chat:message", msg);
    });

    // ── Wheel events ──────────────────────────────────────────
    socket.on("wheel:spin", () => {
      io.to("music_wars").emit("wheel:spinning");
    });

    socket.on("wheel:result", (data: { winner: string }) => {
      io.to("music_wars").emit("wheel:winner", data);
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

    // ── Live Radio Controls (admin → ALL viewers site-wide) ─────
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
      if (data.submissionId === null) {
        // Admin cleared the deck
        radioState = { submissionId: null, artistName: "", songTitle: "", audioUrl: null, youtubeUrl: null, submissionType: "file", startedAt: null, pausedAt: null, fileKey: null };
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
      };

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
    socket.on("radio:pause", (data: { currentTime: number }) => {
      radioState.pausedAt = data.currentTime;
      io.emit("radio:paused", { pausedAt: data.currentTime });
    });

    socket.on("radio:resume", (data: { currentTime: number }) => {
      // Recalculate startedAt so late joiners can sync
      radioState.startedAt = Date.now() - data.currentTime * 1000;
      radioState.pausedAt = null;
      io.emit("radio:resumed", { startedAt: radioState.startedAt });
    });

    socket.on("radio:seek", (data: { currentTime: number }) => {
      radioState.startedAt = Date.now() - data.currentTime * 1000;
      radioState.pausedAt = radioState.pausedAt !== null ? data.currentTime : null;
      io.emit("radio:seeked", { currentTime: data.currentTime, startedAt: radioState.startedAt });
    });

    // Track ended — auto-advance to next pending track in queue
    socket.on("radio:track_ended", async () => {
      if (!radioState.submissionId) return;
      try {
        const db = await getDb();
        if (!db) return;
        // Import needed for query
        const { reviewSubmissions } = await import("../../drizzle/schema");
        const { eq, ne, asc, and } = await import("drizzle-orm");
        // Mark current track as reviewed
        await db.update(reviewSubmissions).set({ status: "reviewed" }).where(eq(reviewSubmissions.id, radioState.submissionId));
        // Find next pending track
        const pending = await db.select().from(reviewSubmissions)
          .where(and(eq(reviewSubmissions.status, "pending"), ne(reviewSubmissions.id, radioState.submissionId)))
          .orderBy(asc(reviewSubmissions.createdAt))
          .limit(1);
        if (pending.length > 0) {
          const next = pending[0];
          // Set it as playing in DB
          await db.update(reviewSubmissions).set({ status: "playing" }).where(eq(reviewSubmissions.id, next.id));
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
          };
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
          radioState = { submissionId: null, artistName: "", songTitle: "", audioUrl: null, youtubeUrl: null, submissionType: "file", startedAt: null, pausedAt: null, fileKey: null };
          io.emit("radio:stopped");
          io.emit("live:now_playing", null);
          io.to("music_review").emit("review:queue_updated");
          console.log("[radio:track_ended] Queue empty — radio stopped");
        }
      } catch (err) {
        console.error("[radio:track_ended] Error:", err);
      }
    });

    // Late-joining viewer requests current radio state
    socket.on("radio:get_state", () => {
      if (!radioState.submissionId) {
        socket.emit("radio:state", null);
        return;
      }
      // Calculate current position
      let currentTime = 0;
      if (radioState.pausedAt !== null) {
        currentTime = radioState.pausedAt;
      } else if (radioState.startedAt) {
        currentTime = (Date.now() - radioState.startedAt) / 1000;
      }
      socket.emit("radio:state", { ...radioState, currentTime });
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

    // ── Leave / disconnect ────────────────────────────────────
    const handleLeave = () => {
      const participant = roomParticipants.get(socket.id);
      if (participant) {
        roomParticipants.delete(socket.id);
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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

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
