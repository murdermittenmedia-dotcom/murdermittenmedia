import { describe, expect, it } from "vitest";
import { buildPreviewLinks } from "../client/src/lib/linkPreview";

describe("buildPreviewLinks", () => {
  const item = {
    id: 1,
    type: "release",
    title: "Saved song",
    url: "https://open.spotify.com/track/abc123",
    subtitle: "Artist",
    platform: "Spotify",
    icon: "music",
    thumbnailUrl: "",
    isVisible: true,
  };

  it("uses unsaved edits for saved rows", () => {
    const links = buildPreviewLinks([item], { 1: { ...item, title: "Edited song", url: item.url } }, { type: "custom", title: "", url: "", subtitle: "", platform: "", icon: "link", thumbnailUrl: "" });
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Edited song");
  });

  it("preserves hidden state while showing the row in the editor preview model", () => {
    const links = buildPreviewLinks([{ ...item, isVisible: false }], {}, { type: "custom", title: "", url: "", subtitle: "", platform: "", icon: "link", thumbnailUrl: "" });
    expect(links[0].isVisible).toBe(false);
  });

  it("adds a non-persisted draft link for real-time preview", () => {
    const links = buildPreviewLinks([], {}, { type: "custom", title: "New link", url: "https://example.com", subtitle: "", platform: "", icon: "link", thumbnailUrl: "" });
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe("draft");
    expect(links[0].title).toBe("New link");
  });
});
