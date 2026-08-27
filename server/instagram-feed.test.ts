import { describe, expect, it, vi } from "vitest";
import { fetchInstagramPosts } from "./instagram-feed";

describe("Instagram feed helper", () => {
  it("keeps only posts created by the configured account and preserves video thumbnail fallbacks", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          id: "own-image",
          username: "murdermittenmedia",
          owner: { id: "123" },
          caption: "Our post",
          media_type: "IMAGE",
          media_url: "https://cdn.example.com/own.jpg",
          permalink: "https://instagram.com/p/own-image",
          like_count: 12,
          comments_count: 3,
          timestamp: "2026-08-27T12:00:00Z",
        },
        {
          id: "collab-post",
          username: "othercreator",
          owner: { id: "123" },
          caption: "Collaborative post",
          media_type: "IMAGE",
          media_url: "https://cdn.example.com/collab.jpg",
          permalink: "https://instagram.com/p/collab-post",
          timestamp: "2026-08-27T11:00:00Z",
        },
        {
          id: "other-owner",
          username: "othercreator",
          owner: { id: "999" },
          caption: "Other owner's post",
          media_type: "IMAGE",
          media_url: "https://cdn.example.com/other.jpg",
          permalink: "https://instagram.com/p/other-owner",
          timestamp: "2026-08-27T10:00:00Z",
        },
        {
          id: "own-video",
          username: "murdermittenmedia",
          owner: { id: "123" },
          caption: "Our video",
          media_type: "VIDEO",
          media_url: "",
          thumbnail_url: "https://cdn.example.com/video-thumb.jpg",
          permalink: "https://instagram.com/p/own-video",
          timestamp: "2026-08-27T09:00:00Z",
        },
      ],
    }), { status: 200 }));

    const posts = await fetchInstagramPosts({
      accessToken: "token",
      userId: "123",
      accountHandle: "murdermittenmedia",
      fetchFn,
    });

    expect(posts.map((post) => post.id)).toEqual(["own-image", "own-video"]);
    expect(posts[1]).toMatchObject({
      mediaUrl: "",
      thumbnailUrl: "https://cdn.example.com/video-thumb.jpg",
      likes: 0,
      comments: 0,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("returns an empty list for an upstream error without throwing", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response("invalid", { status: 401 }));

    await expect(fetchInstagramPosts({
      accessToken: "token",
      userId: "123",
      fetchFn,
    })).resolves.toEqual([]);
  });

  it("aborts a stalled upstream request within the configured timeout", async () => {
    const fetchFn = vi.fn<typeof fetch>((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));

    await expect(fetchInstagramPosts({
      accessToken: "token",
      userId: "123",
      timeoutMs: 5,
      fetchFn,
    })).resolves.toEqual([]);
  });
});
