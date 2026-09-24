const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeImportMetadata = {
  videoId: string;
  canonicalUrl: string;
  title: string;
  creator: string;
  thumbnailUrl: string | null;
  embedUrl: string;
};

export function parseYouTubeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      return VIDEO_ID_PATTERN.test(videoId) ? { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` } : null;
    }
    if (hostname !== "youtube.com" && hostname !== "m.youtube.com" && hostname !== "youtube-nocookie.com") return null;
    const videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1] || "";
    return VIDEO_ID_PATTERN.test(videoId) ? { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` } : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeMetadata(value: string): Promise<YouTubeImportMetadata> {
  const parsed = parseYouTubeUrl(value);
  if (!parsed) throw new Error("Paste a valid YouTube video, Shorts, or live link.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { "User-Agent": "MurderMittenMedia/1.0 YouTube metadata import" },
    });
    if (!response.ok) throw new Error("YouTube could not return metadata for that link.");
    const data = await response.json() as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) throw new Error("That YouTube video did not provide a usable title.");
    return {
      ...parsed,
      title: title.slice(0, 160),
      creator: typeof data.author_name === "string" ? data.author_name.slice(0, 160) : "YouTube creator",
      thumbnailUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
      embedUrl: `https://www.youtube-nocookie.com/embed/${parsed.videoId}`,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("YouTube")) throw error;
    throw new Error("Could not reach YouTube. Check the link and try again.");
  } finally {
    clearTimeout(timeout);
  }
}
