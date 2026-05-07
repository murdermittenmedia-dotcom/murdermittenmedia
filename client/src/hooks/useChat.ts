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

export interface WheelSpinState {
  spinCount: 0 | 1;
  contestant1Id: number | null;
  contestant1Name: string | null;
}

export interface LiveReviewActiveItem {
  submissionId: number | null;
  artistName?: string;
  songTitle?: string;
  audioUrl?: string | null;
  youtubeUrl?: string | null;
  submissionType?: string;
}

export interface LiveReviewPlayback {
  action: "play" | "pause" | "replay" | "skip" | "next";
  currentTime?: number;
}

interface UseChatOptions {
  room: "music_wars" | "music_review";
  username: string;
  userId?: number;
  isAdmin?: boolean;
  initialMessages?: ChatMessage[];
  onSpinStateChange?: (state: WheelSpinState) => void;
  onReviewActiveChanged?: (item: LiveReviewActiveItem) => void;
  onReviewPlayback?: (data: LiveReviewPlayback) => void;
  onReviewQueueUpdated?: () => void;
}

export function useChat({
  room,
  username,
  userId,
  isAdmin,
  initialMessages = [],
  onSpinStateChange,
  onReviewActiveChanged,
  onReviewPlayback,
  onReviewQueueUpdated,
}: UseChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onSpinStateRef = useRef(onSpinStateChange);
  onSpinStateRef.current = onSpinStateChange;
  const onReviewActiveRef = useRef(onReviewActiveChanged);
  onReviewActiveRef.current = onReviewActiveChanged;
  const onReviewPlaybackRef = useRef(onReviewPlayback);
  onReviewPlaybackRef.current = onReviewPlayback;
  const onReviewQueueUpdatedRef = useRef(onReviewQueueUpdated);
  onReviewQueueUpdatedRef.current = onReviewQueueUpdated;

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

    // Live spin state sync (contestant 1 picked, reset, etc.)
    socket.on("wheel:spin_state", (data: WheelSpinState) => {
      onSpinStateRef.current?.(data);
    });

    // Live Review events
    socket.on("review:active_changed", (data: LiveReviewActiveItem) => {
      onReviewActiveRef.current?.(data);
    });
    socket.on("review:playback", (data: LiveReviewPlayback) => {
      onReviewPlaybackRef.current?.(data);
    });
    socket.on("review:queue_updated", () => {
      onReviewQueueUpdatedRef.current?.();
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

  // Admin: set the active live review item
  const broadcastReviewActive = useCallback((data: LiveReviewActiveItem) => {
    socketRef.current?.emit("review:set_active", data);
  }, []);

  // Admin: broadcast playback control
  const broadcastReviewPlayback = useCallback((data: LiveReviewPlayback) => {
    socketRef.current?.emit("review:playback", data);
  }, []);

  // Admin: notify all clients that the queue has been updated
  const broadcastReviewQueueUpdated = useCallback(() => {
    socketRef.current?.emit("review:queue_updated");
  }, []);

  return {
    messages,
    isConnected,
    sendMessage,
    wheelWinner,
    wheelSpinning,
    broadcastSpin,
    broadcastWinner,
    broadcastReviewActive,
    broadcastReviewPlayback,
    broadcastReviewQueueUpdated,
    socket: socketRef.current,
  };
}
