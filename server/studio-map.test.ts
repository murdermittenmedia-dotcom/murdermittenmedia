import { describe, expect, it } from "vitest";
import { getStudioMapLocations } from "../client/src/lib/studioMap";

describe("getStudioMapLocations", () => {
  it("normalizes studios with valid coordinates for map markers", () => {
    expect(
      getStudioMapLocations([
        { id: 1, studioName: "Top Rank", location: "Ypsilanti", latitude: "42.2585453", longitude: "-83.6613234" },
      ]),
    ).toEqual([
      {
        id: 1,
        studioName: "Top Rank",
        location: "Ypsilanti",
        latitude: "42.2585453",
        longitude: "-83.6613234",
        position: { lat: 42.2585453, lng: -83.6613234 },
      },
    ]);
  });

  it("skips studios without usable coordinates", () => {
    expect(
      getStudioMapLocations([
        { id: 1, studioName: "Missing", latitude: "", longitude: "" },
        { id: 2, studioName: "Invalid", latitude: "91", longitude: "-83" },
        { id: 3, studioName: "Mapped", latitude: "42", longitude: "-83" },
      ]),
    ).toHaveLength(1);
  });
});
