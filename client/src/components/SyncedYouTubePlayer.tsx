/**
 * SyncedYouTubePlayer — YouTube IFrame API wrapper with live sync.
 *
 * Admin mode (isAdmin=true):
 *   - Loads the YouTube IFrame API and creates a player
 *   - Emits youtube:tick every 2s with { submissionId, currentTime, state }
 *   - Allows full playback control (autoplay=1)
 *
 * Viewer mode (isAdmin=false):
 *   - Loads the YouTube IFrame API and creates a player
 *   - Listens for youtube:tick events and seeks to synced position
 *   - On initial load, seeks to the late-joiner position from radio:state
 *   - Requires user gesture to start (autoplay=0, shows overlay)
 *
 * YouTube IFrame API is loaded once globally via window.YT.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    _ytApiLoading?: boolean;
    _ytApiReady?: boolean;
    _ytApiCallbacks?: Array<() => void>;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window._ytApiReady) {
      resolve();
      return;
    }
    if (!window._ytApiCallbacks) window._ytApiCallbacks = [];
    window._ytApiCallbacks.push(resolve);
    if (window._ytApiLoading) return;
    window._ytApiLoading = true;

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window._ytApiReady = true;
      window._ytApiLoading = false;
      if (prev) prev();
      (window._ytApiCallbacks ?? []).forEach(cb => cb());
      window._ytApiCallbacks = [];
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
}

interface SyncedYouTubePlayerProps {
  videoId: string;
  submissionId: number;
  isAdmin: boolean;
  /** For late-joiner sync: initial currentTime from radio:state */
  initialCurrentTime?: number | null;
  initialUpdatedAt?: number | null;
  className?: string;
}

export function SyncedYouTubePlayer({
  videoId,
  submissionId,
  isAdmin,
  initialCurrentTime,
  initialUpdatedAt,
  className = "",
}: SyncedYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unlocked, setUnlocked] = useState(isAdmin); // admin auto-plays, viewers need tap
  const [playerReady, setPlayerReady] = useState(false);
  const submissionIdRef = useRef(submissionId);
  submissionIdRef.current = submissionId;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  // Track latest tick for seeking after player becomes ready
  const latestTickRef = useRef<{ currentTime: number; updatedAt: number } | null>(null);

  // Connect socket for tick events
  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room: "global" },
    });
    socketRef.current = socket;

    if (!isAdmin) {
      // Request current radio state for late-joiner YouTube timestamp
      socket.on("connect", () => {
        socket.emit("radio:get_state");
      });

      // Late-joiner: get initial YouTube position from server state
      socket.on("radio:state", (data: { submissionId: number | null; ytCurrentTime: number | null; ytUpdatedAt: number | null; ytState: number | null } | null) => {
        if (!data || data.submissionId !== submissionIdRef.current) return;
        if (data.ytCurrentTime != null && data.ytUpdatedAt != null) {
          const syncedTime = data.ytCurrentTime + (Date.now() - data.ytUpdatedAt) / 1000;
          latestTickRef.current = { currentTime: syncedTime, updatedAt: Date.now() };
          // If player is already ready, seek immediately
          const player = playerRef.current;
          if (player && syncedTime > 2) {
            player.seekTo(syncedTime, true);
          }
        }
      });

      // Viewer: listen for youtube:tick and seek to synced position
      socket.on("youtube:tick", (data: { submissionId: number; currentTime: number; state: number; updatedAt: number }) => {
        if (data.submissionId !== submissionIdRef.current) return;
        const syncedTime = data.currentTime + (Date.now() - data.updatedAt) / 1000;
        latestTickRef.current = { currentTime: syncedTime, updatedAt: Date.now() };
        const player = playerRef.current;
        if (!player) return;
        // Calculate synced position accounting for network latency
        const playerTime = player.getCurrentTime();
        const drift = Math.abs(syncedTime - playerTime);
        // Only seek if drift > 3s to avoid constant seeking
        if (drift > 3) {
          player.seekTo(syncedTime, true);
        }
        // Sync play/pause state
        const playerState = player.getPlayerState();
        if (data.state === 1 && playerState !== 1) {
          player.playVideo();
        } else if (data.state === 2 && playerState === 1) {
          player.pauseVideo();
        }
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAdmin]);

  // Load YouTube IFrame API and create player
  useEffect(() => {
    let destroyed = false;
    const container = containerRef.current;
    if (!container) return;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;

      const player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: isAdmin ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (destroyed) return;
            playerRef.current = e.target;
            setPlayerReady(true);

            if (isAdmin) {
              // Admin: start ticking every 2s
              tickIntervalRef.current = setInterval(() => {
                const p = playerRef.current;
                if (!p || !socketRef.current?.connected) return;
                const ct = p.getCurrentTime();
                const state = p.getPlayerState();
                socketRef.current.emit("youtube:tick", {
                  submissionId: submissionIdRef.current,
                  currentTime: ct,
                  state,
                });
              }, 2000);
            } else {
              // Viewer: seek to latest tick position if available (from radio:state or youtube:tick)
              const tick = latestTickRef.current;
              if (tick && tick.currentTime > 2) {
                e.target.seekTo(tick.currentTime, true);
              } else if (initialCurrentTime != null && initialUpdatedAt != null) {
                const syncedTime = initialCurrentTime + (Date.now() - initialUpdatedAt) / 1000;
                if (syncedTime > 2) {
                  e.target.seekTo(syncedTime, true);
                }
              }
            }
          },
          onStateChange: (e) => {
            if (destroyed || !isAdmin) return;
            // Emit tick immediately on state change so viewers sync faster
            if (socketRef.current?.connected) {
              socketRef.current.emit("youtube:tick", {
                submissionId: submissionIdRef.current,
                currentTime: e.target.getCurrentTime(),
                state: e.data,
              });
            }
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      // Destroy player after a tick to avoid React strict mode double-invoke issues
      setTimeout(() => {
        if (playerRef.current) {
          try { playerRef.current.destroy(); } catch {}
          playerRef.current = null;
        }
      }, 0);
    };
  }, [videoId, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    // Play via IFrame API
    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.playVideo();
        // Seek to latest tick if available
        if (initialCurrentTime != null && initialUpdatedAt != null) {
          const syncedTime = initialCurrentTime + (Date.now() - initialUpdatedAt) / 1000;
          if (syncedTime > 2) {
            playerRef.current.seekTo(syncedTime, true);
          }
        }
      }
    }, 300);
  }, [initialCurrentTime, initialUpdatedAt]);

  return (
    <div className={`relative w-full ${className}`} style={{ paddingTop: "56.25%" }}>
      {/* YouTube IFrame API replaces this div */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Viewer tap-to-watch overlay */}
      {!isAdmin && !unlocked && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 cursor-pointer z-10 gap-3"
          onClick={handleUnlock}
        >
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(209,0,0,0.5)]">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-white/70 text-sm font-medium">Tap to watch in sync</p>
          <p className="text-white/40 text-xs">Synced to admin&apos;s position</p>
        </div>
      )}

      {/* Loading indicator */}
      {!playerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-5">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
