import { describe, expect, it } from "vitest";
import { normalizeStudioInput } from "./studio-input";

describe("studio form normalization", () => {
  it("accepts a blank form without null values", () => {
    expect(normalizeStudioInput({
      studioName: "",
      location: null,
      latitude: undefined,
      longitude: "",
      engineers: null,
      contactInfo: undefined,
      instagramHandle: "   ",
      twitterHandle: null,
      facebookUrl: undefined,
      websiteUrl: "",
      youtubeChannel: null,
      tiktokHandle: undefined,
      description: "",
      imageUrl: null,
    })).toEqual({
      studioName: "Unnamed Studio",
      location: "",
      latitude: "",
      longitude: "",
      engineers: "",
      contactInfo: "",
      instagramHandle: "",
      twitterHandle: "",
      facebookUrl: "",
      websiteUrl: "",
      youtubeChannel: "",
      tiktokHandle: "",
      description: "",
      imageUrl: "",
    });
  });

  it("trims provided studio values without changing their meaning", () => {
    expect(normalizeStudioInput({ studioName: "  Top Rank Studios ", location: "  2096 Goldside Rd  " })).toMatchObject({
      studioName: "Top Rank Studios",
      location: "2096 Goldside Rd",
    });
  });
});
