export type StudioMapRecord = {
  id: number;
  studioName: string;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

export function getStudioMapLocations(studios: StudioMapRecord[]) {
  return studios.flatMap((studio) => {
    if (!studio.latitude?.trim() || !studio.longitude?.trim()) return [];
    const lat = Number(studio.latitude);
    const lng = Number(studio.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return [];
    }
    return [{ ...studio, position: { lat, lng } }];
  });
}
