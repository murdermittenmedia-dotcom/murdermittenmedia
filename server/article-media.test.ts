import { describe, expect, it } from "vitest";
import { normalizeArticleCatalogLinks } from "./article-media";
import { parsePastedArticleLinks } from "@shared/article-links";

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

  it("parses heading-based artist link sheets and ignores section headings", () => {
    const pasted = `ItsManMan Full Links
Music
Spotify: https://open.spotify.com/artist/6kghbirzrs0QvOBBKJLLKv
Apple Music: https://music.apple.com/us/artist/itsmanman/1673724763
Social
Instagram: https://www.instagram.com/itsmanman31/
TikTok: https://www.tiktok.com/@_ItsManMan
YouTube: https://www.youtube.com/@ItsManMan
Music Videos
CHRIS ROCC (Official Video): https://www.youtube.com/watch?v=v9rq9Ug6gfA
TRAVIS HUNTER (Official Video): https://www.youtube.com/watch?v=sz-P_jopTz0
MICHAEL BLACKSON (Official Video): https://www.youtube.com/watch?v=7HLFhigwfgM`;
    const parsed = parsePastedArticleLinks(pasted);
    expect(parsed).toHaveLength(8);
    expect(parsed.map(link => link.label)).toEqual([
      "Spotify",
      "Apple Music",
      "Instagram",
      "TikTok",
      "YouTube",
      "CHRIS ROCC (Official Video)",
      "TRAVIS HUNTER (Official Video)",
      "MICHAEL BLACKSON (Official Video)",
    ]);
    const normalized = normalizeArticleCatalogLinks(parsed);
    expect(normalized.filter(link => link.category === "player")).toHaveLength(5);
    expect(normalized.filter(link => link.category === "social")).toHaveLength(2);
    expect(normalized.find(link => link.label === "YouTube")).toMatchObject({ platform: "youtube", category: "link" });
    expect(normalized.find(link => link.label === "CHRIS ROCC (Official Video)")?.embedUrl).toBe("https://www.youtube.com/embed/v9rq9Ug6gfA");
  });
});
