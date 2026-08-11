export type MusicLinkMetadata = {
  platform: "Spotify" | "Apple Music" | "YouTube";
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  canonicalUrl: string;
};

const REQUEST_TIMEOUT_MS = 6_000;

function safeUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Use a valid http or https music URL");
  }
  return url;
}

function isHost(url: URL, hosts: string[]) {
  return hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Metadata service returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function splitSpotifyTitle(title: string) {
  const match = title.match(/^(.+?)\s+(?:by|·|–|-)\s+(.+)$/i);
  return match ? { title: match[1].trim(), artist: match[2].trim() } : { title: title.trim(), artist: null };
}

async function getSpotifyMetadata(url: URL): Promise<MusicLinkMetadata> {
  const result = await fetchJson<{ title?: string; thumbnail_url?: string }>(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url.toString())}`,
  );
  const parsed = splitSpotifyTitle(result.title || "Spotify release");
  return {
    platform: "Spotify",
    title: parsed.title || "Spotify release",
    artist: parsed.artist,
    artworkUrl: result.thumbnail_url || null,
    canonicalUrl: url.toString(),
  };
}

async function getYouTubeMetadata(url: URL): Promise<MusicLinkMetadata> {
  const result = await fetchJson<{ title?: string; author_name?: string; thumbnail_url?: string }>(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`,
  );
  return {
    platform: "YouTube",
    title: result.title?.trim() || "YouTube release",
    artist: result.author_name?.trim() || null,
    artworkUrl: result.thumbnail_url || null,
    canonicalUrl: url.toString(),
  };
}

type AppleLookupResult = {
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  collectionViewUrl?: string;
};

async function getAppleMusicMetadata(url: URL): Promise<MusicLinkMetadata> {
  const id = url.searchParams.get("i") || url.pathname.match(/id(\d+)/i)?.[1];
  if (!id) throw new Error("Use an Apple Music song or album link that includes its ID");
  const result = await fetchJson<{ results?: AppleLookupResult[] }>(
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song`,
  );
  const match = result.results?.[0];
  if (!match) throw new Error("Apple Music could not find that release");
  return {
    platform: "Apple Music",
    title: match.trackName || match.collectionName || "Apple Music release",
    artist: match.artistName || null,
    artworkUrl: match.artworkUrl100?.replace("100x100", "600x600") || null,
    canonicalUrl: match.trackViewUrl || match.collectionViewUrl || url.toString(),
  };
}

export async function getMusicLinkMetadata(rawUrl: string): Promise<MusicLinkMetadata> {
  const url = safeUrl(rawUrl);
  if (isHost(url, ["spotify.com", "spotify.link"])) return getSpotifyMetadata(url);
  if (isHost(url, ["music.apple.com"])) return getAppleMusicMetadata(url);
  if (isHost(url, ["youtube.com", "youtu.be", "youtube-nocookie.com"])) return getYouTubeMetadata(url);
  throw new Error("Supported release links are Spotify, Apple Music, and YouTube");
}
