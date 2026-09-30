import { describe, expect, it } from "vitest";
import { normalizeArticleCatalogLinks } from "./article-media";

describe("article catalog media", () => {
  it("normalizes Spotify, Apple Music, and YouTube links into safe browser embeds", () => {
    const links = normalizeArticleCatalogLinks([
      { url: "https://open.spotify.com/album/abc123" },
      { url: "https://music.apple.com/us/album/project/123?i=456" },
      { url: "https://youtu.be/video123" },
    ]);
    expect(links).toEqual([
      { url: "https://open.spotify.com/album/abc123", platform: "spotify", label: "Latest Release", embedUrl: "https://open.spotify.com/embed/album/abc123" },
      { url: "https://music.apple.com/us/album/project/123?i=456", platform: "apple", label: "Latest Project", embedUrl: "https://embed.music.apple.com/us/album/project/123?i=456" },
      { url: "https://youtu.be/video123", platform: "youtube", label: "Featured Track", embedUrl: "https://www.youtube.com/embed/video123" },
    ]);
  });

  it("keeps custom labels and ignores unsupported URLs", () => {
    const links = normalizeArticleCatalogLinks([
      { url: "https://open.spotify.com/track/abc", label: "New Single" },
      { url: "https://example.com/not-a-player" },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe("New Single");
  });
});
