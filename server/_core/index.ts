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

    // User self-toggles mic
    socket.on("audio:toggle_mic", (data: { active: boolean; isMuted?: boolean }) => {
      const participant = roomParticipants.get(socket.id);
      if (!participant) return;
      if (participant.role === "judge" || participant.role === "admin" || participant.role === "contestant") {
        participant.micActive = data.active;
        const list = getRoomList(participant.room);
        io.to(participant.room).emit("audio:participants", list);
        io.to(participant.room).emit("room:participants", list);
      }
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
