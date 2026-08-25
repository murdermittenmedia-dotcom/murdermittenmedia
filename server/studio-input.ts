export interface StudioFormInput {
  studioName?: string | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  engineers?: string | null;
  contactInfo?: string | null;
  instagramHandle?: string | null;
  twitterHandle?: string | null;
  facebookUrl?: string | null;
  websiteUrl?: string | null;
  youtubeChannel?: string | null;
  tiktokHandle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

const clean = (value: string | null | undefined) => value?.trim() ?? "";

export function normalizeStudioInput(input: StudioFormInput) {
  return {
    studioName: clean(input.studioName) || "Unnamed Studio",
    location: clean(input.location),
    latitude: clean(input.latitude),
    longitude: clean(input.longitude),
    engineers: clean(input.engineers),
    contactInfo: clean(input.contactInfo),
    instagramHandle: clean(input.instagramHandle),
    twitterHandle: clean(input.twitterHandle),
    facebookUrl: clean(input.facebookUrl),
    websiteUrl: clean(input.websiteUrl),
    youtubeChannel: clean(input.youtubeChannel),
    tiktokHandle: clean(input.tiktokHandle),
    description: clean(input.description),
    imageUrl: clean(input.imageUrl),
  };
}
