import { describe, expect, it } from "vitest";
import { attachSongReactionTotals } from "@shared/song-reaction-totals";

describe("song reaction totals", () => {
  it("aggregates fire and trash counts by artist and song title", () => {
    const songs = [{ id: 1, artistName: "YLG TWON", title: "Summer Days" }];
    const submissions = [
      { artistName: "YLG TWON", songTitle: "Summer Days", fireCount: 4, trashCount: 1 },
      { artistName: "YLG TWON", songTitle: "Summer Days", fireCount: 3, trashCount: 2 },
    ];

    expect(attachSongReactionTotals(songs, submissions)).toEqual([
      { id: 1, artistName: "YLG TWON", title: "Summer Days", fireCount: 7, trashCount: 3 },
    ]);
  });

  it("defaults catalogue songs without reviewed submissions to zero", () => {
    const songs = [{ id: 1, artistName: "YLG TWON", title: "Unreviewed" }];

    expect(attachSongReactionTotals(songs, [])).toEqual([
      { id: 1, artistName: "YLG TWON", title: "Unreviewed", fireCount: 0, trashCount: 0 },
    ]);
  });
});
