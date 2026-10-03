import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Music Review broadcast hub", () => {
  it("provides a stream mode with queue monitoring and submission guidance", () => {
    const review = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    expect(review).toContain('get("mode") === "broadcast"');
    expect(review).toContain("Broadcast Hub");
    expect(review).toContain("Queue monitor");
    expect(review).toContain("How to submit");
    expect(review).toContain('id="submit-track"');
    expect(review).toContain("Choose Upload MP3 or YouTube Link");
  });

  it("keeps the canonical broadcast review route connected to a real player", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const broadcast = readFileSync(resolve(process.cwd(), "client/src/pages/BroadcastReview.tsx"), "utf8");
    expect(app).toContain('<Route path={"/broadcast/review"} component={BroadcastReview} />');
    expect(broadcast).toContain("SyncedYouTubePlayer");
    expect(broadcast).toContain("AudioPlayButton");
    expect(broadcast).toContain("Submit a track");
    expect(broadcast).toContain("aspect-video");
    expect(broadcast).toContain("slice(0, 5)");
    expect(broadcast).toContain("Live synchronized player");
    expect(broadcast).toContain("viewerCount.toLocaleString()");
    expect(broadcast).toContain("Now playing");
    expect(broadcast).toContain("Next 5 songs");
  });
});
