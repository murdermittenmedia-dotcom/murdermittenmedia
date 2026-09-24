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
      title,
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

function decodeYouTubeText(value: string) {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0027/g, "'")
    .replace(/\\u0022/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Extracts the uploads currently rendered on a channel's Videos page. */
export function parseYouTubeChannelPageVideos(html: string): YouTubeChannelVideo[] {
  const videos: YouTubeChannelVideo[] = [];
  const seen = new Set<string>();
  const pattern = /videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,12000}?metadata":\{"lockupMetadataViewModel":\{"title":\{"content":"([^"]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const videoId = match[1];
    if (seen.has(videoId)) continue;
    seen.add(videoId);
    const title = decodeYouTubeText(match[2]).slice(0, 160);
    if (!title) continue;
    videos.push({
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      creator: "YouTube channel",
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      publishedAt: null,
    });
    if (videos.length >= 50) break;
  }
  return videos;
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
    const pageUrl = parsed.canonicalUrl.replace(/\/$/, "") + "/videos";
    const page = await fetch(pageUrl, { signal: controller.signal, headers: { "User-Agent": "MurderMittenMedia/1.0 YouTube channel import" } });
    if (!page.ok) throw new Error("YouTube could not open that channel.");
    const pageHtml = await page.text();
    let channelId = parsed.channelId || extractChannelIdFromHtml(pageHtml);
    if (!channelId) throw new Error("Could not identify that YouTube channel. Try its /channel/ URL.");
    const pageVideos = parseYouTubeChannelPageVideos(pageHtml);
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: controller.signal, headers: { "User-Agent": "MurderMittenMedia/1.0 YouTube channel import" } });
    // YouTube intermittently returns 404 for the legacy feeds endpoint on handle-based
    // channels. The Videos page is already sufficient for the picker, so only fail if
    // both sources are unavailable.
    if (!feed.ok && !pageVideos.length) throw new Error("YouTube could not return this channel's uploads.");
    const xml = feed.ok ? await feed.text() : "";
    const videos: YouTubeChannelVideo[] = [...pageVideos];
    const seen = new Set(videos.map((video) => video.videoId));
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries) {
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ? decodeYouTubeText(entry.match(/<title>([\s\S]*?)<\/title>/)![1]) : "";
      const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1] || null;
      if (!videoId || !title || seen.has(videoId)) continue;
      seen.add(videoId);
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      videos.push({ videoId, canonicalUrl, title, creator: "YouTube channel", thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`, publishedAt });
      if (videos.length >= 50) break;
    }
    return { channelUrl: parsed.canonicalUrl, videos };
  } catch (error) {
    if (error instanceof Error && error.message.includes("YouTube")) throw error;
    throw new Error("Could not reach YouTube. Check the channel link and try again.");
  } finally {
    clearTimeout(timeout);
  }
}
