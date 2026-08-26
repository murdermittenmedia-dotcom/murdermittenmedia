import { describe, expect, it } from "vitest";
import { getArtistInitials } from "../shared/leaderboard-display";

describe("leaderboard avatar display", () => {
  it("creates compact initials from an artist name", () => {
    expect(getArtistInitials("YLG TWON")).toBe("YT");
    expect(getArtistInitials("  single  ")).toBe("S");
  });

  it("uses a safe fallback for blank names", () => {
    expect(getArtistInitials("   ")).toBe("?");
  });
});

