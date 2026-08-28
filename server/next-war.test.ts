import { describe, expect, it } from "vitest";
import { buildNextWarEntries } from "@shared/next-war";

describe("Start Next War winner rollover", () => {
  it("does not copy a winner again when the next-round entry already exists", () => {
    const result = buildNextWarEntries([
      { userId: 7, artistName: "Winner", songTitle: "Victory Track", songUrl: "https://audio.example/winner.mp3", roundNumber: 3, status: "winner" },
      { userId: 7, artistName: "Winner", songTitle: "Victory Track", songUrl: "https://audio.example/winner.mp3", roundNumber: 4, status: "active" },
    ]);
    expect(result).toEqual([]);
  });

  it("copies only winners into active entries and increments the round", () => {
    const result = buildNextWarEntries([
      { userId: 7, artistName: "Winner", songTitle: "Victory Track", songUrl: "https://audio.example/winner.mp3", roundNumber: 3, status: "winner" },
      { userId: 8, artistName: "Eliminated", songTitle: "Lost Track", songUrl: null, roundNumber: 3, status: "eliminated" },
    ]);

    expect(result).toEqual([{
      userId: 7,
      artistName: "Winner",
      songTitle: "Victory Track",
      songUrl: "https://audio.example/winner.mp3",
      contactInfo: null,
      paid: false,
      paymentConfirmed: true,
      status: "active",
      wheelPosition: 0,
      roundNumber: 4,
    }]);
  });
});
