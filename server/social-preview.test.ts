import { describe, expect, it } from "vitest";
import { buildCreatorPreviewMeta } from "./social-preview";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("buildCreatorPreviewMeta", () => {
  it("uses the creator display name and selected avatar", () => {
    expect(buildCreatorPreviewMeta({ displayName: "YLG TWON", bio: "New Michigan music", avatarUrl: "/manus-storage/avatar.webp" }, "ylg-twon")).toEqual({
      title: "YLG TWON | Murder Mitten Media",
      description: "New Michigan music",
      image: "https://murdermittenmedia.com/manus-storage/avatar.webp",
      url: "https://murdermittenmedia.com/link/ylg-twon",
    });
  });

  it("uses safe defaults when creator fields are empty", () => {
    const result = buildCreatorPreviewMeta({ displayName: null, bio: null, avatarUrl: null }, "new-artist");
    expect(result.title).toBe("Creator | Murder Mitten Media");
    expect(result.description).toContain("Follow Creator");
    expect(result.image).toContain("mmm_logo_8689da6b.png");
  });
});

describe("Beat Marketplace route previews", () => {
  it("defines branded metadata for the catalog and reusable Beat Pro invite links", () => {
    const vite = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");
    expect(vite).toContain('p === "/beats" || p === "/beats/"');
    expect(vite).toContain("Beat Marketplace | Murder Mitten Media");
    expect(vite).toContain("Find your next record from independent producers");
    expect(vite).toContain("You’re Invited to Beat Pro | Murder Mitten Media");
    expect(vite).toContain("/^\\/beats\\/pro-invite\\/[a-f0-9]{64}\\/?$/i");
    expect(vite).toContain('property="og:image"');
  });
});
