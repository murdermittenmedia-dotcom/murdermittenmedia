import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: number;
  username: string;
  message: string;
  room: string;
  isAdmin: boolean;
  createdAt: Date;
}

interface UseChatOptions {
  room: "music_wars" | "music_review";
  username: string;
  userId?: number;
  isAdmin?: boolean;
  initialMessages?: ChatMessage[];
}

export function useChat({ room, username, userId, isAdmin, initialMessages = [] }: UseChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room },
    });
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("chat:message", (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-199), msg]);
    });

    socket.on("wheel:spinning", () => {
      setWheelSpinning(true);
      setWheelWinner(null);
    });

    socket.on("wheel:winner", ({ winner }: { winner: string }) => {
      setWheelSpinning(false);
      setWheelWinner(winner);
    });

    // War reset: clear winner and spinning state for all clients
    socket.on("war:reset", () => {
      setWheelSpinning(false);
      setWheelWinner(null);
    });

    return () => {
      socket.disconnect();
    };
  }, [room]);

  const sendMessage = useCallback((message: string) => {
    if (!message.trim() || !socketRef.current) return;
    socketRef.current.emit("chat:send", {
      username,
      message: message.trim(),
      room,
      userId,
      isAdmin: isAdmin || false,
    });
  }, [username, room, userId, isAdmin]);

  const broadcastSpin = useCallback(() => {
    socketRef.current?.emit("wheel:spin");
  }, []);

  const broadcastWinner = useCallback((winner: string) => {
    socketRef.current?.emit("wheel:result", { winner });
  }, []);

  return {
    messages,
    isConnected,
    sendMessage,
    wheelWinner,
    wheelSpinning,
    broadcastSpin,
    broadcastWinner,
    socket: socketRef.current,
  };
}
