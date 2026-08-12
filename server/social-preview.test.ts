import { describe, expect, it } from "vitest";
import { buildCreatorPreviewMeta } from "./social-preview";

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
