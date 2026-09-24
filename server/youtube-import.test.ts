import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseYouTubeChannelUrl, parseYouTubeUrl } from "./youtube-import";

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
});
