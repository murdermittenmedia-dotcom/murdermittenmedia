import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMusicLinkMetadata } from "./music-link-metadata";

const fetchMock = vi.fn();

describe("getMusicLinkMetadata", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("enriches a YouTube release using its allowlisted oEmbed endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      title: "Midnight in the Mitten",
      author_name: "YLG TWON",
      thumbnail_url: "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
    }), { status: 200 }));

    await expect(getMusicLinkMetadata("https://www.youtube.com/watch?v=abc")).resolves.toEqual({
      platform: "YouTube",
      title: "Midnight in the Mitten",
      artist: "YLG TWON",
      artworkUrl: "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
      canonicalUrl: "https://www.youtube.com/watch?v=abc",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("youtube.com/oembed");
  });

  it("enriches a Spotify release through the allowlisted Spotify oEmbed endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      title: "Mitten Anthem by YLG TWON",
      thumbnail_url: "https://i.scdn.co/image/cover.jpg",
    }), { status: 200 }));

    await expect(getMusicLinkMetadata("https://open.spotify.com/track/123")).resolves.toMatchObject({
      platform: "Spotify",
      title: "Mitten Anthem",
      artist: "YLG TWON",
      artworkUrl: "https://i.scdn.co/image/cover.jpg",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("open.spotify.com/oembed");
  });

  it("enriches an Apple Music release from the public iTunes lookup response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      results: [{ trackName: "Mitten Anthem", artistName: "Murder Mitten", artworkUrl100: "https://img.example/100x100.jpg", trackViewUrl: "https://music.apple.com/us/song/mitten-anthem/456" }],
    }), { status: 200 }));

    await expect(getMusicLinkMetadata("https://music.apple.com/us/album/mitten/123?i=456")).resolves.toMatchObject({
      platform: "Apple Music",
      title: "Mitten Anthem",
      artist: "Murder Mitten",
      artworkUrl: "https://img.example/600x600.jpg",
    });
  });

  it("rejects non-music domains without fetching untrusted URLs", async () => {
    await expect(getMusicLinkMetadata("https://example.com/not-a-release")).rejects.toThrow("Supported release links");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
