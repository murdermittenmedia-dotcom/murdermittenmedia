/**
 * usePlayTrack — Shared hook for resolving audio URLs and playing tracks.
 *
 * Handles three URL forms:
 *   1. fileKey (e.g. "forum-audio/abc123.mp3") — fetches presigned URL via songs.getAudioUrl
 *   2. /manus-storage/... path — fetches presigned URL via songs.getAudioUrl (strips prefix)
 *   3. External URL (https://...) — uses directly
 *
 * Usage:
 *   const { playTrack, isResolving } = usePlayTrack();
 *   await playTrack({ fileKey: "abc.mp3", title: "My Song", artist: "YLG" });
 *   await playTrack({ url: "https://youtube.com/...", title: "My Song", artist: "YLG" });
 */

import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer, AudioTrack } from "@/contexts/AudioPlayerContext";
import { toast } from "sonner";

export type PlayTrackInput = {
  /** S3 file key (e.g. "user-songs/abc123.mp3") — will be resolved to presigned URL */
  fileKey?: string | null;
  /** Direct URL (external link, YouTube, or already-resolved presigned URL) */
  url?: string | null;
  /** Fallback URL if fileKey resolution fails */
  fallbackUrl?: string | null;
  /** Which router's getAudioUrl to use: "songs" | "queue" | "radio" */
  urlSource?: "songs" | "queue" | "radio";
  title: string;
  artist?: string;
  artworkUrl?: string;
  isStream?: boolean;
  submissionId?: number;
  artistUserId?: number;
  sourcePage?: string;
  sourceUrl?: string;
  uploaderName?: string;
  queuePosition?: number;
  queueTotal?: number;
};

export function usePlayTrack() {
  const { play } = useAudioPlayer();
  const utils = trpc.useUtils();
  const [isResolving, setIsResolving] = useState(false);

  const resolveUrl = useCallback(async (input: PlayTrackInput): Promise<string | null> => {
    // If we have a fileKey, always resolve to presigned URL
    if (input.fileKey) {
      try {
        const source = input.urlSource ?? "songs";
        let result: { url: string };
        if (source === "queue") {
          result = await utils.queue.getAudioUrl.fetch({ fileKey: input.fileKey });
        } else if (source === "radio") {
          result = await utils.radio.getTrackUrl.fetch({ fileKey: input.fileKey });
        } else {
          result = await utils.songs.getAudioUrl.fetch({ fileKey: input.fileKey });
        }
        if (result?.url) return result.url;
      } catch (err) {
        console.error("[usePlayTrack] Failed to resolve fileKey:", input.fileKey, err);
        // Fall through to fallback
      }
    }

    // If url is a /manus-storage/ path, extract the key and resolve it
    if (input.url?.startsWith("/manus-storage/")) {
      const key = input.url.replace("/manus-storage/", "");
      try {
        const source = input.urlSource ?? "songs";
        let result: { url: string };
        if (source === "queue") {
          result = await utils.queue.getAudioUrl.fetch({ fileKey: key });
        } else if (source === "radio") {
          result = await utils.radio.getTrackUrl.fetch({ fileKey: key });
        } else {
          result = await utils.songs.getAudioUrl.fetch({ fileKey: key });
        }
        if (result?.url) return result.url;
      } catch (err) {
        console.error("[usePlayTrack] Failed to resolve /manus-storage/ path:", key, err);
        // Fall through to fallback
      }
    }

    // Use direct URL if it's external (https://)
    if (input.url && (input.url.startsWith("http://") || input.url.startsWith("https://"))) {
      return input.url;
    }

    // Try fallback URL
    if (input.fallbackUrl) {
      if (input.fallbackUrl.startsWith("http://") || input.fallbackUrl.startsWith("https://")) {
        return input.fallbackUrl;
      }
      if (input.fallbackUrl.startsWith("/manus-storage/")) {
        const key = input.fallbackUrl.replace("/manus-storage/", "");
        try {
          const result = await utils.songs.getAudioUrl.fetch({ fileKey: key });
          if (result?.url) return result.url;
        } catch {}
      }
    }

    return null;
  }, [utils, play]);

  const playTrack = useCallback(async (input: PlayTrackInput) => {
    setIsResolving(true);
    try {
      const resolvedUrl = await resolveUrl(input);
      if (!resolvedUrl) {
        toast.error("Could not load audio — no playable URL found");
        return;
      }

      const track: AudioTrack = {
        url: resolvedUrl,
        title: input.title,
        artist: input.artist,
        artworkUrl: input.artworkUrl,
        isStream: input.isStream,
        submissionId: input.submissionId,
        artistUserId: input.artistUserId,
        sourcePage: input.sourcePage,
        sourceUrl: input.sourceUrl,
        uploaderName: input.uploaderName,
        queuePosition: input.queuePosition,
        queueTotal: input.queueTotal,
      };

      play(track);
    } catch (err) {
      console.error("[usePlayTrack] Error:", err);
      toast.error("Failed to play track");
    } finally {
      setIsResolving(false);
    }
  }, [resolveUrl, play]);

  return { playTrack, isResolving };
}
