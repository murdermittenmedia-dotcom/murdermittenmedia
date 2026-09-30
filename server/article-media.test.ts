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
      { url: "https://open.spotify.com/album/abc123", platform: "spotify", label: "Latest Release", category: "player", embedUrl: "https://open.spotify.com/embed/album/abc123" },
      { url: "https://music.apple.com/us/album/project/123?i=456", platform: "apple", label: "Latest Project", category: "player", embedUrl: "https://embed.music.apple.com/us/album/project/123?i=456" },
      { url: "https://youtu.be/video123", platform: "youtube", label: "Featured Track", category: "player", embedUrl: "https://www.youtube.com/embed/video123" },
    ]);
  });

  it("keeps custom labels and preserves external URLs as buttons", () => {
    const links = normalizeArticleCatalogLinks([
      { url: "https://open.spotify.com/track/abc", label: "New Single" },
      { url: "https://example.com/not-a-player" },
    ]);
    expect(links).toHaveLength(2);
    expect(links[0].label).toBe("New Single");
    expect(links[0].category).toBe("player");
    expect(links[1]).toMatchObject({ platform: "website", category: "link", url: "https://example.com/not-a-player" });
  });

  it("keeps socials and arbitrary music links instead of discarding them", () => {
    const links = normalizeArticleCatalogLinks([
      { url: "https://instagram.com/9000rondae", label: "Instagram" },
      { url: "https://soundcloud.com/9000rondae/latest-release", label: "Latest Release" },
      { url: "https://audiomack.com/9000rondae", label: "Audiomack" },
      { url: "https://9000rondae.com", label: "Official Website" },
    ]);
    expect(links).toHaveLength(4);
    expect(links[0]).toMatchObject({ platform: "instagram", category: "social", label: "Instagram" });
    expect(links[1]).toMatchObject({ platform: "soundcloud", category: "player", label: "Latest Release" });
    expect(links[2]).toMatchObject({ platform: "audiomack", category: "link", label: "Audiomack" });
    expect(links[3]).toMatchObject({ platform: "website", category: "link", label: "Official Website" });
  });
});
