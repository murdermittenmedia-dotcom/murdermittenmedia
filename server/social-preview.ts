export type CreatorPreviewPage = {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

const BASE_URL = "https://murdermittenmedia.com";
const DEFAULT_IMAGE = `${BASE_URL}/manus-storage/mmm_logo_8689da6b.png`;

function toAbsoluteUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

export function buildCreatorPreviewMeta(page: CreatorPreviewPage, slug: string) {
  const displayName = page.displayName?.trim() || "Creator";
  const safeSlug = encodeURIComponent(slug.toLowerCase());
  return {
    title: `${displayName} | Murder Mitten Media`,
    description: page.bio?.trim() || `Follow ${displayName} for music, socials, releases, and updates.`,
    image: toAbsoluteUrl(page.avatarUrl) || DEFAULT_IMAGE,
    url: `${BASE_URL}/link/${safeSlug}`,
  };
}
