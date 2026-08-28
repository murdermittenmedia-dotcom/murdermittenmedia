import { describe, expect, it } from "vitest";
import { mergeProfileSongs } from "@shared/profile-songs";

const song = (overrides: Partial<Parameters<typeof mergeProfileSongs>[0][number]> = {}) => ({
  id: 1,
  title: "Existing Track",
  artistName: "YLG TWON",
  fileKey: "songs/1/existing.mp3",
  fileUrl: "https://storage.example/existing.mp3",
  externalUrl: null,
  genre: null,
  isPublic: true,
  uploadedAt: new Date("2026-08-20T00:00:00Z"),
  fireCount: 4,
  trashCount: 1,
  ...overrides,
});

describe("profile song merging", () => {
  it("deduplicates a battle submission against the existing catalogue title", () => {
    const result = mergeProfileSongs(
      [song()],
      [{
        id: 10,
        winnerArtistName: "YLG TWON",
        winnerSongTitle: " existing track ",
        winnerSongUrl: "https://youtu.be/existing",
        loserArtistName: "Other Artist",
        loserSongTitle: "Other Song",
        loserSongUrl: null,
        battleDate: new Date("2026-08-21T00:00:00Z"),
      }],
      "YLG TWON",
    );
    expect(result).toHaveLength(1);
    expect(result[0].fileUrl).toContain("existing.mp3");
  });

  it("adds a battle-only song with its playback URL and zero reaction totals", () => {
    const result = mergeProfileSongs(
      [],
      [{
        id: 11,
        winnerArtistName: "Other Artist",
        winnerSongTitle: "Other Song",
        winnerSongUrl: null,
        loserArtistName: "YLG TWON",
        loserSongTitle: "Battle Only",
        loserSongUrl: "https://youtu.be/battle-only",
        battleDate: new Date("2026-08-21T00:00:00Z"),
      }],
      "YLG TWON",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Battle Only", externalUrl: "https://youtu.be/battle-only", fireCount: 0, trashCount: 0 });
  });
});
