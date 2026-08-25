export type StudioLocationSuggestion = {
  displayName: string;
  lat: string;
  lng: string;
};

export async function geocodeStudioAddress(query: string): Promise<StudioLocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.8",
      "User-Agent": "MurderMittenMedia/1.0 studio-directory",
    },
  });
  if (!response.ok) return [];

  const results = (await response.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return results
    .filter((result) => Boolean(result.display_name && result.lat && result.lon))
    .map((result) => ({
      displayName: result.display_name!,
      lat: result.lat!,
      lng: result.lon!,
    }));
}
