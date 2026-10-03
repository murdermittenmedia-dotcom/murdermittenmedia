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
});
