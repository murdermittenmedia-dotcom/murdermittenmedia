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

export type YouTubeChannelVideo = YouTubeImportMetadata & { publishedAt: string | null };

function extractChannelIdFromHtml(html: string) {
  const match = html.match(/(?:channelId|externalId)"?\s*:\s*"(UC[A-Za-z0-9_-]{22})/);
  return match?.[1] || null;
}

export function parseYouTubeChannelUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com") return null;
    const channelId = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1] || null;
    if (channelId) return { channelId, canonicalUrl: `https://www.youtube.com/channel/${channelId}` };
    if (/^\/(?:@|c\/|user\/)/.test(url.pathname)) return { channelId: null, canonicalUrl: url.toString() };
    return null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeChannelVideos(value: string): Promise<{ channelUrl: string; videos: YouTubeChannelVideo[] }> {
  const parsed = parseYouTubeChannelUrl(value);
  if (!parsed) throw new Error("Paste a valid YouTube channel URL, such as youtube.com/@yourhandle.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let channelId = parsed.channelId;
    if (!channelId) {
      const page = await fetch(parsed.canonicalUrl, { signal: controller.signal, headers: { "User-Agent": "MurderMittenMedia/1.0 YouTube channel import" } });
      if (!page.ok) throw new Error("YouTube could not open that channel.");
      channelId = extractChannelIdFromHtml(await page.text());
    }
    if (!channelId) throw new Error("Could not identify that YouTube channel. Try its /channel/ URL.");
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: controller.signal, headers: { "User-Agent": "MurderMittenMedia/1.0 YouTube channel import" } });
    if (!feed.ok) throw new Error("YouTube could not return this channel's uploads.");
    const xml = await feed.text();
    const videos: YouTubeChannelVideo[] = [];
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries.slice(0, 50)) {
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")?.trim();
      const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || null;
      if (!videoId || !title) continue;
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      videos.push({ videoId, canonicalUrl, title: title.slice(0, 160), creator: "YouTube channel", thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, publishedAt });
    }
    return { channelUrl: parsed.canonicalUrl, videos };
  } catch (error) {
    if (error instanceof Error && error.message.includes("YouTube")) throw error;
    throw new Error("Could not reach YouTube. Check the channel link and try again.");
  } finally {
    clearTimeout(timeout);
  }
}
