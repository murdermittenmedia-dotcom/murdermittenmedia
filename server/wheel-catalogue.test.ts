import { describe, expect, it } from "vitest";
import { buildWheelCatalogueSong, getWheelCatalogueMatchKey } from "@shared/wheel-catalogue";

describe("wheel catalogue linking", () => {
  it("normalizes the submitted title and artist while preserving the external URL", () => {
    expect(buildWheelCatalogueSong({
      userId: 7,
      title: "  New Track  ",
      artistName: "  YLG TWON  ",
      songUrl: "https://youtu.be/example",
    })).toEqual({
      userId: 7,
      title: "New Track",
      artistName: "YLG TWON",
      fileKey: null,
      fileUrl: null,
      externalUrl: "https://youtu.be/example",
      isPublic: true,
    });
  });

  it("preserves uploaded audio in file fields instead of downgrading it to an external URL", () => {
    expect(buildWheelCatalogueSong({
      userId: 7,
      title: "Uploaded Track",
      artistName: "YLG TWON",
      songUrl: "https://storage.example/uploaded-track.mp3",
      fileKey: "songs/7/uploaded-track.mp3",
      fileUrl: "https://storage.example/uploaded-track.mp3",
    })).toMatchObject({
      fileKey: "songs/7/uploaded-track.mp3",
      fileUrl: "https://storage.example/uploaded-track.mp3",
      externalUrl: null,
    });
  });

  it("uses the same identity for title casing and surrounding whitespace", () => {
    expect(getWheelCatalogueMatchKey(7, "  New Track ")).toBe(getWheelCatalogueMatchKey(7, "new track"));
  });
});
