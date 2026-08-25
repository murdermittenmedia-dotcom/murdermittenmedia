import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeStudioAddress } from "./studio-geocode";

describe("geocodeStudioAddress", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns full-address suggestions with coordinates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            display_name: "2096 Golfside Rd, Ypsilanti, Michigan 48197, United States",
            lat: "42.2411",
            lon: "-83.6137",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(geocodeStudioAddress("2096 Golfside Rd, Ypsilanti, MI 48197")).resolves.toEqual([
      {
        displayName: "2096 Golfside Rd, Ypsilanti, Michigan 48197, United States",
        lat: "42.2411",
        lng: "-83.6137",
      },
    ]);

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("format=jsonv2");
    expect(requestUrl).toContain("addressdetails=1");
    expect(requestUrl).toContain("countrycodes=us");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "User-Agent": expect.stringContaining("MurderMittenMedia") }),
    });
  });

  it("returns no suggestions for short queries and upstream failures", async () => {
    expect(await geocodeStudioAddress("  ")).toEqual([]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await expect(geocodeStudioAddress("2096 Golfside Rd")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
