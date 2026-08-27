export type InstagramFeedPost = {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  likes: number;
  comments: number;
  timestamp: string;
};

type InstagramApiRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

type FetchInstagramPostsOptions = {
  accessToken?: string;
  userId?: string;
  accountHandle?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
};

const INSTAGRAM_API_HOST = "https://graph.instagram.com";
const DEFAULT_TIMEOUT_MS = 8_000;
const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "like_count",
  "comments_count",
  "timestamp",
  "owner",
].join(",");

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function getOwnerId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return asString((value as { id?: unknown }).id);
  }
  return undefined;
}

function normalizePost(record: InstagramApiRecord, configuredUserId: string, configuredHandle?: string): InstagramFeedPost | null {
  const id = asString(record.id);
  const permalink = asString(record.permalink);
  const timestamp = asString(record.timestamp);
  const mediaType = record.media_type;

  if (!id || !permalink || !timestamp) return null;
  if (mediaType !== "IMAGE" && mediaType !== "VIDEO" && mediaType !== "CAROUSEL_ALBUM") return null;

  // The /media endpoint is scoped to the configured account. If Meta returns
  // an owner field, still enforce it so collaborative/third-party media cannot
  // leak into the public account feed.
  const ownerId = getOwnerId(record.owner);
  if (ownerId && ownerId !== configuredUserId) return null;

  const username = asString(record.username)?.replace(/^@/, "").toLowerCase();
  const normalizedHandle = configuredHandle?.replace(/^@/, "").toLowerCase();
  if (normalizedHandle && username && username !== normalizedHandle) return null;

  return {
    id,
    caption: asString(record.caption) ?? "",
    mediaType,
    // Meta may omit media_url for videos with licensed audio. The client can
    // fall back to thumbnailUrl or the permalink when mediaUrl is empty.
    mediaUrl: asString(record.media_url) ?? "",
    thumbnailUrl: asString(record.thumbnail_url),
    permalink,
    likes: asNonNegativeNumber(record.like_count),
    comments: asNonNegativeNumber(record.comments_count),
    timestamp,
  };
}

export async function fetchInstagramPosts(options: FetchInstagramPostsOptions = {}): Promise<InstagramFeedPost[]> {
  const accessToken = options.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = options.userId ?? process.env.INSTAGRAM_USER_ID;
  const accountHandle = options.accountHandle ?? process.env.INSTAGRAM_ACCOUNT_HANDLE;
  if (!accessToken || !userId) return [];

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = new URL(`${INSTAGRAM_API_HOST}/${encodeURIComponent(userId)}/media`);
    endpoint.searchParams.set("fields", MEDIA_FIELDS);
    endpoint.searchParams.set("limit", "20");
    endpoint.searchParams.set("access_token", accessToken);

    const response = await fetchFn(endpoint, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Instagram API request failed with status ${response.status}`);
    }

    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data)) return [];

    return payload.data
      .filter((record): record is InstagramApiRecord => !!record && typeof record === "object")
      .map((record) => normalizePost(record, userId, accountHandle))
      .filter((post): post is InstagramFeedPost => post !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[IG Feed] Failed:", message);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
