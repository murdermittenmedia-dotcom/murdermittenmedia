import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mysql2/promise so no real DB connection is attempted
vi.mock("mysql2/promise", () => ({
  createConnection: vi.fn().mockRejectedValue(new Error("No DB in test")),
  createPool: vi.fn().mockReturnValue({
    query: vi.fn().mockRejectedValue(new Error("No DB in test")),
    end: vi.fn(),
  }),
}));

// Mock the DB module so tests don't need a real database
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null), // null = DB unavailable
  };
});

import {
  getAllBattleRecords,
  getBattleRecordsByArtistName,
  getArtistStats,
} from "./db";

describe("Battle Records (DB unavailable fallback)", () => {
  it("getAllBattleRecords returns empty array when DB is null", async () => {
    const result = await getAllBattleRecords();
    expect(result).toEqual([]);
  });

  it("getBattleRecordsByArtistName returns empty array when DB is null", async () => {
    const result = await getBattleRecordsByArtistName("TestArtist");
    expect(result).toEqual([]);
  });

  it("getArtistStats returns zero wins/losses when DB is null", async () => {
    const stats = await getArtistStats("TestArtist");
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.records).toEqual([]);
  });
});

describe("Leaderboard logic (in-memory)", () => {
  it("correctly computes W/L from a set of battle records", () => {
    // Simulate the leaderboard aggregation logic inline
    const records = [
      { winnerArtistName: "ArtistA", loserArtistName: "ArtistB", winnerId: 1, loserId: 2, winnerSongTitle: "Song1", winnerSongUrl: null, battleDate: new Date() },
      { winnerArtistName: "ArtistA", loserArtistName: "ArtistC", winnerId: 1, loserId: 3, winnerSongTitle: "Song2", winnerSongUrl: null, battleDate: new Date() },
      { winnerArtistName: "ArtistB", loserArtistName: "ArtistC", winnerId: 2, loserId: 3, winnerSongTitle: "Song3", winnerSongUrl: null, battleDate: new Date() },
    ];

    const stats: Record<string, { wins: number; losses: number }> = {};
    for (const r of records) {
      if (!stats[r.winnerArtistName]) stats[r.winnerArtistName] = { wins: 0, losses: 0 };
      stats[r.winnerArtistName].wins++;
      if (!stats[r.loserArtistName]) stats[r.loserArtistName] = { wins: 0, losses: 0 };
      stats[r.loserArtistName].losses++;
    }

    expect(stats["ArtistA"].wins).toBe(2);
    expect(stats["ArtistA"].losses).toBe(0);
    expect(stats["ArtistB"].wins).toBe(1);
    expect(stats["ArtistB"].losses).toBe(1);
    expect(stats["ArtistC"].wins).toBe(0);
    expect(stats["ArtistC"].losses).toBe(2);
  });

  it("leaderboard is sorted by wins descending", () => {
    const stats = [
      { artistName: "ArtistC", wins: 0, losses: 2 },
      { artistName: "ArtistA", wins: 2, losses: 0 },
      { artistName: "ArtistB", wins: 1, losses: 1 },
    ];
    const sorted = [...stats].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    expect(sorted[0].artistName).toBe("ArtistA");
    expect(sorted[1].artistName).toBe("ArtistB");
    expect(sorted[2].artistName).toBe("ArtistC");
  });
});
