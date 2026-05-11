import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: number;
  username: string;
  message: string;
  room: string;
  isAdmin: boolean;
  accountLabel?: string | null;
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
  fileKey?: string | null;
  fileUrl?: string | null;
}

export interface LiveReviewPlayback {
  action: "play" | "pause" | "replay" | "skip" | "next";
  currentTime?: number;
}

export interface LastSongRestoredData {
  submissionId: number;
  artistName: string;
  songTitle: string;
  fileKey: string | null;
}

interface UseChatOptions {
  room: "music_wars" | "music_review";
  username: string;
  userId?: number;
  isAdmin?: boolean;
  accountLabel?: string | null;
  initialMessages?: ChatMessage[];
  onSpinStateChange?: (state: WheelSpinState) => void;
  onReviewActiveChanged?: (item: LiveReviewActiveItem) => void;
  onReviewPlayback?: (data: LiveReviewPlayback) => void;
  onReviewQueueUpdated?: () => void;
  onLastSongRestored?: (data: LastSongRestoredData) => void;
}

export function useChat({
  room,
  username,
  userId,
  isAdmin,
  accountLabel,
  initialMessages = [],
  onSpinStateChange,
  onReviewActiveChanged,
  onReviewPlayback,
  onReviewQueueUpdated,
  onLastSongRestored,
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
  const onLastSongRestoredRef = useRef(onLastSongRestored);
  onLastSongRestoredRef.current = onLastSongRestored;

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

    // Live Review events (legacy compat)
    socket.on("review:active_changed", (data: LiveReviewActiveItem) => {
      onReviewActiveRef.current?.(data);
    });
    socket.on("review:playback", (data: LiveReviewPlayback) => {
      onReviewPlaybackRef.current?.(data);
    });
    socket.on("review:queue_updated", () => {
      onReviewQueueUpdatedRef.current?.();
    });
    // New radio events (review page listens for these too)
    socket.on("radio:playing", (data: LiveReviewActiveItem) => {
      onReviewActiveRef.current?.(data);
    });
    socket.on("radio:stopped", () => {
      onReviewActiveRef.current?.({ submissionId: null });
    });

    // Admin: last song restored to queue
    socket.on("radio:last_song_restored", (data: LastSongRestoredData) => {
      onLastSongRestoredRef.current?.(data);
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
      accountLabel: accountLabel ?? null,
    });
  }, [username, room, userId, isAdmin, accountLabel]);

  const broadcastSpin = useCallback(() => {
    socketRef.current?.emit("wheel:spin");
  }, []);

  const broadcastWinner = useCallback((winner: string) => {
    socketRef.current?.emit("wheel:result", { winner });
  }, []);

  // Admin: load a track on the radio (server resolves presigned URL)
  const broadcastReviewActive = useCallback((data: LiveReviewActiveItem) => {
    // Emit radio:load so server resolves presigned URL before broadcasting to all clients
    socketRef.current?.emit("radio:load", data);
  }, []);

  // Admin: radio pause
  const broadcastRadioPause = useCallback((currentTime: number) => {
    socketRef.current?.emit("radio:pause", { currentTime });
  }, []);

  // Admin: radio resume
  const broadcastRadioResume = useCallback((currentTime: number) => {
    socketRef.current?.emit("radio:resume", { currentTime });
  }, []);

  // Admin: radio seek
  const broadcastRadioSeek = useCallback((currentTime: number) => {
    socketRef.current?.emit("radio:seek", { currentTime });
  }, []);

  // Admin: broadcast playback control
  const broadcastReviewPlayback = useCallback((data: LiveReviewPlayback) => {
    socketRef.current?.emit("review:playback", data);
  }, []);

  // Admin: notify all clients that the queue has been updated
  const broadcastReviewQueueUpdated = useCallback(() => {
    socketRef.current?.emit("review:queue_updated");
  }, []);

  // Admin: restore last played song to queue
  const broadcastLastSong = useCallback(() => {
    socketRef.current?.emit("radio:last_song");
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
    broadcastRadioPause,
    broadcastRadioResume,
    broadcastRadioSeek,
    broadcastReviewPlayback,
    broadcastReviewQueueUpdated,
    broadcastLastSong,
    socket: socketRef.current,
  };
}
