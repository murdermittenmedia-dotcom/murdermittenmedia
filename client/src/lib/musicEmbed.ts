export type MusicEmbedProvider = "spotify" | "apple_music" | "youtube";

export type MusicEmbed = {
  provider: MusicEmbedProvider;
  src: string;
};

function toUrl(value: string) {
  try {
    return new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
  } catch {
    return null;
  }
}

function spotifyEmbed(url: URL): MusicEmbed | null {
  const match = url.pathname.match(/^\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)$/);
  if (!match) return null;
  return {
    provider: "spotify",
    src: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`,
  };
}

function appleMusicEmbed(url: URL): MusicEmbed | null {
  if (!url.hostname.toLowerCase().endsWith("music.apple.com")) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3) return null;
  const locale = segments[0];
  const mediaType = segments[1];
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) || !/^(album|song|playlist|music-video|artist|station)$/.test(mediaType)) return null;
  return {
    provider: "apple_music",
    src: `https://embed.music.apple.com/${segments.join("/")}`,
  };
}

function youtubeEmbed(url: URL): MusicEmbed | null {
  const hostname = url.hostname.toLowerCase();
  if (!(hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "music.youtube.com" || hostname === "youtu.be")) return null;
  let videoId = "";
  if (hostname === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
  if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/")[2] ?? "";
  if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null;
  return { provider: "youtube", src: `https://www.youtube.com/embed/${videoId}` };
}

export function getMusicEmbed(value: string | null | undefined): MusicEmbed | null {
  if (!value?.trim()) return null;
  const url = toUrl(value);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase();
  if (hostname === "open.spotify.com" || hostname === "spotify.com" || hostname.endsWith(".spotify.com")) return spotifyEmbed(url);
  if (hostname === "music.apple.com" || hostname.endsWith(".music.apple.com")) return appleMusicEmbed(url);
  return youtubeEmbed(url);
}

export function musicProviderLabel(provider: MusicEmbedProvider) {
  if (provider === "spotify") return "Spotify player";
  if (provider === "apple_music") return "Apple Music player";
  return "YouTube player";
}

export function musicProviderTheme(provider: MusicEmbedProvider) {
  if (provider === "spotify") return { name: "Spotify", accent: "#1ed760", soft: "rgba(30, 215, 96, 0.16)" };
  if (provider === "apple_music") return { name: "Apple Music", accent: "#fa2d48", soft: "rgba(250, 45, 72, 0.16)" };
  return { name: "YouTube", accent: "#ff0033", soft: "rgba(255, 0, 51, 0.16)" };
}
