/**
 * AudioPlayButton — Universal play button for any audio source.
 *
 * Handles all URL resolution internally:
 *   - fileKey → fetches presigned URL via songs.getAudioUrl or queue.getAudioUrl
 *   - /manus-storage/... → extracts key and fetches presigned URL
 *   - https://... → uses directly
 *
 * iOS-safe: For direct URLs, uses unlockAndPlay. For URLs that need async
 * resolution (fileKey, /manus-storage/), uses unlockThenSwap which immediately
 * unlocks the audio context with a silent clip, then swaps to the real URL.
 *
 * Shows loading spinner while resolving, error toast on failure.
 * Highlights when the track is currently playing in the global player.
 */

import { useState, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { toast } from "sonner";

export type AudioPlayButtonProps = {
  /** S3 file key (e.g. "user-songs/abc123.mp3") */
  fileKey?: string | null;
  /** Direct URL or /manus-storage/... path */
  url?: string | null;
  /** Which router to use for URL resolution */
  urlSource?: "songs" | "queue";
  /** Track metadata */
  title: string;
  artist?: string;
  artworkUrl?: string;
  sourcePage?: string;
  sourceUrl?: string;
  uploaderName?: string;
  submissionId?: number;
  artistUserId?: number;
  /** Visual size */
  size?: "sm" | "md" | "lg";
  /** Extra CSS classes */
  className?: string;
  /** Called after play() is invoked */
  onPlay?: () => void;
};

export function AudioPlayButton({
  fileKey,
  url,
  urlSource = "songs",
  title,
  artist,
  artworkUrl,
  sourcePage,
  sourceUrl,
  uploaderName,
  submissionId,
  artistUserId,
  size = "md",
  className = "",
  onPlay,
}: AudioPlayButtonProps) {
  const { unlockAndPlay, unlockThenSwap, pause, resume, track: currentTrack, isPlaying } = useAudioPlayer();
  const utils = trpc.useUtils();
  const [isResolving, setIsResolving] = useState(false);

  // Check if this track is currently active in the player
  const isCurrentTrack = currentTrack?.title === title && currentTrack?.artist === artist;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  const resolveUrl = useCallback(async (): Promise<string | null> => {
    // 1. fileKey → presigned URL
    if (fileKey) {
      try {
        if (urlSource === "queue") {
          const { url: resolved } = await utils.queue.getAudioUrl.fetch({ fileKey });
          if (resolved) return resolved;
        } else {
          const { url: resolved } = await utils.songs.getAudioUrl.fetch({ fileKey });
          if (resolved) return resolved;
        }
      } catch (err) {
        console.error("[AudioPlayButton] Failed to resolve fileKey:", fileKey, err);
      }
    }

    // 2. /manus-storage/... path → extract key → presigned URL
    if (url?.startsWith("/manus-storage/")) {
      const key = url.replace("/manus-storage/", "");
      try {
        if (urlSource === "queue") {
          const { url: resolved } = await utils.queue.getAudioUrl.fetch({ fileKey: key });
          if (resolved) return resolved;
        } else {
          const { url: resolved } = await utils.songs.getAudioUrl.fetch({ fileKey: key });
          if (resolved) return resolved;
        }
      } catch (err) {
        console.error("[AudioPlayButton] Failed to resolve /manus-storage/ path:", key, err);
      }
    }

    // 3. Direct https:// URL → use as-is
    if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
      return url;
    }

    return null;
  }, [fileKey, url, urlSource, utils]);

  const handleClick = useCallback(async () => {
    // If this track is currently playing, toggle pause/resume
    if (isCurrentTrack) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
      return;
    }

    if (!fileKey && !url) {
      toast.error("No audio available for this track");
      return;
    }

    const trackMeta = {
      title,
      artist,
      artworkUrl,
      sourcePage,
      sourceUrl,
      uploaderName,
      submissionId,
      artistUserId,
      isStream: false as const,
    };

    // For direct URLs (no async resolution needed), play immediately
    if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
      unlockAndPlay({ url, ...trackMeta });
      onPlay?.();
      return;
    }

    // For fileKey or /manus-storage/ URLs that need async resolution:
    // Use unlockThenSwap to immediately unlock iOS audio context,
    // then swap to the real URL once resolved.
    setIsResolving(true);

    // MUST call unlockThenSwap synchronously within the click handler
    // to maintain the user gesture context for iOS autoplay unlock
    const swap = unlockThenSwap(trackMeta);

    try {
      const resolvedUrl = await resolveUrl();
      if (!resolvedUrl) {
        toast.error("Could not load audio — please try again");
        // Stop the silent playback
        pause();
        setIsResolving(false);
        return;
      }
      // Swap the silent placeholder with the real audio URL
      swap(resolvedUrl);
      onPlay?.();
    } catch (err) {
      console.error("[AudioPlayButton] Error:", err);
      toast.error("Failed to play track");
      pause();
    } finally {
      setIsResolving(false);
    }
  }, [isCurrentTrack, isPlaying, pause, resume, fileKey, url, resolveUrl, unlockAndPlay, unlockThenSwap, title, artist, artworkUrl, sourcePage, sourceUrl, uploaderName, submissionId, artistUserId, onPlay]);

  const sizeClasses = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };
  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      onClick={handleClick}
      disabled={isResolving}
      title={isCurrentlyPlaying ? "Pause" : `Play: ${title}`}
      className={`
        flex items-center justify-center rounded-full transition-all duration-200
        ${sizeClasses[size]}
        ${isCurrentlyPlaying
          ? "bg-red-600 text-white shadow-[0_0_12px_rgba(209,0,0,0.5)] hover:bg-red-700"
          : "bg-white/10 text-white hover:bg-red-600 hover:shadow-[0_0_12px_rgba(209,0,0,0.4)]"
        }
        ${isResolving ? "opacity-60 cursor-wait" : "cursor-pointer"}
        ${className}
      `}
    >
      {isResolving ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : isCurrentlyPlaying ? (
        <Pause className={iconSizes[size]} />
      ) : (
        <Play className={`${iconSizes[size]} ml-0.5`} />
      )}
    </button>
  );
}
