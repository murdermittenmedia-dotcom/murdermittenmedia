import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public Music Review submissions", () => {
  it("allows free submissions without an account and asks guests for an artist name", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    expect(router).toContain("submit: publicProcedure");
    expect(router).toContain("uploadAudio: publicProcedure");
    expect(router).toContain("userId: ctx.user?.id ?? null");
    expect(page).toContain("Guest submission");
    expect(page).toContain("Enter the artist name you want displayed with your track.");
    expect(page).not.toContain('toast.error("Please login to submit your track")');
  });

  it("keeps paid submissions gated and limits guest uploads to supported audio formats", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/MusicReview.tsx"), "utf8");
    expect(router).toContain("if (!ctx.user && input.paidSubmissionType)");
    expect(page).toContain("Upload an MP3, WAV, or M4A file");
    expect(page).toContain(".mp3,.wav,.m4a");
  });
});
