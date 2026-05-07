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

// Track audio room participants: socketId -> { userId, username, role, room }
const audioRoomParticipants = new Map<string, {
  userId?: number;
  username: string;
  role: "admin" | "judge" | "contestant" | "viewer";
  room: string;
  micActive: boolean;
}>();

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

    // ── Audio Battle Room ─────────────────────────────────────
    socket.on("audio:join", (data: {
      username: string;
      role: "admin" | "judge" | "contestant" | "viewer";
      userId?: number;
      room: string;
    }) => {
      const participant = {
        userId: data.userId,
        username: data.username,
        role: data.role,
        room: data.room,
        // judges and admins start with mic active; others start muted
        micActive: data.role === "judge" || data.role === "admin",
      };
      audioRoomParticipants.set(socket.id, participant);

      // Broadcast updated participant list to room
      const roomParticipants = Array.from(audioRoomParticipants.entries())
        .filter(([, p]) => p.room === data.room)
        .map(([id, p]) => ({ socketId: id, ...p }));

      io.to(data.room).emit("audio:participants", roomParticipants);

      // Send existing participants to the new joiner for WebRTC handshake
      socket.emit("audio:existing_peers", roomParticipants.filter(p => p.socketId !== socket.id));
    });

    // WebRTC signaling: offer/answer/ice-candidate relay
    socket.on("webrtc:offer", (data: { to: string; offer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit("webrtc:offer", { from: socket.id, offer: data.offer });
    });

    socket.on("webrtc:answer", (data: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(data.to).emit("webrtc:answer", { from: socket.id, answer: data.answer });
    });

    socket.on("webrtc:ice_candidate", (data: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.to).emit("webrtc:ice_candidate", { from: socket.id, candidate: data.candidate });
    });

    // Admin activates/deactivates a contestant's mic
    socket.on("audio:set_mic", (data: { targetSocketId: string; active: boolean }) => {
      const requester = audioRoomParticipants.get(socket.id);
      if (!requester || (requester.role !== "admin" && requester.role !== "judge")) return;

      const target = audioRoomParticipants.get(data.targetSocketId);
      if (target) {
        target.micActive = data.active;
        // Notify the target that their mic was toggled
        io.to(data.targetSocketId).emit("audio:mic_toggled", { active: data.active });
        // Broadcast updated participant list
        const roomParticipants = Array.from(audioRoomParticipants.entries())
          .filter(([, p]) => p.room === target.room)
          .map(([id, p]) => ({ socketId: id, ...p }));
        io.to(target.room).emit("audio:participants", roomParticipants);
      }
    });

    // User toggles their own mic (only if they have permission)
    socket.on("audio:toggle_mic", (data: { active: boolean }) => {
      const participant = audioRoomParticipants.get(socket.id);
      if (!participant) return;
      // Only judges and admins can self-toggle; contestants need admin approval
      if (participant.role === "judge" || participant.role === "admin") {
        participant.micActive = data.active;
        const roomParticipants = Array.from(audioRoomParticipants.entries())
          .filter(([, p]) => p.room === participant.room)
          .map(([id, p]) => ({ socketId: id, ...p }));
        io.to(participant.room).emit("audio:participants", roomParticipants);
      }
    });

    socket.on("audio:leave", () => {
      const participant = audioRoomParticipants.get(socket.id);
      if (participant) {
        audioRoomParticipants.delete(socket.id);
        const roomParticipants = Array.from(audioRoomParticipants.entries())
          .filter(([, p]) => p.room === participant.room)
          .map(([id, p]) => ({ socketId: id, ...p }));
        io.to(participant.room).emit("audio:participants", roomParticipants);
        io.to(participant.room).emit("webrtc:peer_left", { socketId: socket.id });
      }
    });

    socket.on("disconnect", () => {
      const participant = audioRoomParticipants.get(socket.id);
      if (participant) {
        audioRoomParticipants.delete(socket.id);
        const roomParticipants = Array.from(audioRoomParticipants.entries())
          .filter(([, p]) => p.room === participant.room)
          .map(([id, p]) => ({ socketId: id, ...p }));
        io.to(participant.room).emit("audio:participants", roomParticipants);
        io.to(participant.room).emit("webrtc:peer_left", { socketId: socket.id });
      }
    });
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
