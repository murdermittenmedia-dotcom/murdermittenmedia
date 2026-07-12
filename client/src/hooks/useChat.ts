import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: number;
  username: string;
  message: string;
  room: string;
  isAdmin: boolean;
  accountLabels?: string[] | null;
  userId?: number | null;
  createdAt: Date;
}

export interface WheelSpinState {
  spinCount: 0 | 1;
  contestant1Id: number | null;
  contestant1Name: string | null;
}

export interface LiveReviewActiveItem {
  submissionId: number | null;
  userId?: number | null;
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

export interface FakeChatMessageData {
  username: string;
  text: string;
  userId?: number | null;
  timestamp: number;
}

export interface ChatControlsData {
  commentIntervalMs?: number;
  sentimentBias?: number;
  ghostFireIntervalSec?: number;
  ghostTrashIntervalSec?: number;
}

export interface AdminControlSyncData {
  commentIntervalMs?: number;
  sentimentBias?: number;
  ghostFireIntervalSec?: number;
  ghostTrashIntervalSec?: number;
  viewerMin?: number;
  viewerMax?: number;
}

interface UseChatOptions {
  room: "music_wars" | "music_review";
  username: string;
  userId?: number;
  isAdmin?: boolean;
  accountLabels?: string[];
  initialMessages?: ChatMessage[];
  onSpinStateChange?: (state: WheelSpinState) => void;
  onReviewActiveChanged?: (item: LiveReviewActiveItem) => void;
  onReviewPlayback?: (data: LiveReviewPlayback) => void;
  onReviewQueueUpdated?: () => void;
  onLastSongRestored?: (data: LastSongRestoredData) => void;
  onRadioPaused?: (data: { pausedAt: number }) => void;
  onRadioResumed?: (data: { startedAt: number }) => void;
  onRadioSeeked?: (data: { currentTime: number; startedAt: number }) => void;
  onReactionsUpdated?: (data: { submissionId: number }) => void;
  /** Viewer: called when a fake chat message arrives from admin via socket */
  onFakeChatMessage?: (data: FakeChatMessageData) => void;
  /** Viewer: called when admin broadcasts updated chat control settings */
  onChatControlsReceived?: (data: ChatControlsData) => void;
  /** Viewer: called when admin triggers a reaction flood */
  onTriggerReaction?: (data: { reaction: string; duration: number }) => void;
  /** Admin: called when another admin changes control settings */
  onAdminControlSync?: (data: AdminControlSyncData) => void;
}

export function useChat({
  room,
  username,
  userId,
  isAdmin,
  accountLabels = [],
  initialMessages = [],
  onSpinStateChange,
  onReviewActiveChanged,
  onReviewPlayback,
  onReviewQueueUpdated,
  onLastSongRestored,
  onRadioPaused,
  onRadioResumed,
  onRadioSeeked,
  onReactionsUpdated,
  onFakeChatMessage,
  onChatControlsReceived,
  onTriggerReaction,
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
  const onRadioPausedRef = useRef(onRadioPaused);
  onRadioPausedRef.current = onRadioPaused;
  const onRadioResumedRef = useRef(onRadioResumed);
  onRadioResumedRef.current = onRadioResumed;
  const onRadioSeekedRef = useRef(onRadioSeeked);
  onRadioSeekedRef.current = onRadioSeeked;
  const onReactionsUpdatedRef = useRef(onReactionsUpdated);
  onReactionsUpdatedRef.current = onReactionsUpdated;
  const onFakeChatMessageRef = useRef(onFakeChatMessage);
  onFakeChatMessageRef.current = onFakeChatMessage;
  const onChatControlsReceivedRef = useRef(onChatControlsReceived);
  onChatControlsReceivedRef.current = onChatControlsReceived;
  const onTriggerReactionRef = useRef(onTriggerReaction);
  onTriggerReactionRef.current = onTriggerReaction;
  const onAdminControlSyncRef = useRef(onAdminControlSync);
  onAdminControlSyncRef.current = onAdminControlSync;

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

    // Admin pause/resume/seek — broadcast to all listeners
    socket.on("radio:paused", (data: { pausedAt: number }) => {
      onRadioPausedRef.current?.(data);
    });
    socket.on("radio:resumed", (data: { startedAt: number }) => {
      onRadioResumedRef.current?.(data);
    });
    socket.on("radio:seeked", (data: { currentTime: number; startedAt: number }) => {
      onRadioSeekedRef.current?.(data);
    });

    // Reactions/votes updated — refetch counts for all viewers
    socket.on("review:reactions_updated", (data: { submissionId: number }) => {
      onReactionsUpdatedRef.current?.(data);
    });

    // Admin: last song restored to queue
    socket.on("radio:last_song_restored", (data: LastSongRestoredData) => {
      onLastSongRestoredRef.current?.(data);
    });

    // Fake chat message relayed from admin — viewers receive and display it
    socket.on("review:fake_chat_message", (data: FakeChatMessageData) => {
      onFakeChatMessageRef.current?.(data);
    });

    // Chat control settings relayed from admin — viewers apply them
    socket.on("review:chat_controls", (data: ChatControlsData) => {
      onChatControlsReceivedRef.current?.(data);
    });

    // Reaction trigger relayed from admin — viewers flood their fake chat
    socket.on("review:trigger_reaction", (data: { reaction: string; duration: number }) => {
      onTriggerReactionRef.current?.(data);
    });

    // Admin control sync — when one admin changes settings, relay to all other admins
    socket.on("review:admin_control_sync", (data: AdminControlSyncData) => {
      onAdminControlSyncRef.current?.(data);
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
      accountLabels: accountLabels ?? [],
    });
  }, [username, room, userId, isAdmin, accountLabels]);

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

  // Broadcast that reactions have been updated for a submission
  const broadcastReactionsUpdated = useCallback((submissionId: number) => {
    socketRef.current?.emit("review:reactions_updated", { submissionId });
  }, []);

  // Admin: restore last played song to queue
  const broadcastLastSong = useCallback(() => {
    socketRef.current?.emit("radio:last_song");
  }, []);

  // Admin: emit a fake chat message so all viewers see it in real time
  const emitFakeChatMessage = useCallback((data: FakeChatMessageData) => {
    socketRef.current?.emit("review:fake_chat_message", data);
  }, []);

  // Admin: broadcast updated chat control settings to all viewers
  const emitChatControls = useCallback((data: ChatControlsData) => {
    socketRef.current?.emit("review:chat_controls", data);
  }, []);

  // Admin: broadcast a reaction trigger to all viewers
  const emitTriggerReaction = useCallback((reaction: string, duration: number) => {
    socketRef.current?.emit("review:trigger_reaction", { reaction, duration });
  }, []);

  // Admin: sync control settings to all other admins
  const emitAdminControlSync = useCallback((data: AdminControlSyncData) => {
    socketRef.current?.emit("review:admin_control_sync", data);
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
    broadcastReactionsUpdated,
    broadcastLastSong,
    emitFakeChatMessage,
    emitChatControls,
    emitTriggerReaction,
    emitAdminControlSync,
    socket: socketRef.current,
  };
}
