/**
 * useLivePlayer — Global live-review auto-play hook.
 *
 * Connects a socket to the server and listens for the site-wide
 * `live:now_playing` event. When the admin loads a track in Music Review,
 * every visitor's FloatingPlayer automatically starts playing that track
 * with a LIVE badge (isStream: true).
 *
 * Mount this hook ONCE in App.tsx (outside any route) so it runs on every page.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

const LOGO = "/manus-storage/mmm_logo_8689da6b.png";

export interface LiveNowPlayingEvent {
  submissionId: number;
  artistName: string;
  songTitle: string;
  audioUrl: string | null;
  youtubeUrl: string | null;
  submissionType: string;
}

export function useLivePlayer() {
  const { play, stop, track } = useAudioPlayer();
  // Keep refs so socket callbacks always see latest values without re-subscribing
  const playRef = useRef(play);
  const stopRef = useRef(stop);
  const trackRef = useRef(track);
  playRef.current = play;
  stopRef.current = stop;
  trackRef.current = track;

  useEffect(() => {
    // Connect without joining a room — we only need the global live:now_playing event
    const socket: Socket = io(window.location.origin, {
      path: "/api/socket.io",
      query: { room: "global" }, // not a valid room so it won't join any room
    });

    socket.on("live:now_playing", (data: LiveNowPlayingEvent | null) => {
      if (!data) {
        // Admin cleared the deck — stop if we're playing a live track
        const current = trackRef.current;
        if (current?.isStream) {
          stopRef.current();
        }
        return;
      }

      // If it's a file submission, play via the global audio player with LIVE badge
      if (data.submissionType === "file" && data.audioUrl) {
        playRef.current({
          url: data.audioUrl,
          title: data.songTitle,
          artist: data.artistName,
          artworkUrl: LOGO,
          isStream: true, // shows LIVE badge in FloatingPlayer
          submissionId: data.submissionId,
          sourcePage: "Music Review",
          sourceUrl: "/review",
        });
      }
      // YouTube submissions are handled by the Music Review page inline embed
      // We don't auto-play YouTube in the global player since it needs a video element
    });

    return () => {
      socket.disconnect();
    };
  }, []); // mount once
}
