import type { Express } from "express";
import { ENV } from "./env";

// ─── Presigned URL cache ──────────────────────────────────────────────────────
// Presigned URLs from the Forge storage backend are valid for ~1 hour.
// We cache them for 10 minutes to avoid hammering the API when many users
// load the same audio/image files simultaneously (which caused 429 errors).
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_SIZE = 500;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const presignedUrlCache = new Map<string, CacheEntry>();

function getCached(key: string): string | null {
  const entry = presignedUrlCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    presignedUrlCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCached(key: string, url: string): void {
  if (presignedUrlCache.size >= CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [k, v] of Array.from(presignedUrlCache.entries())) {
      if (now > v.expiresAt) presignedUrlCache.delete(k);
    }
    if (presignedUrlCache.size >= CACHE_MAX_SIZE) {
      const toRemove = Math.floor(CACHE_MAX_SIZE * 0.2);
      const keys = Array.from(presignedUrlCache.keys()).slice(0, toRemove);
      keys.forEach(k => presignedUrlCache.delete(k));
    }
  }
  presignedUrlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

// In-flight deduplication: if two requests arrive for the same key before
// the first resolves, reuse the same promise instead of firing two API calls.
const inFlight = new Map<string, Promise<string>>();

async function getPresignedUrl(key: string, forgeApiUrl: string, forgeApiKey: string): Promise<string> {
  const cached = getCached(key);
  if (cached) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      forgeApiUrl.replace(/\/+$/, "") + "/",
    );
    forgeUrl.searchParams.set("path", key);

    const forgeResp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${forgeApiKey}` },
    });

    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      throw new Error(`forge ${forgeResp.status} ${body}`);
    }

    const { url } = (await forgeResp.json()) as { url: string };
    if (!url) throw new Error("Empty signed URL from backend");

    setCached(key, url);
    return url;
  })();

  inFlight.set(key, promise);
  promise.finally(() => inFlight.delete(key));
  return promise;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const url = await getPresignedUrl(key, ENV.forgeApiUrl, ENV.forgeApiKey);
      // Cache the redirect in the browser for 5 minutes (half of server cache TTL)
      res.set("Cache-Control", "public, max-age=300");
      res.redirect(307, url);
    } catch (err: any) {
      console.error(`[StorageProxy] failed for key "${key}":`, err?.message ?? err);
      res.status(502).send("Storage backend error");
    }
  });
}
