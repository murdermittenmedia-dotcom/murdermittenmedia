import { describe, expect, it } from "vitest";
import { getMusicEmbed } from "../client/src/lib/musicEmbed";

describe("getMusicEmbed", () => {
  it("builds a Spotify track embed", () => {
    expect(getMusicEmbed("https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl")).toEqual({
      provider: "spotify",
      src: "https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl?utm_source=generator&theme=0",
    });
  });

  it("builds an Apple Music album embed", () => {
    expect(getMusicEmbed("https://music.apple.com/us/album/example/123456789")).toEqual({
      provider: "apple_music",
      src: "https://embed.music.apple.com/us/album/example/123456789",
    });
  });

  it("builds a YouTube watch embed", () => {
    expect(getMusicEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("rejects malformed and unsupported URLs", () => {
    expect(getMusicEmbed("not a url")).toBeNull();
    expect(getMusicEmbed("https://example.com/song")).toBeNull();
    expect(getMusicEmbed("https://open.spotify.com/track/")).toBeNull();
  });
});
