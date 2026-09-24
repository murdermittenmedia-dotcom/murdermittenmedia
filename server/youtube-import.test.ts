import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseYouTubeChannelPageVideos, parseYouTubeChannelUrl, parseYouTubeUrl } from "./youtube-import";

describe("YouTube beat import", () => {
  it("accepts watch, short, Shorts, and embed links without downloading audio", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://youtube.com/embed/dQw4w9WgXcQ")?.canonicalUrl).toContain("watch?v=dQw4w9WgXcQ");
  });

  it("rejects unrelated or malformed URLs", () => {
    expect(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeUrl("not a url")).toBeNull();
    expect(parseYouTubeUrl("https://youtu.be/short")).toBeNull();
  });
  it("accepts channel handles and channel IDs for the Pro upload picker", () => {
    expect(parseYouTubeChannelUrl("https://www.youtube.com/@MurderMittenMedia")?.channelId).toBeNull();
    expect(parseYouTubeChannelUrl("https://youtube.com/channel/UC1234567890123456789012")?.channelId).toBe("UC1234567890123456789012");
    expect(parseYouTubeChannelUrl("https://example.com/@not-youtube")).toBeNull();
  });
  it("uses the imported YouTube thumbnail as the beat cover", () => {
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    expect(producer).toContain("if (imported.thumbnailUrl) { setArtwork(null); setRemoteArtworkUrl(imported.thumbnailUrl); }");
    expect(producer).toContain("importYouTubeChannel");
    expect(producer).toContain("publishYouTubeBeats");
  });
  it("parses the rendered channel uploads and de-duplicates video cards", () => {
    const html = 'videoId":"dQw4w9WgXcQ" ... metadata":{"lockupMetadataViewModel":{"title":{"content":"First \\u0026 Latest"}}} videoId":"dQw4w9WgXcQ" ... metadata":{"lockupMetadataViewModel":{"title":{"content":"Duplicate"}}} videoId":"9bZkp7q19f0" ... metadata":{"lockupMetadataViewModel":{"title":{"content":"Second"}}}';
    const videos = parseYouTubeChannelPageVideos(html);
    expect(videos).toHaveLength(2);
    expect(videos[0]?.title).toBe("First & Latest");
    expect(videos[1]?.canonicalUrl).toContain("9bZkp7q19f0");
  });
  it("allows rendered channel uploads when YouTube's legacy RSS feed is unavailable", () => {
    const importer = readFileSync(resolve(process.cwd(), "server/youtube-import.ts"), "utf8");
    expect(importer).toContain("if (!feed.ok && !pageVideos.length)");
    expect(importer).toContain('const xml = feed.ok ? await feed.text() : "";');
  });
  it("keeps pending YouTube masters unavailable until the producer uploads audio", () => {
    const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(routers).toContain('beat.masterDeliveryStatus === "producer_required" || !beat.masterFileUrl');
  });
  it("publishes one producer-selected lease set across a channel batch", () => {
    const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    expect(routers).toContain("licenses: z.array(beatLicenseInput).min(1).max(3)");
    expect(routers).toContain("input.licenses.map((license, index)");
    expect(producer).toContain("Set lease options for every selected upload");
    expect(producer).toContain("licenses });");
  });
  it("uses a clipped, non-linking preview for imported videos", () => {
    const player = readFileSync(resolve(process.cwd(), "client/src/components/YouTubePreviewButton.tsx"), "utf8");
    const marketplace = readFileSync(resolve(process.cwd(), "client/src/pages/BeatMarketplace.tsx"), "utf8");
    expect(player).toContain("end=30");
    expect(player).toContain("pointer-events-none");
    expect(marketplace).toContain("YouTubePreviewButton");
    expect(marketplace).not.toContain('aria-label={`Preview ${beat.title} on YouTube`}');
  });
});
